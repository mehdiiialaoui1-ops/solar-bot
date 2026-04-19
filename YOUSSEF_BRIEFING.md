# 📋 Briefing Youssef — ERE SOLAR BOT
> Mis à jour le 19 avril 2026 — v3 (Sprint MVP v1 détaillé) — À consulter à chaque début de session

---

## 🎯 Contexte du projet
Tu travailles sur **ERE SOLAR BOT** — un pipeline commercial de solarisation tertiaire développé par ERE Experts (Mehdi). Tu es responsable de toute la partie **Tech & Infra**.

---

## ✅ A.4 — Ce que tu dois configurer sur ta machine Cowork

### Étape 1 — Connecteurs à activer dans Cowork
Ouvre Cowork → va dans les connecteurs → connecte dans cet ordre :

| Connecteur | Action | Priorité |
|-----------|--------|----------|
| **Linear** | Connect → autorise avec ton compte | 🔴 Maintenant |
| **Supabase** | Connect → autorise avec ton compte | 🔴 Maintenant |
| **Claude in Chrome** | Vérifier qu'il est actif | 🟠 Maintenant |
| **Google Drive** | Connect → autorise avec ton compte Google | 🟡 Utile |

### Étape 2 — GitHub
- Accepte l'invitation GitHub reçue par email (repo `solar-bot` de `mehdiiialaoui1-ops`)
- Pour accéder au repo depuis Cowork : utilise **Claude in Chrome** → navigue sur `github.com`
- Clone le repo en local sur ta machine :
```bash
git clone https://github.com/mehdiiialaoui1-ops/solar-bot.git
cd solar-bot
git checkout -b feature/setup-initial
```

### Étape 3 — Linear
- Accepte l'invitation Linear reçue par email (workspace `ere-experts`)
- Tu verras le board **Solar Bot** avec les issues qui te sont assignées
- Tes issues du cycle MVP v1 (14-22 avril) :
  - `[DEV] Initialiser le repo GitHub ere-experts/solar-bot`
  - `[DEV] Scaffolding Next.js 14 + TypeScript + Vitest`
  - `[DEV] Provisionner Supabase EU Francfort + schéma DB initial`
  - `[DEV] Configurer Vercel + déploiement preview automatique`

---

## 🗂️ Répartition des rôles

| Mehdi (Architecte / Métier) | Toi (Tech & Infra) |
|---|---|
| Specs dans `01_specs/` | Code dans `04_code/` |
| Données réglementaires `03_data/` | Workflows n8n `05_integrations/` |
| Personas et parcours prospect | Infrastructure (Vercel, Supabase, DNS) |
| Tests qualité emails | Déploiement et monitoring |
| Relation client ERE Experts | Sécurité et conformité technique |
| Pilotage BATILIAN | Supabase EU (Francfort) |

---

## 🔄 Rituels de synchro quotidiens

- **Chaque matin** : `git pull origin main` avant de commencer
- **Daily async** : vocal WhatsApp 5 min — *fait hier / fait aujourd'hui / blocage*
- **Point hebdo** : visio vendredi 17h — démo + priorités semaine suivante
- **Linear** = source de vérité des tâches (pas de tâches dans les conversations Cowork)

---

## 📁 Convention de nommage des sessions Cowork

| Préfixe | Usage |
|---------|-------|
| `[DEV]` | Code, développement |
| `[SPEC]` | Spécifications |
| `[DATA]` | Données réglementaires |
| `[CLIENT]` | Préparation RDV client |
| `[DEBUG]` | Bug de prod |

**Exemple :** `[DEV] intégration API Pappers pour enrichissement dirigeants`

---

## 🌿 GitFlow à suivre

```bash
# Chaque matin
git pull origin main

# Pour chaque nouvelle tâche
git checkout -b feature/nom-de-la-tache

# Après le travail
git add .
git commit -m "ajoute: description courte"
git push origin feature/nom-de-la-tache
# → Ouvre une Pull Request sur GitHub
# → Mehdi review et merge
```

---

## 🛠️ A.5 — Skills Cowork ERE Experts (créés et validés)

4 skills métier ont été créés, testés et packagés dans le dossier partagé `.claude/skills/`.
**Tu n'as rien à créer** — ils sont déjà dans le repo, tu les verras après le `git clone`.

| Skill | Fichier | Usage |
|-------|---------|-------|
| Vérification éligibilité APER | `skill-verif-eligibilite-aper/SKILL.md` | Qualifier un prospect réglementairement |
| Calcul aides CEE | `skill-calcul-cee/SKILL.md` | Estimer les fiches CEE applicables |
| Génération emails B2B | `skill-generation-email-fr/SKILL.md` | Rédiger emails prospection/suivi |
| Audit conformité RGPD | `skill-conformite-rgpd-outreach/SKILL.md` | Vérifier une campagne avant envoi |

