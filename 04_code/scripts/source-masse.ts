/**
 * =============================================================================
 * ERE SOLAR BOT — Sourcing en masse
 * =============================================================================
 * Source les bâtiments tertiaires/industriels >= 500 m² depuis la BDNB,
 * calcule le potentiel solaire (PVGIS) et insère tout dans Supabase.
 *
 * Usage :
 *   npx tsx scripts/source-masse.ts                      # Tier 1 (4 communes)
 *   npx tsx scripts/source-masse.ts --tier 2             # Tier 1 + Tier 2
 *   npx tsx scripts/source-masse.ts --communes 69123,69259  # Communes spécifiques
 *   npx tsx scripts/source-masse.ts --dry-run             # Sans insertion Supabase
 *   npx tsx scripts/source-masse.ts --skip-solar          # Sans calcul PVGIS
 *   npx tsx scripts/source-masse.ts --limit 10            # Max 10 prospects/commune
 *
 * Throttling PVGIS : 1 requête toutes les 2 secondes (usage raisonnable).
 * =============================================================================
 */

import 'dotenv/config'
import { sourceProspects } from '../src/sourcing/index'
import { calculerPotentielSolaire } from '../src/solar/index'
import { insertPipelineComplet, calculerScore, compterProspectsParStatut } from '../src/db/prospects'
import type { ProspectCandidat } from '../src/sourcing/types'

// ============================================================================
// Configuration communes — Région pilote Métropole de Lyon
// ============================================================================

interface CommuneConfig {
  code: string
  nom: string
  tier: number
}

const COMMUNES: CommuneConfig[] = [
  // Tier 1 — Priorité absolue (lancement)
  // Lyon : 9 arrondissements avec codes INSEE distincts
  { code: '69381', nom: 'Lyon 1er', tier: 1 },
  { code: '69382', nom: 'Lyon 2e', tier: 1 },
  { code: '69383', nom: 'Lyon 3e', tier: 1 },
  { code: '69384', nom: 'Lyon 4e', tier: 1 },
  { code: '69385', nom: 'Lyon 5e', tier: 1 },
  { code: '69386', nom: 'Lyon 6e', tier: 1 },
  { code: '69387', nom: 'Lyon 7e', tier: 1 },
  { code: '69388', nom: 'Lyon 8e', tier: 1 },
  { code: '69389', nom: 'Lyon 9e', tier: 1 },
  // + code commune globale (certains bâtiments y sont rattachés)
  { code: '69123', nom: 'Lyon', tier: 1 },
  { code: '69259', nom: 'Vénissieux', tier: 1 },
  { code: '69199', nom: 'Saint-Priest', tier: 1 },
  { code: '69044', nom: 'Chassieu', tier: 1 },
  // Tier 2 — Expansion rapide (semaine 2-3)
  { code: '69256', nom: 'Vaulx-en-Velin', tier: 2 },
  { code: '69073', nom: 'Décines-Charpieu', tier: 2 },
  { code: '69069', nom: 'Corbas', tier: 2 },
  { code: '69282', nom: 'Meyzieu', tier: 2 },
  // Tier 3 — Réserve
  { code: '69266', nom: 'Villeurbanne', tier: 3 },
  { code: '69029', nom: 'Bron', tier: 3 },
  { code: '69194', nom: 'Saint-Fons', tier: 3 },
]

// ============================================================================
// Utilitaires CLI
// ============================================================================

