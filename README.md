# ERE SOLAR BOT

Pipeline commercial de solarisation tertiaire & industrielle — édité par **ERE Experts**.

> Outil vendu en marque blanche à des installateurs solaires français spécialisés tertiaire et industriel.  
> Cible : propriétaires de bâtiments > 500 m² concernés par la loi APER, le décret tertiaire et la trajectoire OPERAT.

---

## Structure du projet

```
solar-bot/
├── .claude/
│   └── skills/                            # Skills Cowork ERE Experts (auto-détectés)
│       ├── skill-verif-eligibilite-aper/  # Qualification réglementaire APER
│       ├── skill-calcul-cee/              # Estimation aides CEE
│       ├── skill-generation-email-fr/     # Emails B2B prospection
│       └── skill-conformite-rgpd-outreach/ # Audit conformité RGPD
│
├── 01_specs/                          # Spécifications fonctionnelles (Mehdi)
├── 02_design/                         # Maquettes, identité visuelle
├── 03_data/
│   ├── reglementaire/                 # Données APER, CEE, décret tertiaire
│   └── prospects/                     # Fichiers prospects (gitignorés — RGPD)
├── 04_code/                           # Code source Next.js 14 + TypeScript (Youssef)
│   └── src/
├── 05_integrations/                   # Workflows n8n, API Pappers, webhooks
├── 06_tests/                          # Tests unitaires Vitest
├── 07_docs/                           # Documentation technique
└── 08_operations/                     # Registre RGPD, runbooks, monitoring
```

---

## Stack technique

| Couche | Technologie |
|--------|------------|
| Frontend | Next.js 14+ / TypeScript |
| Backend | Next.js API Routes / TypeScript |
| Base de données | Supabase (EU Francfort) |
| Tests | Vitest |
| Déploiement | Vercel |
| Intégrations | n8n, Pappers, Dropcontact, Lemlist |

---

## Cadre réglementaire intégré

- **Loi APER (2023)** : ombrières PV parkings > 1 500 m², toitures neuves/rénovées > 500 m²
- **Décret Tertiaire OPERAT** : -40% énergie 2030 / -50% 2040 / -60% 2050
- **Aides financières** : prime autoconsommation, tarif EDF OA, suramortissement art. 39 decies B, CEE

---

## Skills Cowork

Les skills sont dans `.claude/skills/` et s'activent automatiquement dans Cowork quand le dossier du projet est sélectionné.

| Skill | Déclencheurs |
|-------|-------------|
| `skill-verif-eligibilite-aper` | "éligible APER ?", "parking concerné ?", "obligation toiture" |
| `skill-calcul-cee` | "aides CEE", "fiches CEE applicables", "estimation prime" |
| `skill-generation-email-fr` | "rédige un email", "prospection froide", "suivi post-visite" |
| `skill-conformite-rgpd-outreach` | "check RGPD", "campagne conforme ?", "base légale outreach" |

---

## GitFlow

```bash
# Chaque matin
git pull origin main

# Nouvelle tâche
git checkout -b feature/nom-de-la-tache

# Commit (messages en français impératif)
git commit -m "ajoute: description courte"

# Push + Pull Request
git push origin feature/nom-de-la-tache
# → PR sur GitHub → review Mehdi → merge
```

Convention de nommage des branches : `feature/` nouvelle fonctionnalité, `fix/` correction de bug, `spec/` spécification, `data/` données réglementaires.

---

## Contacts

| Rôle | Personne | Responsabilités |
|------|----------|----------------|
| Architecte / Métier | Mehdi | Specs, données réglementaires, validation |
| Tech & Infra | Youssef | Code, infra, déploiement |

**Contact DPO / RGPD :** contact@ere-experts.fr
