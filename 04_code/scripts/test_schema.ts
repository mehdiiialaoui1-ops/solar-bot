/**
 * =============================================================================
 * ERE SOLAR BOT - Smoke test schema Supabase (post migration 002)
 * =============================================================================
 * Objectif : valider que la migration 002_align_schema_with_specs est bien
 * appliquee en prod et que les nouveaux champs (code_insee, score, source,
 * siret_proprietaire, nb_etages) ainsi que la nouvelle contrainte d'enum
 * statut acceptent les insertions attendues.
 *
 * Usage :
 *   cd 04_code
 *   npm run test:schema
 *
 * Pre-requis : variables NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY
 * definies dans 04_code/.env.local (deja le cas depuis J1).
 *
 * Le script s'auto-nettoie : toute ligne creee est supprimee en fin
 * d'execution via un try/finally, y compris en cas d'erreur intermediaire.
 * =============================================================================
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Database } from '../src/types/database'

// ----------------------------------------------------------------------------
// Chargement minimal des variables d'environnement depuis .env.local
// (evite d'ajouter une dependance dotenv pour un simple script one-shot)
// ----------------------------------------------------------------------------
function loadEnvLocal(): void {
  // On teste plusieurs chemins pour etre robuste que ce soit lance depuis
  // 04_code/ (via npm run) ou depuis la racine du projet.
  const candidates = [
    resolve(process.cwd(), '.env.local'),
    resolve(process.cwd(), '04_code', '.env.local'),
    resolve(process.cwd(), 'solar-bot', '04_code', '.env.local'),
  ]
  let loaded = false
  for (const envPath of candidates) {
    try {
      const content = readFileSync(envPath, 'utf8')
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim()
        if (!line || line.startsWith('#')) continue
        const eq = line.indexOf('=')
        if (eq === -1) continue
        const key = line.slice(0, eq).trim()
        const value = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '')
        if (!(key in process.env)) {
          process.env[key] = value
        }
      }
      console.log(`[env] Charge ${envPath}`)
      loaded = true
      break
    } catch {
      // chemin suivant
    }
  }
  if (!loaded) {
    console.warn('[warn] .env.local introuvable (essaye :', candidates.join(' | '), ')')
  }
}

loadEnvLocal()

// Diagnostic : lister les cles chargees qui concernent Supabase
const supabaseKeys = Object.keys(process.env).filter((k) =>
  k.includes('SUPABASE') || k.includes('SUPBASE'),
)
console.log('[env] Cles Supabase detectees :', supabaseKeys.length ? supabaseKeys : '(aucune)')

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[erreur] Variables Supabase manquantes (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).')
  console.error('         URL present :', !!SUPABASE_URL)
  console.error('         SERVICE_ROLE present :', !!SUPABASE_SERVICE_ROLE_KEY)
  process.exit(1)
}

const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ----------------------------------------------------------------------------
// Assertions minimales
// ----------------------------------------------------------------------------
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) {
    throw new Error(`Assertion echouee : ${msg}`)
  }
}

// ----------------------------------------------------------------------------
// Donnees de test - valeurs neutres, facilement identifiables pour nettoyage
// ----------------------------------------------------------------------------
const TEST_MARKER = `smoke-test-j2-${Date.now()}`
const createdIds: string[] = []

async function main(): Promise<void> {
  console.log('[smoke] Demarrage smoke test schema Supabase')
  console.log(`[smoke] Marker : ${TEST_MARKER}`)
  console.log(`[smoke] URL    : ${SUPABASE_URL}`)

  // --------------------------------------------------------------------------
  // 1. INSERT d'un prospect avec tous les nouveaux champs
  // --------------------------------------------------------------------------
  console.log('\n[1] INSERT prospects avec nouveaux champs...')
  const insertPayload: Database['public']['Tables']['prospects']['Insert'] = {
    adresse: `1 test street ${TEST_MARKER}`,
    code_postal: '75001',
    commune: 'Paris',
    lat: 48.8566,
    lng: 2.3522,
    surface_m2: 1250,
    usage: 'tertiaire',
    statut: 'new',
    // Nouveaux champs issus de la migration 002
    code_insee: '75101',
    nb_etages: 4,
    siret_proprietaire: '12345678900001',
    score: 78,
    source: 'ign_cadastre',
  }

  const { data: inserted, error: insertErr } = await supabase
    .from('prospects')
    .insert(insertPayload)
    .select('*')
    .single()

  if (insertErr) throw new Error(`INSERT echoue : ${insertErr.message}`)
  assert(inserted, 'Pas de ligne retournee apres INSERT')
  createdIds.push(inserted.id)

  console.log(`    OK - Prospect cree id=${inserted.id}`)
  assert(inserted.code_insee === '75101', 'code_insee mal persiste')
  assert(inserted.score === 78, 'score mal persiste')
  assert(inserted.source === 'ign_cadastre', 'source mal persiste')
  assert(inserted.siret_proprietaire === '12345678900001', 'siret_proprietaire mal persiste')
  assert(inserted.nb_etages === 4, 'nb_etages mal persiste')

  // --------------------------------------------------------------------------
  // 2. UPDATE - statut 'qualified' (nouveau statut issu de la migration 002)
  // --------------------------------------------------------------------------
  console.log("\n[2] UPDATE statut vers 'qualified' (valeur ajoutee en 002)...")
  const { error: updErr } = await supabase
    .from('prospects')
    .update({ statut: 'qualified', score: 92 })
    .eq('id', inserted.id)

  if (updErr) throw new Error(`UPDATE echoue : ${updErr.message}`)

  const { data: refetched, error: refetchErr } = await supabase
    .from('prospects')
    .select('statut, score')
    .eq('id', inserted.id)
    .single()

  if (refetchErr) throw new Error(`SELECT post-UPDATE echoue : ${refetchErr.message}`)
  assert(refetched?.statut === 'qualified', 'statut non mis a jour vers qualified')
  assert(refetched?.score === 92, 'score non mis a jour')
  console.log('    OK - statut=qualified accepte par le CHECK')

  // --------------------------------------------------------------------------
  // 3. Contrainte score (0-100) refuse 150
  // --------------------------------------------------------------------------
  console.log('\n[3] CHECK score hors bornes (doit echouer)...')
  const { error: badScoreErr } = await supabase
    .from('prospects')
    .update({ score: 150 })
    .eq('id', inserted.id)

  assert(badScoreErr, 'UPDATE score=150 aurait du etre rejete')
  console.log(`    OK - Rejet attendu : ${badScoreErr?.message}`)

  // --------------------------------------------------------------------------
  // 4. Contrainte statut refuse une valeur inconnue
  // --------------------------------------------------------------------------
  console.log('\n[4] CHECK statut valeur inconnue (doit echouer)...')
  const { error: badStatutErr } = await supabase
    .from('prospects')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ statut: 'inconnu' as any })
    .eq('id', inserted.id)

  assert(badStatutErr, "UPDATE statut='inconnu' aurait du etre rejete")
  console.log(`    OK - Rejet attendu : ${badStatutErr?.message}`)

  console.log('\n[smoke] Tous les checks sont passes.')
}

async function cleanup(): Promise<void> {
  if (createdIds.length === 0) return
  console.log(`\n[cleanup] Suppression de ${createdIds.length} ligne(s) test...`)
  const { error } = await supabase.from('prospects').delete().in('id', createdIds)
  if (error) {
    console.error(`[cleanup] Erreur de suppression : ${error.message}`)
    return
  }
  console.log(`[cleanup] OK - ${createdIds.length} ligne(s) supprimee(s)`)
}

async function run(): Promise<void> {
  try {
    await main()
  } catch (err) {
    console.error('[smoke] Echec :', err instanceof Error ? err.message : err)
    process.exitCode = 1
  } finally {
    try {
      await cleanup()
    } catch (cleanupErr) {
      console.error('[cleanup] Erreur :', cleanupErr instanceof Error ? cleanupErr.message : cleanupErr)
    }
  }
}

run()