const args = process.argv.slice(2)
function hasFlag(name: string): boolean {
  return args.includes(`--${name}`)
}
function getFlagValue(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`)
  return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined
}

const DRY_RUN = hasFlag('dry-run')
const SKIP_SOLAR = hasFlag('skip-solar')
const LIMIT = parseInt(getFlagValue('limit') ?? '0', 10) || 0
const TIER = parseInt(getFlagValue('tier') ?? '1', 10)
const COMMUNES_CUSTOM = getFlagValue('communes')?.split(',') ?? []

// Sélection des communes
function getCommunesCibles(): CommuneConfig[] {
  if (COMMUNES_CUSTOM.length > 0) {
    return COMMUNES.filter((c) => COMMUNES_CUSTOM.includes(c.code))
  }
  return COMMUNES.filter((c) => c.tier <= TIER)
}

// Throttle : attendre N ms
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Formatage
function pad(s: string, n: number): string {
  return s.padEnd(n)
}

// ============================================================================
// Couleurs terminal
// ============================================================================

const OK = '\x1b[32m✓\x1b[0m'
const FAIL = '\x1b[31m✗\x1b[0m'
const WARN = '\x1b[33m⚠\x1b[0m'
const INFO = '\x1b[36mℹ\x1b[0m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

// ============================================================================
// Statistiques globales
// ============================================================================

interface Stats {
  communesTraitees: number
  communesEchouees: number
  batimentsSourcesTotal: number
  candidatsExploitablesTotal: number
  candidatsApresDedup: number
  solairesCalcules: number
  solairesEchoues: number
  prospectsInseres: number
  prospectsMAJ: number
  insertionsEchouees: number
  tempsDebutMs: number
}

const stats: Stats = {
  communesTraitees: 0,
  communesEchouees: 0,
  batimentsSourcesTotal: 0,
  candidatsExploitablesTotal: 0,
  candidatsApresDedup: 0,
  solairesCalcules: 0,
  solairesEchoues: 0,
  prospectsInseres: 0,
  prospectsMAJ: 0,
  insertionsEchouees: 0,
  tempsDebutMs: Date.now(),
}

// ============================================================================
// Traitement d'un prospect individuel
// ============================================================================

async function traiterProspect(
  candidat: ProspectCandidat,
  index: number,
  total: number,
): Promise<boolean> {
  const prefix = `  [${String(index + 1).padStart(3)}/${total}]`
  const label = `${candidat.surface_m2.toFixed(0)} m² | ${candidat.usage} | ${candidat.commune}`

  // 1. Calcul solaire (sauf si --skip-solar)
  let potentiel = null
  if (!SKIP_SOLAR) {
    try {
      potentiel = await calculerPotentielSolaire({
        lat: candidat.lat,
        lng: candidat.lng,
        surfaceToitureM2: candidat.surface_m2,
      })
      stats.solairesCalcules++
    } catch (err) {
      const msg = (err as Error).message
      process.stdout.write(`${prefix} ${WARN} PVGIS échoué (${label}) : ${msg.slice(0, 80)}\n`)
      stats.solairesEchoues++
    }
    // Throttle PVGIS : 2s entre chaque appel
    await sleep(2000)
  }

  // 2. Insertion Supabase (sauf si --dry-run)
  if (DRY_RUN) {
    const score = calculerScore(candidat)
    process.stdout.write(`${prefix} ${INFO} [dry-run] ${label} | score=${score}`)
    if (potentiel) {
      process.stdout.write(` | ${potentiel.puissance_kwc} kWc | ${potentiel.economie_annuelle_eur.toFixed(0)} €/an`)
    }
    process.stdout.write('\n')
    return true
  }

  try {
    const result = await insertPipelineComplet(candidat, potentiel)
    if (result.prospect.isNew) {
      stats.prospectsInseres++
    } else {
      stats.prospectsMAJ++
    }

    const score = calculerScore(candidat)
    process.stdout.write(`${prefix} ${OK} ${pad(candidat.parcelle_id ?? '?', 25)} | ${label} | score=${score}`)
    if (potentiel) {
      process.stdout.write(` | ${potentiel.puissance_kwc} kWc`)
    }
    process.stdout.write('\n')
    return true
  } catch (err) {
    const msg = (err as Error).message
    process.stdout.write(`${prefix} ${FAIL} Insertion échouée (${label}) : ${msg.slice(0, 80)}\n`)
    stats.insertionsEchouees++
    return false
  }
}

// ============================================================================
// Traitement d'une commune
// ============================================================================

async function traiterCommune(commune: CommuneConfig): Promise<void> {
  console.log(`\n${BOLD}━━━ ${commune.nom} (${commune.code}) — Tier ${commune.tier} ━━━${RESET}`)

  // 1. Sourcing BDNB
  let candidats: ProspectCandidat[]
  try {
    const result = await sourceProspects({
      codeInsee: commune.code,
      commune: commune.nom,
      surfaceMinM2: 500,
    })

    stats.batimentsSourcesTotal += result.stats.bdnbBatimentsRecus
    stats.candidatsExploitablesTotal += result.stats.bdnbCandidatsExploitables
    stats.candidatsApresDedup += result.stats.candidatsApresDedup
    candidats = result.candidats

    console.log(`  ${OK} BDNB : ${result.stats.bdnbBatimentsRecus} bâtiments → ${result.stats.candidatsApresDedup} candidats`)
  } catch (err) {
    const msg = (err as Error).message
    console.log(`  ${FAIL} BDNB échoué pour ${commune.nom} : ${msg.slice(0, 100)}`)
    stats.communesEchouees++
    return
  }

  if (candidats.length === 0) {
    console.log(`  ${WARN} Aucun candidat exploitable pour ${commune.nom}`)
    stats.communesTraitees++
    return
  }

  // Limiter si --limit
  if (LIMIT > 0 && candidats.length > LIMIT) {
    console.log(`  ${INFO} Limité à ${LIMIT} prospects (${candidats.length} disponibles)`)
    candidats = candidats.slice(0, LIMIT)
  }

  // 2. Traiter chaque prospect
  console.log(`  ${INFO} Traitement de ${candidats.length} prospects...`)
  if (!SKIP_SOLAR) {
    console.log(`  ${INFO} Throttle PVGIS : ~${candidats.length * 2}s estimé`)
  }

  for (let i = 0; i < candidats.length; i++) {
    await traiterProspect(candidats[i], i, candidats.length)
  }

  stats.communesTraitees++
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  const communes = getCommunesCibles()

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${BOLD}ERE SOLAR BOT — Sourcing en masse${RESET}`)
  console.log(`  ${new Date().toLocaleString('fr-FR')}`)
  console.log(`${'═'.repeat(60)}`)

  console.log(`\n  ${INFO} Communes ciblées : ${communes.map((c) => c.nom).join(', ')}`)
  console.log(`  ${INFO} Tier max : ${TIER}`)
  if (LIMIT > 0) console.log(`  ${INFO} Limite : ${LIMIT} prospects/commune`)
  if (DRY_RUN) console.log(`  ${WARN} MODE DRY-RUN : pas d'insertion Supabase`)
  if (SKIP_SOLAR) console.log(`  ${WARN} MODE SKIP-SOLAR : pas de calcul PVGIS`)

  // Vérif variables .env
  const checks = [
    ['NEXT_PUBLIC_SUPABASE_URL', !DRY_RUN],
    ['SUPABASE_SERVICE_ROLE_KEY', !DRY_RUN],
  ] as const

  for (const [varName, required] of checks) {
    if (required && !process.env[varName]) {
      console.error(`\n  ${FAIL} Variable manquante : ${varName}`)
      process.exit(1)
    }
  }

  // Lancer le traitement
  for (const commune of communes) {
    await traiterCommune(commune)
  }

  // ============================================================================
  // Résumé final
  // ============================================================================

  const dureeMs = Date.now() - stats.tempsDebutMs
  const dureeSec = Math.round(dureeMs / 1000)
  const dureeMin = Math.floor(dureeSec / 60)
  const dureeSecReste = dureeSec % 60

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${BOLD}RÉSUMÉ${RESET}`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Durée            : ${dureeMin}min ${dureeSecReste}s`)
  console.log(`  Communes traitées: ${stats.communesTraitees}/${communes.length}${stats.communesEchouees > 0 ? ` (${stats.communesEchouees} échouées)` : ''}`)
  console.log(`  Bâtiments BDNB   : ${stats.batimentsSourcesTotal}`)
  console.log(`  Candidats valides: ${stats.candidatsExploitablesTotal}`)
  console.log(`  Après déduplica. : ${stats.candidatsApresDedup}`)
  if (!SKIP_SOLAR) {
    console.log(`  Calculs solaires : ${stats.solairesCalcules} OK / ${stats.solairesEchoues} échoués`)
  }
  if (!DRY_RUN) {
    console.log(`  Prospects insérés: ${stats.prospectsInseres} nouveaux / ${stats.prospectsMAJ} mis à jour`)
    if (stats.insertionsEchouees > 0) {
      console.log(`  ${FAIL} Insertions échouées : ${stats.insertionsEchouees}`)
    }
  }

  // Comptage final en base
  if (!DRY_RUN && stats.prospectsInseres + stats.prospectsMAJ > 0) {
    try {
      const comptage = await compterProspectsParStatut()
      const total = Object.values(comptage).reduce((a, b) => a + b, 0)
      console.log(`\n  ${INFO} Total en base Supabase : ${total} prospects`)
      for (const [statut, count] of Object.entries(comptage).sort((a, b) => b[1] - a[1])) {
        console.log(`     ${statut.padEnd(20)} : ${count}`)
      }
    } catch {
      // pas grave si le comptage échoue
    }
  }

  console.log(`\n${'═'.repeat(60)}\n`)
}

main().catch((err) => {
  console.error(`\n${FAIL} Erreur fatale :`, err)
  process.exit(1)
})
