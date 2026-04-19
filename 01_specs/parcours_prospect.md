# Parcours prospect — ERE SOLAR BOT

> Pipeline commercial automatisé : du bâtiment identifié au RDV signé
> Usage : référence pour le code (statuts DB), les emails (séquences), et le micro-site (CTA)

---

## Vue d'ensemble du funnel

```
SOURCING → ENRICHISSEMENT → CALCUL SOLAIRE → OUTREACH → MICRO-SITE → RDV → QUALIFICATION
   J3           J6              J4-J5           J7          J8        J9      Post-sprint
```

---

## Étape 1 — Sourcing bâtiment

**Statut DB :** `new`
**Modules :** `sourcing/cadastre-ign.ts`, `sourcing/bdnb.ts`
**Entrée :** codes INSEE de la région pilote
**Sortie :** liste de bâtiments tertiaires/industriels > 500 m² avec coordonnées GPS

### Actions automatiques
- Appel API Cadastre IGN : récupération parcelles par commune
- Appel BDNB (CSTB) : filtrage par usage tertiaire + surface > 500 m²
- Croisement : dédoublication par adresse, enrichissement surface + année construction
- Insertion dans Supabase (table `prospects`, statut `new`)

### Critères de qualification automatique
- Surface ≥ 500 m² (obligatoire)
- Usage = tertiaire, industriel, commercial, logistique (pas résidentiel)
- Localisation dans la région pilote

---

## Étape 2 — Enrichissement décideur

**Statut DB :** `enriched`
**Modules :** `enrichment/pappers.ts`, `enrichment/dropcontact.ts`, `enrichment/cascade.ts`
**Entrée :** SIREN/SIRET du propriétaire
**Sortie :** nom, prénom, titre, email pro, téléphone du décideur

### Actions automatiques
- Pappers API : extraction des dirigeants, bénéficiaires effectifs, raison sociale
- Cascade de ciblage (cf. persona_decideur.md) : propriétaire-dirigeant > dir. immobilier > DAF > dir. RSE > DG
- Dropcontact : enrichissement email professionnel + vérification
- Pattern email fallback si Dropcontact échoue : prenom.nom@domaine.fr
- Mise à jour Supabase : colonnes dirigeant_* + passage statut `enriched`

### Critères de passage
- Email professionnel vérifié (bounce rate < 5%)
- Au moins un décideur identifié avec nom + titre

---

## Étape 3 — Calcul solaire + image satellite

**Statut DB :** `solar_calculated`
**Modules :** `imagery/google-maps-static.ts`, `solar/google-solar.ts`, `solar/panel-filter.ts`, `solar/economies.ts`, `solar/pixel-projection.ts`, `solar/overlay-svg.ts`
**Entrée :** coordonnées GPS du bâtiment
**Sortie :** image satellite annotée + chiffres économiques

### Actions automatiques
- Google Maps Static API : image satellite HD du bâtiment (1280×720, zoom 18)
- Google Solar API : analyse du potentiel solaire (panneaux, orientation, production)
- Filtre 70% : ne retenir que les 70% meilleurs panneaux par production annuelle
- Calcul économies : production kWh/an → économies €/an → ROI → économies 20 ans
- Projection pixel : conversion lat/lng panneaux → coordonnées pixel sur l'image
- Overlay SVG : génération du visuel panneaux superposés sur l'image satellite
- Upload images vers Supabase Storage
- Mise à jour Supabase : chiffres solaires + URLs images + statut `solar_calculated`

### Données calculées
| Champ | Source | Exemple |
|-------|--------|---------|
| nb_panneaux | Google Solar filtré 70% | 145 |
| puissance_kwc | nb_panneaux × 0.4 kW | 58 kWc |
| production_kwh_an | Google Solar API | 72 500 kWh |
| economies_an_eur | production × tarif autoconso | 11 600 € |
| economies_20ans_eur | economies_an × 20 × facteur | 278 400 € |
| cout_installation_eur | puissance × 1 000 €/kWc | 58 000 € |
| retour_investissement_ans | cout / economies_an | 5.0 ans |
| prime_autoconso_eur | barème CRE si < 100 kWc | 5 800 € |
| co2_evite_tonnes_an | production × 0.052 kg/kWh | 3.8 t |

---

## Étape 4 — Outreach email

**Statut DB :** `outreach_sent`
**Modules :** `outreach/email-generator.ts`, `outreach/lemlist.ts`
**Entrée :** données prospect enrichi + chiffres solaires
**Sortie :** email personnalisé envoyé via Lemlist

