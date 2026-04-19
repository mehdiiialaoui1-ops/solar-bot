# Sprint MVP v1 — Plan détaillé

> **Durée :** 9 jours ouvrés (14 → 24 avril 2026)
> **Objectif :** Premier pipeline fonctionnel de bout en bout — sourcing cadastre → 50 vrais emails envoyés
> **Principe :** Mehdi et Youssef travaillent en parallèle. Aucune tâche de l'un ne bloque l'autre sauf aux points de convergence signalés ⚡.

---

## Légende

| Symbole | Signification |
|---------|---------------|
| 🔵 M | Tâche Mehdi (specs, data, métier) |
| 🟢 Y | Tâche Youssef (code, infra, API) |
| ⚡ SYNC | Point de convergence — les deux doivent se coordonner |
| ✅ | Livrable attendu |

---

## Jour 1 — lundi 14 avril

### 🔵 M — Specs personas + parcours prospect

- Rédiger `01_specs/persona_decideur.md` : profil type du décideur (directeur immobilier, gérant SCI, directeur RSE)
- Rédiger `01_specs/parcours_prospect.md` : les 7 étapes du funnel (sourcing → email → micro-site → RDV → devis → signature → chantier)
- Définir les statuts prospect dans le pipeline : `new → sourced → enriched → contacted → opened → replied → meeting_booked → qualified → lost`

### 🟢 Y — Scaffolding Next.js + Supabase

- Scaffolder le projet Next.js 14 + TypeScript + Vitest dans `04_code/`
- Configurer le `tsconfig.json`, ESLint, Prettier
- Provisionner le projet Supabase EU (Francfort)
- Configurer Vercel + déploiement preview automatique sur push
- Créer la branche `feature/scaffolding-nextjs` et ouvrir la PR

### ✅ Livrables J1

- `01_specs/persona_decideur.md` prêt
- `01_specs/parcours_prospect.md` prêt
- Next.js 14 qui tourne en local et sur Vercel preview
- Projet Supabase EU créé (vide)

---

## Jour 2 — mardi 15 avril

### 🔵 M — Base réglementaire + schéma DB conceptuel

- Rédiger `01_specs/base_reglementaire_FR.md` : synthèse loi APER (seuils parkings 1500 m², toitures 500 m²), décret tertiaire (paliers 2030/2040/2050), trajectoire OPERAT
- Créer `03_data/reglementaire/tarifs_OA_2026.csv` : grille tarifaire EDF OA en vigueur (par tranche kWc)
- Créer `03_data/reglementaire/seuils_decret_tertiaire.csv` : paliers -40%/-50%/-60% + dates
- Rédiger le schéma DB conceptuel (version texte/diagramme) dans `01_specs/schema_db_prospects.md` — colonnes, types, contraintes, index

### 🟢 Y — Schéma Supabase + première migration

- Implémenter le schéma SQL `prospects` dans Supabase (migration SQL) en suivant le guide §4.1c :

```sql
CREATE TABLE prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adresse text,
  code_postal text,
  commune text,
  lat double precision,
  lng double precision,
  parcelle_id text UNIQUE,
  surface_m2 numeric,
  usage text,
  annee_construction integer,
  siren_proprietaire text,
  raison_sociale text,
  statut text DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);
```

- Ajouter les colonnes d'enrichissement (à compléter après ⚡ SYNC avec Mehdi) :
  - `dirigeant_nom`, `dirigeant_prenom`, `dirigeant_titre`, `dirigeant_email`, `dirigeant_telephone`
  - `nb_panneaux`, `puissance_kwc`, `production_kwh_an`, `economies_20ans_eur`
  - `satellite_image_url`, `overlay_svg_url`
  - `microsite_url`, `email_sent_at`, `email_opened_at`
- Configurer Row Level Security (RLS) basique
- Branche `feature/supabase-schema` + PR

### ⚡ SYNC fin J2 — Validation schéma DB

Mehdi valide le schéma conceptuel vs. l'implémentation Supabase de Youssef. Ajustements si besoin.

### ✅ Livrables J2

- Base réglementaire documentée
- Fichiers CSV tarifs OA + seuils décret tertiaire
- Table `prospects` créée dans Supabase avec toutes les colonnes
- Schéma validé par les deux

---

## Jour 3 — mercredi 16 avril

