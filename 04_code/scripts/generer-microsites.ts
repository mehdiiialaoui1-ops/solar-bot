/**
 * =============================================================================
 * ERE SOLAR BOT — Génération des microsites
 * =============================================================================
 * Crée une entrée dans la table `microsites` pour chaque prospect
 * en statut `solar_calculated` qui n'a pas encore de microsite.
 *
 * Usage :
 *   npx tsx scripts/generer-microsites.ts
 *   npx tsx scripts/generer-microsites.ts --publish   # Publie directement
 *   npx tsx scripts/generer-microsites.ts --dry-run   # Sans insertion
 * =============================================================================
 */

import 'dotenv/config'
import { createServerClient } from '../src/lib/supabase/client'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const PUBLISH = args.includes('--publish')

const OK = '\x1b[32m✓\x1b[0m'
const FAIL = '\x1b[31m✗\x1b[0m'
const INFO = '\x1b[36mℹ\x1b[0m'
const WARN = '\x1b[33m⚠\x1b[0m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

/**
 * Génère un slug URL-friendly à partir d'une adresse et commune.
 * Ex: "14 Rue de Montauban" + "Lyon 5e" → "14-rue-montauban-lyon-5e"
 */
function genererSlug(adresse: string, commune: string, id: string): string {
  const base = `${adresse} ${commune}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // enlever accents
    .replace(/[^a-z0-9\s-]/g, '')   // enlever caractères spéciaux
    .replace(/\b(rue|avenue|boulevard|quai|cours|place|impasse|chemin|allee|passage|de|du|des|le|la|les|l|d|et|en)\b/g, '') // mots inutiles
    .replace(/\s+/g, '-')           // espaces → tirets
    .replace(/-+/g, '-')            // tirets multiples → un seul
    .replace(/^-|-$/g, '')          // enlever tirets début/fin
    .slice(0, 50)                   // limiter la longueur

  // Ajouter les 4 premiers caractères de l'UUID pour unicité
  const suffix = id.slice(0, 4)
  return `${base}-${suffix}`
}

async function main() {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${BOLD}ERE SOLAR BOT — Génération des microsites${RESET}`)
  console.log(`  ${new Date().toLocaleString('fr-FR')}`)
  console.log(`${'═'.repeat(60)}`)

  if (DRY_RUN) console.log(`\n  ${WARN} MODE DRY-RUN : pas d'insertion`)
  if (PUBLISH) console.log(`  ${INFO} Mode publication directe activé`)

  const supabase = createServerClient()

  // 1. Récupérer les prospects avec calcul solaire
  const { data: prospects, error: pErr } = await supabase
    .from('prospects')
    .select(`
      id, adresse, commune, code_postal, surface_m2, usage,
      annee_construction, obligation_aper, obligation_dec_tert,
      statut, score
    `)
    .in('statut', ['solar_calculated', 'enriched', 'microsite_ready'])
    .order('score', { ascending: false })

  if (pErr) {
    console.error(`  ${FAIL} Erreur prospects: ${pErr.message}`)
    process.exit(1)
  }

  console.log(`\n  ${INFO} ${prospects.length} prospects éligibles trouvés`)

  // 2. Récupérer les microsites existants pour éviter les doublons
  const { data: existants } = await supabase
    .from('microsites')
    .select('prospect_id')

  const dejaFait = new Set((existants ?? []).map((m) => m.prospect_id))
  const aTraiter = prospects.filter((p) => !dejaFait.has(p.id))

  console.log(`  ${INFO} ${dejaFait.size} microsites existants, ${aTraiter.length} à créer\n`)

  if (aTraiter.length === 0) {
    console.log(`  ${OK} Rien à faire — tous les microsites existent déjà`)
    return
  }

  // 3. Récupérer les calculs solaires pour les images satellite
  const { data: calculs } = await supabase
    .from('calculs_solaires')
    .select('prospect_id, satellite_image_url, puissance_kwc, production_kwh_an, economie_annuelle_eur')
    .in('prospect_id', aTraiter.map((p) => p.id))
    .order('created_at', { ascending: false })

  const calculParProspect = new Map<string, typeof calculs extends (infer T)[] ? T : never>()
  for (const c of calculs ?? []) {
    if (!calculParProspect.has(c.prospect_id)) {
      calculParProspect.set(c.prospect_id, c)
    }
  }

  // 4. Générer les microsites
  let crees = 0
  let erreurs = 0

  for (const p of aTraiter) {
    const slug = genererSlug(p.adresse, p.commune, p.id)
    const calcul = calculParProspect.get(p.id)

    const titre = `Étude solaire — ${p.adresse}`
    const sousTitre = `${p.commune} | ${p.surface_m2.toLocaleString('fr-FR')} m² | ${calcul?.puissance_kwc ?? '?'} kWc`

    if (DRY_RUN) {
      console.log(`  ${INFO} [dry-run] ${slug}`)
      console.log(`     ${titre}`)
      crees++
      continue
    }

    const { error } = await supabase.from('microsites').insert({
      prospect_id: p.id,
      slug,
      url_publique: `/microsite/${slug}`,
      titre,
      sous_titre: sousTitre,
      image_satellite_url: calcul?.satellite_image_url ?? null,
      statut: PUBLISH ? 'published' : 'draft',
    })

    if (error) {
      console.log(`  ${FAIL} ${slug} — ${error.message}`)
      erreurs++
    } else {
      console.log(`  ${OK} ${slug}`)
      crees++
    }
  }

  // 5. Mettre à jour le statut des prospects
  if (!DRY_RUN && crees > 0) {
    const ids = aTraiter.slice(0, crees).map((p) => p.id)
    await supabase
      .from('prospects')
      .update({ statut: 'microsite_ready' })
      .in('id', ids)
  }

  // Résumé
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${BOLD}RÉSUMÉ${RESET}`)
  console.log(`${'═'.repeat(60)}`)
  console.log(`  Microsites créés : ${crees}`)
  if (erreurs > 0) console.log(`  ${FAIL} Erreurs : ${erreurs}`)
  console.log(`  Statut : ${PUBLISH ? 'published' : 'draft'}`)
  console.log(`${'═'.repeat(60)}\n`)
}

main().catch((err) => {
  console.error(`\n${FAIL} Erreur fatale:`, err)
  process.exit(1)
})
