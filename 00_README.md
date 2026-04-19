# ERE SOLAR BOT — Règles du projet

> Pipeline commercial de solarisation tertiaire — ERE Experts  
> Version : 1.0 — avril 2026

---

## Équipe

| Rôle | Personne | GitHub |
|------|----------|--------|
| Architecte / Métier | Mehdi | `mehdiiialaoui1-ops` |
| Tech & Infra | Youssef | collaborateur |

---

## Conventions de code

- **Langage back** : TypeScript strict
- **Front** : Next.js 14+ (App Router)
- **Tests** : Vitest (obligatoires sur toutes les fonctions de calcul)
- **DB** : Supabase (région EU Frankfurt)
- **Hébergement** : Vercel

## Conventions Git

```bash
# Branches
feature/nom-de-la-tache
fix/description-du-bug
data/ajout-donnees-reglementaires

# Commits (impératif français)
git commit -m "ajoute: scaffolding Next.js 14"
git commit -m "corrige: calcul prime autoconsommation"
git commit -m "ajoute: schéma table prospects Supabase"
```

**Workflow :**
1. `git pull origin main` chaque matin
2. Créer une branche par tâche Linear
3. PR → review Mehdi → merge

---

## Conventions de sessions Cowork

| Préfixe | Usage |
|---------|-------|
| `[DEV]` | Code, développement |
| `[SPEC]` | Spécifications |
| `[DATA]` | Données réglementaires |
| `[CLIENT]` | Préparation RDV client |
| `[DEBUG]` | Bug de prod |

---

## Structure du repo

```
solar-bot/
├── 00_README.md                    ← ce fichier
├── 01_specs/                       ← specs fonctionnelles (Mehdi)
├── 02_prompts/                     ← prompts système versionnés
├── 03_data/                        ← données réglementaires FR
├── 04_code/                        ← code du pipeline (Youssef)
│   ├── src/
│   │   ├── sourcing/               ← étape 1 : cadastre + BDNB
│   │   ├── satellite/              ← étape 2-3 : Google Maps + Solar API
│   │   ├── enrichment/             ← étape 4 : Pappers + Dropcontact
│   │   ├── video/                  ← étape 5 : Veo 3 + ffmpeg
│   │   ├── microsite/              ← étape 6 : micro-site personnalisé
│   │   ├── outreach/               ← étape 7 : Lemlist + multi-canal
│   │   └── inbox/                  ← étape 8 : classifieur réponses
│   └── tests/
├── 05_integrations/                ← n8n / Make workflows
├── 06_tests/                       ← cas de test end-to-end
├── 07_livrables_clients/           ← démos, pitch decks
├── 08_operations/                  ← CGV, DPA, registre RGPD
└── .claude/skills/                 ← skills Cowork ERE Experts
```

---

## Cadre réglementaire (France 2026)

- Loi APER : obligations de solarisation parkings > 1 500 m² et toitures neuves/rénovées > 500 m²
- Décret tertiaire : paliers -40% (2030), -50% (2040), -60% (2050) vs référence
- CEE : fiches IND-UT, BAT-EN, BAT-TH (pas de fiche solaire directe)
- Prime à l'autoconsommation : < 100 kWc
- Tarif rachat EDF OA surplus : voir `03_data/tarifs_OA_2026.csv`
- Suramortissement article 39 decies B

> MaPrimeRénov' ne s'applique PAS au tertiaire/industriel.

---

## Contact DPO

`contact@ere-experts.fr`
