# Sélection des 50 prospects + Procédure de lancement

> Critères de scoring pour sélectionner les 50 meilleurs prospects de la campagne pilote.
> Procédure de validation manuelle et checklist Go/No-Go avant envoi.
> Ce document sert de référence pour le pipeline E2E (J9) et le script `run.ts`.

---

## 1. Critères de scoring — Rappel et pondération

Le score (0-100) est calculé automatiquement par le pipeline. Voici la grille complète :

### Critères bâtiment (max 65 points)

| Critère | Condition | Points |
|---------|-----------|--------|
| Surface au sol | > 2 000 m² | +20 |
| Surface au sol | > 5 000 m² | +30 (remplace le +20) |
| Année de construction | < 2000 | +15 |
| Obligation loi APER | parking estimé > 1 500 m² | +25 |
| Obligation décret tertiaire | surface > 1 000 m² | +20 |

### Critères enrichissement (max 15 points)

| Critère | Condition | Points |
|---------|-----------|--------|
| SIREN trouvé | siren_proprietaire IS NOT NULL | +5 |
| Dirigeant identifié | au moins 1 outreach_contact | +5 |
| Email vérifié | email_verifie = true | +10 |
| Email pattern (non vérifié) | email_verifie = false | +5 (au lieu de +10) |

### Critères solaire (max 20 points)

| Critère | Condition | Points |
|---------|-----------|--------|
| ROI < 6 ans | retour_investissement < 6 | +10 |
| ROI < 4 ans | retour_investissement < 4 | +15 (remplace le +10) |
| Puissance > 36 kWc | puissance_kwc > 36 | +5 |
| Puissance > 100 kWc | puissance_kwc > 100 | +10 (remplace le +5) |

### Score minimum pour la sélection : **50 / 100**

---

## 2. Requête SQL de sélection

```sql
SELECT 
  p.id,
  p.adresse,
  p.commune,
  p.surface_m2,
  p.raison_sociale,
  p.score,
  p.statut,
  cs.puissance_kwc,
  cs.economies_an,
  cs.retour_investissement_ans,
  oc.prenom,
  oc.nom,
  oc.email_pro,
  oc.email_verifie,
  oc.titre
FROM prospects p
JOIN calculs_solaires cs ON cs.prospect_id = p.id
JOIN outreach_contacts oc ON oc.prospect_id = p.id AND oc.actif = true
JOIN microsites m ON m.prospect_id = p.id
WHERE p.statut = 'microsite_ready'
  AND p.score >= 50
  AND oc.email_pro IS NOT NULL
  AND oc.email_verifie = true
  AND cs.puissance_kwc >= 9
  AND m.url IS NOT NULL
ORDER BY p.score DESC
LIMIT 50;
```

---

## 3. Filtres d'exclusion

Avant l'envoi, exclure les prospects suivants :

| Filtre | Raison |
|--------|--------|
| `email_pro` dans `blacklist_emails` | Déjà désabonné ou opposition RGPD |
| `email_pro` @gmail.com, @hotmail.com, @yahoo.com | Email personnel, pas professionnel |
| `raison_sociale` contient "MAIRIE", "COMMUNE", "DÉPARTEMENT" | Collectivité publique (hors cible v1) |
| `raison_sociale` contient "SCI" ET `surface_m2` < 1000 | Trop petit pour être rentable |
| `bounce = true` sur un email précédent | Email invalide connu |
| Même `siren_proprietaire` déjà dans la sélection | Dédoublonnage par entreprise |

---

## 4. Validation manuelle — Top 10

Les 10 premiers prospects (score le plus élevé) doivent être validés manuellement par Mehdi avant envoi.

### Checklist de validation par prospect

- [ ] L'adresse correspond bien à un bâtiment tertiaire/industriel (vérification Google Maps)
- [ ] La raison sociale est correcte (pas de confusion avec un homonyme)
- [ ] Le contact est bien un décideur (vérifier le titre/fonction)
- [ ] L'email professionnel est cohérent (domaine = entreprise)
- [ ] L'image satellite est exploitable (pas de bâtiment caché par des arbres)
- [ ] Le micro-site s'affiche correctement (ouvrir l'URL)
- [ ] Les chiffres sont plausibles (kWc cohérent avec la surface, économies réalistes)
- [ ] Pas de raison évidente de ne pas contacter (entreprise en redressement, etc.)