### Pour utiliser un skill dans Cowork :
1. Ouvre Cowork avec le dossier ERE SOLAR BOT sélectionné
2. Tape ta demande normalement → Cowork détecte le skill automatiquement
3. Ou force l'activation : `/skill-verif-eligibilite-aper`

### Points importants sur les skills (suite aux tests de Mehdi) :
- **MaPrimeRénov' ne s'applique PAS au tertiaire/industriel** → le skill APER le précise
- **Signature email** : pas de mention "Architecte DPLG", uniquement "ERE Experts"
- **Email de contact DPO** : `contact@ere-experts.fr` (intégré dans RGPD et Email)
- **CEE** : aucune fiche CEE pour le solaire en lui-même — le skill calcul-cee reste utile pour les travaux annexes (isolation, CVC)

---

## 🚀 Sprint actuel — MVP v1 (14 → 24 avril 2026)

**Objectif :** Premier pipeline fonctionnel de bout en bout — sourcing cadastre → 50 vrais emails envoyés

**Principe :** Mehdi fait les specs/data/métier en parallèle. Toi tu fais le code/infra. On ne se marche pas dessus. Points de sync signalés ⚡.

**Plan détaillé complet :** voir `01_specs/SPRINT_MVP_v1.md`

### Tes tâches jour par jour

| Jour | Branche Git | Ce que tu livres |
|------|-------------|------------------|
| **J1** lun 14 | `feature/scaffolding-nextjs` | Next.js 14 + TS + Vitest + Supabase EU + Vercel preview |
| **J2** mar 15 | `feature/supabase-schema` | Table `prospects` complète (colonnes enrichissement + dirigeant) + RLS |
| **J3** mer 16 | `feature/sourcing-cadastre` | Modules API Cadastre IGN + BDNB + insertion Supabase + tests |
| **J4** jeu 17 | `feature/google-solar-api` | Google Maps Static + Solar API + filtre 70% panneaux + tests |
| **J5** ven 18 | `feature/solar-calculs` | Calcul économies + projection pixel (Web Mercator) + overlay SVG + tests |
| **J6** lun 21 | `feature/enrichment-decideur` | Pappers API + Dropcontact + cascade enrichissement + tests |
| **J7** mar 22 | `feature/outreach-email` | Génération email Claude API + intégration Lemlist + tests |
| **J8** mer 23 | `feature/microsite-template` | Template micro-site statique (hero image + données + CTA Cal.com) |
| **J9** jeu 24 | `feature/pipeline-e2e` | Pipeline bout en bout + monitoring + merge final |

### Points de sync ⚡ obligatoires

- **Fin J2** : Mehdi valide le schéma Supabase vs. ses specs métier
- **Fin J5** (point hebdo vendredi 17h) : tu fais une démo overlay panneaux sur un vrai bâtiment
- **Mi-J7** : Mehdi valide les emails générés par Claude API
- **J9 matin** : Go/No-Go avant envoi des 50 emails

### Structure de code à respecter

```
04_code/src/
├── sourcing/          ← J3 : cadastre-ign.ts, bdnb.ts, index.ts
├── imagery/           ← J4 : google-maps-static.ts
├── solar/             ← J4-J5 : google-solar.ts, panel-filter.ts, economies.ts, pixel-projection.ts, overlay-svg.ts
├── enrichment/        ← J6 : pappers.ts, dropcontact.ts, cascade.ts
├── outreach/          ← J7 : email-generator.ts, lemlist.ts, index.ts
├── microsite/         ← J8 : template Next.js
└── pipeline/          ← J9 : run.ts (orchestrateur complet)
```

### Rappels techniques

- **Tests Vitest obligatoires** sur : `economies.ts`, `pixel-projection.ts`, parsing API (cadastre, BDNB, Solar, Pappers)
- **Filtre panneaux** : prendre les 70% meilleurs par `yearlyEnergyDcKwh` (pas 100%, ça sonne faux)
- **Supabase Storage** : y stocker les PNG satellite + SVG overlay
- **Projection pixel** : fonction `latLngToPixel()` avec Web Mercator (voir guide §6.3d)
- **Panneau standard** : 1,045 m × 1,879 m, 400 W

---

### Clés API dont tu auras besoin (Mehdi te les fournit)

| API | Quand | Qui crée le compte |
|-----|-------|---------------------|
| Google Maps + Solar | J3-J4 | Mehdi (Google Cloud) |
| Pappers | J6 | Mehdi |
| Dropcontact | J6 | Mehdi |
| Lemlist | J7 | Mehdi |

Tu n'as **rien à payer** — Mehdi gère tous les abonnements.

---

*Ce fichier est mis à jour par Mehdi après chaque avancement. Consulte-le au début de chaque session.*