### 🔵 M — Données réglementaires détaillées + région pilote

- Créer `03_data/reglementaire/CEE_fiches_operations.csv` : fiches CEE applicables au tertiaire (BAT-EN, BAT-TH, IND-UT) avec montants estimés
- Créer `03_data/reglementaire/prime_autoconsommation_2026.csv` : barème prime autoconso par tranche (< 3 kWc, 3-9, 9-36, 36-100 kWc)
- Choisir la **région pilote** : sélectionner 3-5 codes INSEE pour le test (ex: communes PACA ou IDF selon stratégie)
- Documenter les codes INSEE choisis dans `01_specs/region_pilote.md`

### 🟢 Y — API Sourcing cadastre (Cadastre IGN + BDNB)

- Créer `04_code/src/sourcing/cadastre-ign.ts` : module d'appel API Cadastre IGN
  - `GET https://apicarto.ign.fr/api/cadastre/parcelle?code_insee={code}`
- Créer `04_code/src/sourcing/bdnb.ts` : module d'appel BDNB (CSTB)
  - `GET https://bdnb.io/api/v1/donnees/batiment_groupe?code_insee={code}&usage_principal_bdnb_open=tertiaire&surface_activite_min=500`
- Écrire les tests Vitest pour les deux modules (parsing réponse, gestion erreurs)
- Créer `04_code/src/sourcing/index.ts` : orchestrateur qui chaîne cadastre → BDNB → insertion Supabase
- Branche `feature/sourcing-cadastre` + PR

### ✅ Livrables J3

- Données CEE + prime autoconsommation documentées
- Région pilote choisie avec codes INSEE
- Module sourcing cadastre fonctionnel avec tests

---

## Jour 4 — jeudi 17 avril

### 🔵 M — Templates emails + brief contenu micro-site

- Rédiger les templates d'emails dans `01_specs/templates_emails.md` :
  - Email J0 (premier contact) : objet, corps, CTA, variables dynamiques
  - Email J3 (relance décret tertiaire) : objet, corps, CTA
  - Email J5 (dernière relance) : objet, corps, CTA
- Rédiger le brief contenu du micro-site dans `01_specs/brief_microsite.md` :
  - Structure de la page (hero, caractéristiques, système solaire, aides, CTA)
  - Textes fixes vs. variables dynamiques
  - Ton et wording attendus

### 🟢 Y — Google Maps Static API + Google Solar API

- Créer `04_code/src/imagery/google-maps-static.ts` : appel Maps Static API
  - `GET https://maps.googleapis.com/maps/api/staticmap?center={lat},{lng}&zoom=18&size=1280x720&maptype=satellite`
  - Upload du PNG vers Supabase Storage
- Créer `04_code/src/solar/google-solar.ts` : appel Google Solar API
  - `POST https://solar.googleapis.com/v1/buildingInsights:findClosest`
  - Extraction `solarPotential.solarPanels[]` + `roofSegmentStats[]`
- Créer `04_code/src/solar/panel-filter.ts` : filtre 70% meilleurs panneaux par production
- Écrire les tests Vitest (parsing réponse Solar API, filtre panneaux)
- Branche `feature/google-solar-api` + PR

### ✅ Livrables J4

- Templates emails validés par Mehdi
- Brief micro-site rédigé
- Modules Maps Static + Solar API fonctionnels avec tests

---

## Jour 5 — vendredi 18 avril

### 🔵 M — Registre RGPD + validation enrichissement

- Mettre à jour `08_operations/registre_rgpd.md` : documenter les traitements de données personnelles (sourcing, enrichissement, emailing)
- Valider la base légale pour chaque traitement (intérêt légitime B2B)
- Rédiger la mention de désinscription (lien unsubscribe, suppression sous 72h)
- Relire et valider les templates emails (wording final)

### 🟢 Y — Calcul économies + projection pixel panneaux

- Créer `04_code/src/solar/economies.ts` : calcul financier complet
  - `systemKW`, `yearlyKWh`, `yearlyEconomies`, `economies20ans`
  - Intégration tarifs OA depuis les CSV de Mehdi (`03_data/`)
  - Prime autoconsommation (< 100 kWc)
  - Coût système estimé (800-1200 €/kWc)
