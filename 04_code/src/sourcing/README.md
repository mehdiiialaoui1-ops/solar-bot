# Module sourcing — IGN cadastre + BDNB

Ce module est l'entrée du pipeline ERE SOLAR BOT. Il identifie les
bâtiments tertiaires/industriels français de plus de 500 m² éligibles
à la loi APER (obligation de solarisation des toitures), à partir de
deux sources publiques :

- **IGN apicarto** (`apicarto.ign.fr/api/cadastre/parcelle`) — parcelles
  cadastrales avec géométrie et surface.
- **BDNB CSTB** (`bdnb.io/api/v1/donnees/batiment_groupe`) — bâtiments
  avec usage principal, surface d'activité, SIRET propriétaire.

## Architecture

```
src/sourcing/
├── types.ts            # Interfaces IgnParcelle*, BdnbBatiment, ProspectCandidat, SourcingError
├── cadastre-ign.ts     # Client IGN + filtrage surface + centroïde
├── bdnb.ts             # Client BDNB + pagination + parser WKT + transformer BDNB→ProspectCandidat
└── index.ts            # Orchestrateur sourceProspects() + dedup
```

## Utilisation

```typescript
import { sourceProspects } from '@/sourcing'

const result = await sourceProspects({
  codeInsee: '75101',           // Paris 1er arrondissement
  commune: 'Paris',
  inclureParcellesIgn: false,   // BDNB seul (recommandé)
  surfaceMinM2: 500,            // Seuil APER
})

console.log(`${result.candidats.length} prospects identifiés`)
console.log(result.stats)
// {
//   bdnbBatimentsRecus: 142,
//   bdnbCandidatsExploitables: 87,
//   ignParcellesRecues: 0,
//   ignParcellesEligibles: 0,
//   candidatsAvantDedup: 87,
//   candidatsApresDedup: 84
// }
```

## Stratégie de filtrage

1. **Filtrage côté API** : `surface_activite_min=500` et
   `usage_principal_bdnb_open=tertiaire` directement dans la query
   string BDNB → on ne récupère que les bâtiments éligibles, on
   économise du transfert et de la latence.
2. **Filtrage côté code** : double check via `bdnbVersProspectCandidat`
   qui rejette à nouveau les bâtiments sous le seuil (au cas où l'API
   relâche le filtre sur certaines requêtes).
3. **Déduplication** : par SIRET propriétaire si présent, sinon par
   adresse normalisée. Évite qu'un même bâtiment apparaisse deux fois
   si on enrichit avec IGN.

## Gestion d'erreurs

Toutes les erreurs sont levées comme `SourcingError` avec un code
typé qui facilite le retry / le monitoring :

| Code | Cause | Stratégie |
|---|---|---|
| `INVALID_INPUT` | Code INSEE mal formé | Erreur de programmation, pas de retry |
| `TIMEOUT` | API > 15 s | Retry 1 fois avec backoff |
| `HTTP_ERROR` | 4xx/5xx ou erreur réseau | Retry sur 5xx uniquement |
| `PARSE_ERROR` | Réponse JSON invalide | Logger l'incident, ne pas retry |

## Tests

```powershell
cd 04_code
npm test
# 32 tests sourcing (cadastre-ign + bdnb + index)
```

Les tests utilisent des fixtures JSON dans `tests/fixtures/` et
mockent `fetch` via `vi.fn()`. Aucun appel réseau réel.

## Insertion Supabase (post-merge J2)

À l'heure où ce README est écrit, l'orchestrateur retourne juste
`ProspectCandidat[]`. L'insertion dans la table `prospects` sera
ajoutée après le merge de la PR J2 (qui pose les colonnes
`code_insee`, `nb_etages`, `siret_proprietaire`, `score`, `source`).

Pseudocode futur :

```typescript
const { candidats } = await sourceProspects({ codeInsee })
const { error } = await supabase
  .from('prospects')
  .upsert(candidats, { onConflict: 'siret_proprietaire' })
```