### Critères de rejet manuel

Si un prospect est rejeté, le remplacer par le suivant dans la liste (prospect #51) et appliquer la même validation.

---

## 5. Procédure de lancement — Go/No-Go

### Pré-requis techniques (Youssef)

- [ ] Pipeline E2E testé sur 5 prospects de test (`test_siren.csv`)
- [ ] Les 50 micro-sites sont déployés et accessibles
- [ ] Lemlist : campagne créée, leads importés, séquence configurée (J0/J+3/J+5)
- [ ] Tracking email opérationnel (pixel ouverture, clic, réponse)
- [ ] Webhook Lemlist → Supabase fonctionnel (statuts mis à jour automatiquement)
- [ ] Webhook Cal.com → Supabase fonctionnel (meeting_booked)
- [ ] DKIM + SPF + DMARC configurés sur ere-experts.fr
- [ ] Warm-up des boîtes email réalisé (au moins 2 semaines avant)

### Pré-requis métier (Mehdi)

- [ ] 50 prospects sélectionnés (score >= 50, email vérifié)
- [ ] Top 10 validés manuellement
- [ ] Compte Cal.com configuré (événement 15 min, disponibilités)
- [ ] Prompt Claude API testé sur 5 cas réels (emails relus et validés)
- [ ] Registre RGPD à jour
- [ ] Lien de désinscription testé
- [ ] Page politique de confidentialité en ligne (ere-experts.fr/rgpd)

### Décision Go/No-Go

| Condition | Go | No-Go |
|-----------|----|----|
| Tous les pré-requis techniques OK | Oui | Non — corriger d'abord |
| Tous les pré-requis métier OK | Oui | Non — corriger d'abord |
| Top 10 validé manuellement | Oui | Non — valider d'abord |
| Warm-up email > 2 semaines | Oui | Non — attendre ou réduire le volume |
| Heure d'envoi : mardi-jeudi 8h30-10h | Oui | Non — attendre le bon créneau |

---

## 6. Monitoring post-lancement

### Dashboard temps réel (Supabase + Lemlist)

| Métrique | Source | Alerte si |
|----------|--------|-----------|
| Emails envoyés | Lemlist | < 50 après 1h |
| Taux de bounce | Lemlist | > 5 % |
| Taux d'ouverture (J+1) | Lemlist | < 15 % |
| Visites micro-site (J+1) | Supabase microsites | 0 visites |
| Clics CTA Cal.com | Supabase microsites | — |
| RDV bookés | Cal.com webhook | — |
| Désinscriptions | Lemlist | > 3 % |

### Actions correctives

| Signal | Action |
|--------|--------|
| Bounce > 5 % | Pause campagne, vérifier la liste d'emails, nettoyer |
| Ouverture < 15 % | Tester un nouvel objet d'email (variante B ou C) |
| 0 clic micro-site | Vérifier les liens dans l'email, tester le micro-site |
| Désinscription > 3 % | Revoir le contenu, réduire la fréquence |
| Spam complaints | Stop immédiat, analyser le contenu, consulter délivrabilité |

---

## 7. Planning de lancement recommandé

| Jour | Heure | Action |
|------|-------|--------|
| J-2 | — | Go/No-Go meeting Mehdi + Youssef |
| J-1 | matin | Derniers tests techniques |
| J-1 | soir | Import des 50 leads dans Lemlist |
| J0 | 8h30 | Envoi Email 1 (50 emails) |
| J0 | 10h | Vérification : envois OK, pas de bounce massif |
| J+1 | 9h | Check taux d'ouverture + premières visites micro-site |
| J+3 | 8h30 | Envoi Email 2 (relance) — automatique Lemlist |
| J+3 | 10h | Check résultats séquence |
| J+5 | 8h30 | Envoi Email 3 (dernière relance) — automatique |
| J+7 | — | Bilan campagne pilote : métriques vs KPI |

---

*Document rédigé le 26 avril 2026 — Sprint MVP v1 — Rattrapage J9*