- Créer `04_code/src/solar/pixel-projection.ts` : fonction `latLngToPixel()` (Web Mercator)
  - Conversion lat/lng → coordonnées pixel sur image satellite
  - Dimensionnement panneau en pixels selon zoom
- Créer `04_code/src/solar/overlay-svg.ts` : génération SVG overlay panneaux
  - Rectangles orientés selon azimut du pan de toiture
  - Export SVG + PNG combiné
- Tests Vitest obligatoires sur `economies.ts` et `pixel-projection.ts`
- Branche `feature/solar-calculs` + PR

### ⚡ SYNC fin J5 — Point hebdo vendredi 17h

- Démo : Youssef montre le pipeline sourcing → image satellite → overlay panneaux sur un vrai bâtiment
- Mehdi valide les chiffres économiques vs. les données réglementaires
- Décision Go/No-Go sur la suite du sprint

### ✅ Livrables J5

- Registre RGPD à jour
- Templates emails validés
- Calcul économies fonctionnel
- Overlay SVG panneaux sur image satellite (preuve visuelle)

---

## Jour 6 — lundi 21 avril

### 🔵 M — Enrichissement décideur : stratégie + données test

- Rédiger `01_specs/strategie_enrichissement.md` : cascade Pappers → Dropcontact → pattern email
- Préparer 10 SIREN de test (vrais bâtiments de la région pilote) dans `03_data/prospects/test_siren.csv`
- Documenter la hiérarchie de ciblage : propriétaire-dirigeant > directeur immobilier > directeur RSE > DG > directeur achats
- Tester manuellement Pappers API sur 2-3 SIREN pour valider la qualité des données

### 🟢 Y — Enrichissement décideur (code)

- Créer `04_code/src/enrichment/pappers.ts` : appel API Pappers
  - `GET https://api.pappers.fr/v2/entreprise?siren={siren}`
  - Extraction dirigeants, bénéficiaires effectifs, raison sociale groupe
- Créer `04_code/src/enrichment/dropcontact.ts` : enrichissement email/téléphone
- Créer `04_code/src/enrichment/cascade.ts` : orchestrateur cascade (Pappers → Dropcontact → pattern)
- Mettre à jour la table `prospects` avec les champs dirigeant
- Tests Vitest
- Branche `feature/enrichment-decideur` + PR

### ✅ Livrables J6

- Stratégie enrichissement documentée
- SIREN de test prêts
- Module enrichissement fonctionnel avec tests

---

## Jour 7 — mardi 22 avril

### 🔵 M — Copy email Claude API + validation contenu

- Rédiger le prompt système Claude pour la génération d'emails dans `02_prompts/v1_email_copy.txt`
  - Variables : `{prenom}`, `{nom_entreprise}`, `{adresse}`, `{annee_construction}`, `{montant_aides}`, `{jours_restants}`, `{url_microsite}`
  - Contraintes : ton professionnel, pas de marketing, mention décret tertiaire, CTA micro-site
- Tester le prompt manuellement sur 3-5 cas réels
- Valider le rendu final

### 🟢 Y — Génération email + intégration Lemlist

- Créer `04_code/src/outreach/email-generator.ts` : appel Claude API (Sonnet) avec le prompt de Mehdi
- Créer `04_code/src/outreach/lemlist.ts` : intégration API Lemlist
  - Création de campagne
  - Ajout de leads avec variables personnalisées
  - Gestion de la rotation de boîtes
- Créer `04_code/src/outreach/index.ts` : orchestrateur email (génère copy → envoie via Lemlist)
- Tests Vitest
- Branche `feature/outreach-email` + PR

### ⚡ SYNC mi-J7 — Validation email généré

Mehdi relit les emails générés par Claude API sur des cas réels. Ajustement du prompt si nécessaire.

### ✅ Livrables J7

- Prompt email validé
- Module génération email fonctionnel
- Intégration Lemlist prête

---

## Jour 8 — mercredi 23 avril

### 🔵 M — Contenu micro-site : textes fixes + données test

- Rédiger les textes fixes du micro-site (mentions légales, RGPD, disclaimer, texte CTA)
- Préparer 5 jeux de données prospects complets (vrais bâtiments enrichis) pour test du template
- Configurer Cal.com pour la prise de RDV (lien à intégrer dans le CTA)

### 🟢 Y — Template micro-site statique

