# Stratégie d'enrichissement — Cascade décideur

> Ce document décrit la cascade d'enrichissement pour passer d'un SIREN à un contact qualifié avec email vérifié.
> Usage : référence pour le module `04_code/src/enrichment/` (tâche Youssef J6).
> Les 10 SIREN de test sont dans `03_data/prospects/test_siren.csv`.

---

## Vue d'ensemble

```
SIREN propriétaire (issu du sourcing)
  │
  ├── Étape 1 : Pappers API → dirigeants + bénéficiaires effectifs
  │     └── Extraction : nom, prénom, fonction, date de nomination
  │
  ├── Étape 2 : Dropcontact API → email + téléphone + LinkedIn
  │     └── Enrichissement : email pro vérifié, téléphone direct, URL LinkedIn
  │
  └── Étape 3 (fallback) : Pattern email → génération + vérification MX
        └── Génération : prenom.nom@domaine.fr + check MX/SMTP
```

---

## Étape 1 — Pappers API

### Endpoint

```
GET https://api.pappers.fr/v2/entreprise?siren={siren}&api_token={token}
```

### Données extraites

| Champ Pappers | Colonne DB (`outreach_contacts`) | Notes |
|---------------|--------------------------------|-------|
| `representants[].nom` | `nom` | Filtrer sur type_representant = "dirigeant" |
| `representants[].prenom` | `prenom` | |
| `representants[].qualite` | `titre` | Mapper vers notre hiérarchie (voir ci-dessous) |
| `representants[].date_prise_poste` | — | Utilisé pour trier par ancienneté |
| `siege.domaine_activite` | — | Vérification du secteur |
| `siege.adresse_ligne_1` | — | Cross-check avec adresse prospect |
| `beneficiaires_effectifs[].nom` | `nom` (si pas de représentant) | Fallback : le bénéficiaire effectif est souvent le dirigeant de PME |

### Mapping des fonctions Pappers → Hiérarchie de ciblage

| Qualité Pappers | Rang ciblage | Correspondance |
|----------------|-------------|----------------|
| "Président", "Gérant", "Président du directoire" | 1 — Propriétaire-dirigeant | Décideur direct |
| "Directeur général", "Directeur général délégué" | 2 — DG | Décideur opérationnel |
| "Directeur administratif et financier", "DAF" | 3 — DAF | Budget / capex |
| "Directeur immobilier", "Responsable patrimoine" | 4 — Dir. Immobilier | Rare dans Pappers, plus fréquent LinkedIn |
| "Directeur RSE", "Directeur développement durable" | 5 — RSE | Argumentaire CO₂ |
| Autre / non trouvé | 6 — Autre | Fallback vers bénéficiaire effectif |

### Règles de sélection

1. Prendre tous les représentants actifs (pas de `date_fin_poste`)
2. Trier par rang de ciblage (1 → 6)
3. Insérer les 3 premiers dans `outreach_contacts` avec `rang_ciblage` correspondant
4. Marquer le rang 1 comme `actif = true` (sera contacté en premier)
5. Si aucun représentant trouvé : utiliser le bénéficiaire effectif principal

### Gestion des erreurs

| Cas | Action |
|-----|--------|
| SIREN non trouvé (404) | Logger l'erreur, marquer le prospect comme `enrichment_failed` |
| SIREN radié / entreprise fermée | Supprimer le prospect de la base |
| Aucun représentant actif | Passer au bénéficiaire effectif, sinon marquer `no_contact` |
| Rate limit (429) | Retry avec backoff exponentiel (1s, 2s, 4s, max 3 retries) |
| Timeout | Retry 1 fois, sinon passer au suivant |

### Tarification Pappers

| Plan | Prix | Crédits | Usage |
|------|------|---------|-------|
| Starter | 49 €/mois | 500 requêtes | Phase pilote (50 prospects + tests) |
| Pro | 149 €/mois | 2 000 requêtes | Montée en charge |

---

## Étape 2 — Dropcontact API

### Endpoint

```
POST https://api.dropcontact.io/batch
Content-Type: application/json
X-Access-Token: {token}

{
  "data": [
    {
      "first_name": "{prenom}",
      "last_name": "{nom}",
      "company": "{raison_sociale}",
      "siren": "{siren}"
    }
  ],
  "siren": true,
  "language": "fr"
}
```

### Données extraites

| Champ Dropcontact | Colonne DB | Notes |
|-------------------|-----------|-------|
| `email[0].email` | `email_pro` | Email professionnel principal |
| `email[0].qualification` | `email_verifie` | "valid" → true, autre → false |
| `phone[0].number` | `telephone_pro` | Numéro direct si disponible |
| `linkedin` | `linkedin_url` | URL profil LinkedIn |

### Règles de traitement

1. Envoyer par batch de 25 contacts max (limite Dropcontact)
2. Attendre le résultat (polling, délai moyen 30-60 secondes)
3. Ne conserver que les emails avec qualification = "valid" (bounce < 1 %)
4. Si l'email est `@gmail.com`, `@hotmail.com`, `@yahoo.com` → **rejeter** (c'est un email perso, pas pro)
5. Mettre à jour `outreach_contacts.email_verifie = true` uniquement si qualification = "valid"

### Tarification Dropcontact

| Plan | Prix | Crédits | Usage |
|------|------|---------|-------|
| Starter | 29 €/mois | 1 000 enrichissements | Phase pilote |
| Growth | 79 €/mois | 5 000 enrichissements | Montée en charge |

---

## Étape 3 — Pattern email (fallback)

Si Dropcontact ne trouve pas l'email (environ 30-40 % des cas pour les PME), on génère un email par pattern + vérification MX.

