# Module enrichment — Pappers + Dropcontact + pattern fallback

Cascade d'enrichissement décideur pour ERE SOLAR BOT (SOL-16 / J6).

## Pipeline

```
SIREN propriétaire
  │
  ├─ 1. Pappers (GET /v2/entreprise) → dirigeants triés par rang ciblage 1-6
  │
  ├─ 2. Dropcontact (POST /batch) → email pro vérifié + tel + LinkedIn
  │
  └─ 3. Pattern email (fallback) → 6 patterns + MX check si Dropcontact n'a rien
```

## Architecture

```
src/enrichment/
├── types.ts           # PappersEntreprise, DropcontactResult, Dirigeant, ContactEnrichi, EnrichmentError
├── pappers.ts         # buildPappersUrl, fetchEntreprise, qualiteVersRang, extraireDirigeants
├── dropcontact.ts     # enrichBatch, estEmailPerso, selectionnerEmailPro
├── pattern-email.ts   # normaliser, genererTousPatterns, aMxRecord, tenterPatterns
├── cascade.ts         # enrichProspect (orchestrateur), selectionnerContactActif
└── index.ts           # re-exports publics
```

## Utilisation

```typescript
import { enrichProspect } from '@/enrichment'

const result = await enrichProspect({
  prospectId: 'uuid-prospect',
  siren: '552032534',
  raisonSociale: 'ACME LOGISTIQUE SAS',
  pappersToken: process.env.PAPPERS_API_KEY!,
  dropcontactToken: process.env.DROPCONTACT_API_KEY!,
})

console.log(result.statut)        // 'enriched' | 'no_contact' | 'enrichment_failed'
console.log(result.contact_actif) // ContactEnrichi | null
```

## Hiérarchie de ciblage

| Rang | Profil | Mots-clés Pappers |
|---|---|---|
| 1 | Propriétaire-dirigeant | Président, Gérant, Président du directoire |
| 2 | Directeur Général | Directeur Général, DG, DG délégué |
| 3 | DAF | DAF, Directeur Administratif et Financier |
| 4 | Directeur Immobilier | Immobilier, Patrimoine |
| 5 | RSE / Développement durable | RSE, Développement durable |
| 6 | Autre | Tout le reste (rare en B2B solaire) |

Le contact `actif=true` est celui avec le **rang le plus bas et un email vérifié**. Si aucun contact n'a d'email vérifié, on prend le rang le plus bas avec un email pattern (non vérifié).

## Patterns email (fallback)

6 patterns dans l'ordre de fréquence en France (`marie.lefebvre@acme.fr` est le plus courant). Le code normalise les caractères accentués (`é→e`, `ç→c`) et retire espaces/apostrophes/traits d'union.

Le check ne fait **pas** de SMTP `RCPT TO` (problèmes de faux positifs et de blacklist) — uniquement un **MX record** sur le domaine. L'email pattern restera donc avec `email_verifie = false`.

## Filtres emails personnels

Les emails `@gmail.com`, `@hotmail.fr`, `@yahoo.com`, `@orange.fr`, `@free.fr`, etc. sont **rejetés** d'office côté Dropcontact. Liste complète dans `EMAIL_DOMAINS_PERSO`.

## Conformité RGPD

- Le registre RGPD couvre ce traitement : `08_operations/registre_rgpd.md` (Traitement T1 : Prospection commerciale B2B).
- Les emails générés par pattern sont déduits, pas collectés. La CNIL accepte cela en B2B sous condition de désinscription présente (couvert par footer Lemlist).

## Tests

```powershell
cd 04_code
npm test
# 4 fichiers tests/enrichment/* + 2 fixtures
```

Aucun appel réseau réel : `fetch` est mocké via `vi.fn()`, le resolver MX aussi.

## Pré-requis pour run en production

À ajouter dans `.env.local` (UTF-8 sans BOM !) :

```
PAPPERS_API_KEY=<token Pappers Starter 49€/mois>
DROPCONTACT_API_KEY=<token Dropcontact Starter 29€/mois>
```

Mehdi confirme la souscription d'ici 26 avril 2026 + 1j.