- Créer le template micro-site dans `04_code/src/microsite/` :
  - Hero : image satellite + overlay panneaux (pas de vidéo en v1)
  - Bloc caractéristiques bâtiment (surface, année, usage)
  - Bloc système solaire (nb panneaux, kWc, kWh/an, économies 20 ans)
  - Bloc aides (prime autoconso, CEE annexes, suramortissement, compte à rebours décret tertiaire)
  - CTA : bouton "Réserver un échange" → Cal.com
- Déployer le template sur Vercel avec variables d'env dynamiques
- Tester avec les 5 jeux de données de Mehdi
- Branche `feature/microsite-template` + PR

### ✅ Livrables J8

- Micro-site fonctionnel sur Vercel preview
- 5 micro-sites de test visibles et testables
- Cal.com configuré

---

## Jour 9 — jeudi 24 avril

### 🔵 M — Sélection des 50 prospects + lancement

- Sélectionner les 50 meilleurs prospects dans la base Supabase (par score : surface, âge toiture, taille entreprise)
- Valider manuellement les 10 premiers (données correctes, bon décideur, email vérifié)
- Lancer l'envoi des 50 emails via Lemlist
- Monitorer les premières ouvertures/clics

### 🟢 Y — Pipeline bout en bout + monitoring

- Connecter tous les modules en un pipeline complet : sourcing → enrichissement → calcul → overlay → email → micro-site
- Créer un script `04_code/src/pipeline/run.ts` qui exécute le pipeline pour N prospects
- Configurer le monitoring basique (logs Supabase, webhooks Lemlist pour tracking ouvertures)
- Corriger les derniers bugs identifiés pendant le test des 50 prospects
- Merger toutes les PR validées sur `main`

### ⚡ SYNC J9 matin — Go/No-Go envoi

Dernier check avant envoi : Mehdi valide les 50 emails + micro-sites. Youssef confirme que le pipeline est stable.

### ✅ Livrables J9

- 50 emails envoyés à de vrais prospects
- 50 micro-sites déployés
- Pipeline bout en bout fonctionnel
- Monitoring actif (ouvertures, clics, réponses)

---

## Récapitulatif des branches Git

| Jour | Branche | Responsable |
|------|---------|-------------|
| J1 | `feature/scaffolding-nextjs` | Youssef |
| J2 | `feature/supabase-schema` | Youssef |
| J3 | `feature/sourcing-cadastre` | Youssef |
| J4 | `feature/google-solar-api` | Youssef |
| J5 | `feature/solar-calculs` | Youssef |
| J6 | `feature/enrichment-decideur` | Youssef |
| J7 | `feature/outreach-email` | Youssef |
| J8 | `feature/microsite-template` | Youssef |
| J9 | `feature/pipeline-e2e` | Youssef |

Mehdi review et merge chaque PR avant la suivante.

---

## Points de convergence ⚡

| Quand | Quoi | Action |
|-------|------|--------|
| Fin J2 | Schéma DB | Mehdi valide colonnes vs. besoins métier |
| Fin J5 | Point hebdo | Démo overlay + validation chiffres économiques |
| Mi-J7 | Email généré | Mehdi valide le copy Claude API sur cas réels |
| J9 matin | Go/No-Go envoi | Validation finale des 50 emails + micro-sites |

---

## Dépendances externes (à anticiper)

| Ressource | Responsable | À faire avant |
|-----------|-------------|---------------|
| Clé API Google Maps + Solar | Mehdi (compte Google Cloud) | J3 |
| Clé API Pappers (starter 49 €/mois) | Mehdi | J6 |
| Compte Dropcontact (29 €/mois) | Mehdi | J6 |
| Compte Lemlist (59-97 €/mois) | Mehdi | J7 |
| Compte Cal.com | Mehdi | J8 |
| Domaine `*.solar.ere-experts.fr` | Youssef (DNS) | J8 |

---

## KPI de succès du sprint

- ✅ 50 emails envoyés à de vrais décideurs
- ✅ 50 micro-sites personnalisés déployés
- ✅ Pipeline reproductible (pas de manipulations manuelles)
- ✅ Taux d'ouverture mesuré (objectif > 30%)
- ✅ Au moins 1 réponse ou 1 RDV booké

---

*Document rédigé le 19 avril 2026 — Sprint démarré le 14 avril, ce plan sert de référence pour les jours restants.*