### Séquence email (3 touches)

**Email J0 — Premier contact**
- Objet : mention de l'adresse du bâtiment + obligation réglementaire
- Corps : présentation ERE Experts, chiffres personnalisés, lien micro-site
- CTA : "Voir l'étude de votre bâtiment" → micro-site
- Ton : conseil d'architecte, pas commercial

**Email J+3 — Relance décret tertiaire**
- Objet : rappel échéance décret tertiaire 2030
- Corps : focus sur le palier -40% et OPERAT, lien micro-site
- CTA : "Réserver un échange de 15 min" → Cal.com

**Email J+5 — Dernière relance**
- Objet : "Dernière étude disponible pour [adresse]"
- Corps : urgence douce, récap des chiffres, lien micro-site
- CTA : idem Cal.com
- Note : pas de relance après J+5 en v1

### Règles de désinscription (RGPD)
- Lien unsubscribe dans chaque email (obligatoire)
- Suppression des données sous 72h après demande
- Contact DPO : contact@ere-experts.fr
- Base légale : intérêt légitime B2B (prospection professionnelle)

---

## Étape 5 — Micro-site personnalisé

**Statut DB :** `microsite_ready` (créé) → `opened` (visité)
**Module :** `microsite/` (template Next.js)
**Entrée :** données prospect complètes + images
**Sortie :** URL unique par prospect

### Structure de la page
1. **Hero** : image satellite avec overlay panneaux + nom entreprise
2. **Bloc bâtiment** : adresse, surface, année construction, usage
3. **Bloc solaire** : nb panneaux, kWc, production kWh/an, économies 20 ans
4. **Bloc aides** : prime autoconsommation, suramortissement, CEE annexes
5. **Bloc urgence** : compteur décret tertiaire (jours restants avant 2030)
6. **CTA** : bouton "Réserver un échange" → Cal.com
7. **Footer** : mentions légales, RGPD, contact ERE Experts

### Tracking
- Ouverture du micro-site → mise à jour `opened_at` dans Supabase
- Clic CTA → tracking événement + statut `meeting_booked` si RDV pris

---

## Étape 6 — Prise de RDV

**Statut DB :** `replied` (réponse email) ou `meeting_booked` (via Cal.com)
**Outil :** Cal.com
**Sortie :** créneau réservé dans l'agenda ERE Experts

### Post-RDV (hors scope Sprint v1)
- Qualification commerciale approfondie
- Visite technique si nécessaire
- Devis détaillé avec installateur partenaire
- Signature + lancement travaux

---

## Statuts prospect dans le pipeline

| Statut | Description | Transition |
|--------|-------------|------------|
| `new` | Bâtiment identifié, pas encore enrichi | → `enriched` |
| `enriched` | Décideur identifié, email vérifié | → `solar_calculated` |
| `solar_calculated` | Chiffres solaires calculés, images générées | → `outreach_sent` |
| `outreach_sent` | Premier email envoyé via Lemlist | → `opened` / `replied` |
| `opened` | Email ouvert ou micro-site visité | → `replied` / `meeting_booked` |
| `replied` | Le prospect a répondu à un email | → `meeting_booked` / `lost` |
| `meeting_booked` | RDV pris via Cal.com | → `qualified` / `lost` |
| `qualified` | RDV effectué, projet confirmé | → `client` |
| `client` | Devis signé, travaux lancés | — |
| `lost` | Prospect perdu (refus, injoignable) | — |
| `unsubscribed` | Demande de désinscription RGPD | — |

### Règles de transition
- Un prospect ne peut que avancer dans le funnel (pas de retour en arrière sauf → `lost` / `unsubscribed`)
- `unsubscribed` est un état terminal — suppression des données sous 72h
- `lost` peut être réactivé manuellement (hors pipeline automatique)

---

## Métriques de suivi (KPI)

| Métrique | Formule | Objectif v1 |
|----------|---------|-------------|
| Taux d'enrichissement | enriched / new | > 60% |
| Taux de calcul solaire | solar_calculated / enriched | > 90% |
| Taux d'ouverture email | opened / outreach_sent | > 30% |
| Taux de clic micro-site | clics / ouvertures | > 15% |
| Taux de réponse | replied / outreach_sent | > 5% |
| Taux de RDV | meeting_booked / outreach_sent | > 2% |

---

*Document rédigé le 20 avril 2026 — Sprint MVP v1*
