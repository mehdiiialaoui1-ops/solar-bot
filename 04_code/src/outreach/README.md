# Module outreach — Claude API + Lemlist

SOL-19 / J7 — Génération d'email personnalisé (Claude) puis ajout du lead à une campagne Lemlist qui se charge de la séquence d'envoi (J0 / J3 / J5).

## Pipeline

```
Variables prospect (issues de SOL-11+SOL-12+SOL-16)
  │
  ├─ 1. Claude API → email personnalisé (objet + corps ≤ 150 mots)
  │     · prompt 02_prompts/v1_email_copy.txt
  │     · ton expert-conseil ERE Experts (factuel, data-driven)
  │
  └─ 2. Lemlist API → ajout lead à campagne avec champs custom
        · {{customSubject}} et {{customBody}} consommés par le template
        · séquence J0/J3/J5 gérée côté Lemlist
```

## Architecture

```
src/outreach/
├── types.ts          # PromptVariables, EmailGenere, OutreachResult, OutreachError
├── claude-email.ts   # substituerVariables, appelerClaudeApi, parserEmail, genererEmail
├── lemlist.ts        # buildAuthHeader, buildAddLeadUrl, addLead
├── cascade.ts        # runOutreach (orchestrateur)
└── index.ts          # re-exports publics
```

## Utilisation

```typescript
import { runOutreach } from '@/outreach'
import { readFileSync } from 'node:fs'

const promptTemplate = readFileSync('02_prompts/v1_email_copy.txt', 'utf8')

const result = await runOutreach({
  prospectId: prospect.id,
  contactId: contact.id,
  variables: {
    prenom: contact.prenom,
    nom: contact.nom,
    raison_sociale: prospect.raison_sociale,
    adresse: prospect.adresse,
    code_postal: prospect.code_postal,
    commune: prospect.commune,
    surface_m2: prospect.surface_m2,
    puissance_kwc: calcul.puissance_kwc,
    production_annuelle_kwh: calcul.production_kwh_an,
    economie_annuelle_eur: calcul.economie_annuelle_eur,
    obligations_list: 'loi APER, décret tertiaire',
    microsite_url: microsite.url_publique,
  },
  campagneLemlistId: 'cmp_pilote_lyon',
  destinataireEmail: contact.email_pro,
  promptTemplate,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  lemlistApiKey: process.env.LEMLIST_API_KEY!,
})

if (result.statut === 'sent') {
  // Persister dans outreach_emails (post-merge SOL-19)
}
```

## Limites et contraintes (alignées sur la spec)

| Règle | Source | Implémentation |
|---|---|---|
| 150 mots max dans le corps | Spec ligne 30 | `LIMITE_MOTS = 150` + check côté code |
| Pas de "j'espère que vous allez bien" | Spec ligne 26 | Géré par Claude via le system prompt |
| Pas MaPrimeRénov' | Spec ligne 28 | Géré par Claude via le system prompt |
| Signature : Prénom Nom — ERE Experts | Spec ligne 27 | Géré par Claude via le system prompt |
| Variables {var} substituées | — | `substituerVariables()` lève `PROMPT_TEMPLATE_INVALID` si placeholder restant |

## Gestion des statuts Lemlist

| Code HTTP Lemlist | Statut OutreachResult | Action |
|---|---|---|
| 200 OK | `sent` | Lead ajouté, séquence démarrée |
| 409 Conflict | `duplicate` | Lead déjà dans la campagne, on logge et on passe |
| 423 Locked | `paused` | Campagne en pause, lead pas ajouté |
| 5xx / autres | exception `OutreachError` | Retry à gérer côté pipeline |

## Conformité RGPD

Le footer désinscription Lemlist est obligatoire (configuré dans la séquence côté Lemlist par Mehdi). Notre code ne s'occupe pas de l'envoi physique : c'est Lemlist qui gère.

Toute désinscription depuis l'email arrive via webhook Lemlist → met à jour `outreach_emails.unsubscribed_at` + `prospects.statut='unsubscribed'`. À implémenter dans une PR ultérieure (J9 pipeline E2E).

## Tests

```powershell
cd 04_code
npm test
# 3 fichiers tests/outreach/* + 1 fixture claude-email-sample.json
```

Aucun appel réseau réel : `fetch` mocké via `vi.fn()`.

## Pré-requis pour run en production

À ajouter dans `.env.local` (UTF-8 sans BOM !) :

```
ANTHROPIC_API_KEY=<clé Claude API console.anthropic.com>
LEMLIST_API_KEY=<clé Lemlist Pro / Enterprise>
LEMLIST_CAMPAIGN_PILOTE_ID=cmp_xxxxxxxx
```

Côté Lemlist, configurer la séquence J0/J3/J5 avec :
- 3 emails utilisant `{{customSubject}}` et `{{customBody}}` comme variables
- Footer désinscription obligatoire
- Domaine d'envoi `solar.ere-experts.fr` configuré (DNS SPF/DKIM/DMARC)

Mehdi confirme la souscription Lemlist (59-97€/mois) en cours.