### Patterns à tester (par ordre de fréquence en France)

```typescript
const patterns = [
  '{prenom}.{nom}@{domaine}',         // jean.dupont@acme.fr — le plus courant
  '{p}.{nom}@{domaine}',              // j.dupont@acme.fr
  '{prenom}{nom}@{domaine}',          // jeandupont@acme.fr
  '{nom}.{prenom}@{domaine}',         // dupont.jean@acme.fr
  '{prenom}@{domaine}',               // jean@acme.fr (petites entreprises)
  '{p}{nom}@{domaine}',               // jdupont@acme.fr
];
```

### Procédure de vérification

1. Extraire le domaine depuis le site web de l'entreprise (Pappers → `siege.url_site_web`)
2. Si pas de site web : utiliser le domaine SIREN (raison sociale normalisée)
3. Pour chaque pattern, vérifier :
   - **MX record** : le domaine a-t-il un serveur mail ? (`dig MX domaine.fr`)
   - **SMTP check** : envoyer un `RCPT TO` sans envoyer le message (si le serveur le permet)
4. Ne retenir que les emails qui passent la vérification MX
5. Marquer `email_verifie = false` (pas de garantie à 100 %)
6. Ces emails auront un score de confiance inférieur dans le scoring prospect (-5 pts)

### Attention RGPD

Les emails générés par pattern ne sont pas "collectés depuis une source publique" mais "déduits". La CNIL considère cela comme acceptable en B2B à condition que le lien de désinscription soit présent et que la personne puisse exercer ses droits. Le registre RGPD (T-02) couvre ce cas.

---

## Hiérarchie de ciblage — Ordre de contact

Le premier contact à qui l'email sera envoyé est déterminé par le rang de ciblage et la disponibilité de l'email :

```
Rang 1 : Propriétaire-dirigeant (Gérant, Président)
  ↓ si pas d'email vérifié
Rang 2 : Directeur Général
  ↓ si pas d'email vérifié
Rang 3 : DAF / Directeur Financier
  ↓ si pas d'email vérifié
Rang 4 : Directeur Immobilier / Responsable Patrimoine
  ↓ si pas d'email vérifié
Rang 5 : Directeur RSE / Développement Durable
  ↓ si pas d'email vérifié
Rang 6 : Contact générique (contact@, info@)
  → Dernier recours, taux de réponse très faible
```

**Règle :** Un seul email par prospect dans la séquence (pas de multi-contact en v1). Le contact `actif = true` est celui avec le meilleur rang ET un email vérifié.

---

## Orchestrateur cascade — Logique du module

```typescript
// 04_code/src/enrichment/cascade.ts

async function enrichProspect(prospect: Prospect): Promise<EnrichmentResult> {
  // 1. Pappers : récupérer les dirigeants
  const dirigeants = await pappers.getDirigeants(prospect.siren_proprietaire);
  
  // 2. Insérer les contacts dans outreach_contacts
  const contacts = await insertContacts(prospect.id, dirigeants);
  
  // 3. Dropcontact : enrichir chaque contact (batch)
  const enriched = await dropcontact.enrichBatch(contacts);
  
  // 4. Pour les contacts sans email Dropcontact : fallback pattern
  const noEmail = enriched.filter(c => !c.email_pro);
  if (noEmail.length > 0) {
    const domaine = await extractDomaine(prospect.raison_sociale);
    await patternEmail.tryPatterns(noEmail, domaine);
  }
  
  // 5. Sélectionner le meilleur contact (rang + email vérifié)
  const bestContact = selectBestContact(enriched);
  if (bestContact) {
    await markActive(bestContact.id);
  }
  
  // 6. Mettre à jour le statut prospect
  await updateProspectStatus(prospect.id, bestContact ? 'enriched' : 'no_contact');
  
  // 7. Recalculer le score (+10 si email vérifié, +5 si SIREN trouvé)
  await recalculateScore(prospect.id);
  
  return { prospect_id: prospect.id, contacts: enriched, active: bestContact };
}
```

---

## Métriques attendues — Taux de conversion enrichissement

| Étape | Taux estimé | Sur 200 bâtiments sourcés |
|-------|-------------|--------------------------|
| SIREN trouvé (cadastre → SIRENE) | 70-80 % | 140-160 |
| Dirigeant identifié (Pappers) | 85-90 % | 120-145 |
| Email vérifié (Dropcontact) | 55-65 % | 66-94 |
| Email pattern (fallback) | +15-20 % | +18-29 |
| **Total email exploitable** | **70-80 %** | **84-123** |
| Après filtre qualité (email pro uniquement) | 60-70 % | **72-102** |

**Conclusion :** pour garantir 50 prospects qualifiés avec email vérifié, il faut sourcer environ 100-150 bâtiments dans le Tier 1.

---

## Points d'attention pour Youssef

1. **Rate limiting** : Pappers = 5 req/s max, Dropcontact = batch de 25. Implémenter un throttle avec queue.
2. **Normalisation des noms** : retirer les accents et caractères spéciaux pour la génération de pattern email (`é` → `e`, `ç` → `c`).
3. **Dédoublonnage** : un même dirigeant peut apparaître dans plusieurs entreprises. Vérifier `outreach_contacts.email_pro` (UNIQUE) avant insert.
4. **Logs d'enrichissement** : logger chaque étape (Pappers OK/KO, Dropcontact résultat, pattern testé) pour debug et optimisation des taux.
5. **Test sur les 10 SIREN** : utiliser `03_data/prospects/test_siren.csv` pour valider le module avant le run complet.

---

*Document rédigé le 26 avril 2026 — Sprint MVP v1 — Rattrapage J6*
