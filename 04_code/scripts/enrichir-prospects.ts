#!/usr/bin/env tsx
/**
 * =============================================================================
 * ERE SOLAR BOT — Script d'enrichissement en masse (SOL-24)
 * =============================================================================
 * Enrichit les prospects existants en base Supabase avec :
 *   - Données entreprise (SIRENE / Annuaire des Entreprises)
 *   - Emails décideurs (Hunter.io domain-search department=executive)
 *   - Patterns email fallback si Hunter ne trouve rien
 *
 * URGENT : Hunter.io reset son quota gratuit le 1er mai 2026 (25 domain-search/mois).
 * Ce script optimise les requêtes en groupant les prospects par SIRET propriétaire :
 * un même SIRET = un seul appel Hunter, contacts partagés entre prospects.
 *
 * SÉCURITÉ : par défaut, mode DRY-RUN (n'écrit rien en base). Utiliser --apply
 * pour réellement insérer dans outreach_contacts.
 *
 * Usage :
 *   npx tsx scripts/enrichir-prospects.ts                  # dry-run, montre le plan
 *   npx tsx scripts/enrichir-prospects.ts --apply          # exécute pour de vrai
 *   npx tsx scripts/enrichir-prospects.ts --limit 10       # max 10 groupes SIRET
 *   npx tsx scripts/enrichir-prospects.ts --max-hunter 20  # max 20 requêtes Hunter
 *   npx tsx scripts/enrichir-prospects.ts --siret 552032534 # 1 SIRET seulement
 *
 * Env requis :
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   HUNTER_API_KEY                  (optionnel : skip si absent)
 *   INSEE_CONSUMER_KEY/SECRET       (optionnel : Annuaire des Entreprises en fallback)
 * =============================================================================
 */

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { enrichirProspect, type ProspectEnrichi } from '../src/enrichissement'

// ----------------------------------------------------------------------------
// Helpers console (cohérent avec test-pipeline.ts de Mehdi)
// ----------------------------------------------------------------------------
const OK = '\x1b[32m✓\x1b[0m'
const FAIL = '\x1b[31m✗\x1b[0m'
const INFO = '\x1b[36mℹ\x1b[0m'
const WARN = '\x1b[33m⚠\x1b[0m'
const SEP = '─'.repeat(70)

function log(icon: string, msg: string) {
  console.log(`  ${icon} ${msg}`)
}

function section(titre: string) {
  console.log()
  console.log(SEP)
  console.log(`  ${titre}`)
  console.log(SEP)
}

// ----------------------------------------------------------------------------
// Parse args
// ----------------------------------------------------------------------------
const args = process.argv.slice(2)
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`)
  if (idx === -1) return fallback
  return args[idx + 1] ?? fallback
}
const hasFlag = (name: string) => args.includes(`--${name}`)

const APPLY = hasFlag('apply')
const LIMIT = parseInt(getArg('limit', '50'), 10)
const MAX_HUNTER = parseInt(getArg('max-hunter', '20'), 10)
const SIRET_FILTRE = getArg('siret', '')

// ----------------------------------------------------------------------------
// Validation env
// ----------------------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const HUNTER_KEY = process.env.HUNTER_API_KEY
const INSEE_KEY = process.env.INSEE_CONSUMER_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(`${FAIL} Variables Supabase manquantes (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)`)
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
interface ProspectRow {
  id: string
  adresse: string
  code_postal: string | null
  commune: string | null
  lat: number | null
  lng: number | null
  siret_proprietaire: string | null
  raison_sociale: string | null
  surface_m2: number | null
  score: number | null
  statut: string
}

interface GroupeSiret {
  siret: string
  prospects: ProspectRow[]
  /** Score le plus élevé du groupe (priorité) */
  scoreMax: number
}

interface ResultatEnrichissement {
  siret: string
  nbProspects: number
  enrichi: ProspectEnrichi | null
  erreur: string | null
  contactsInseres: number
}

// ----------------------------------------------------------------------------
// Étape 1 — Charger les prospects sans contact
// ----------------------------------------------------------------------------
async function chargerProspectsAEnrichir(): Promise<ProspectRow[]> {
  // Récupère les IDs des prospects déjà liés à un contact
  const { data: dejaContactes, error: errIds } = await supabase
    .from('outreach_contacts')
    .select('prospect_id')

  if (errIds) {
    throw new Error(`Erreur lookup outreach_contacts : ${errIds.message}`)
  }
  const idsExclus = new Set((dejaContactes ?? []).map((r) => r.prospect_id))

  // Récupère les prospects en statut new ou solar_calculated, triés par score
  const { data, error } = await supabase
    .from('prospects')
    .select(
      'id, adresse, code_postal, commune, lat, lng, siret_proprietaire, raison_sociale, surface_m2, score, statut',
    )
    .in('statut', ['new', 'enriched', 'solar_calculated'])
    .order('score', { ascending: false, nullsFirst: false })

  if (error) {
    throw new Error(`Erreur SELECT prospects : ${error.message}`)
  }

  return (data ?? []).filter((p) => !idsExclus.has(p.id))
}

// ----------------------------------------------------------------------------
// Étape 2 — Grouper par SIRET
// ----------------------------------------------------------------------------
function grouperParSiret(prospects: ProspectRow[]): GroupeSiret[] {
  const map = new Map<string, ProspectRow[]>()
  for (const p of prospects) {
    if (!p.siret_proprietaire) continue // skip prospects sans SIRET
    const cle = p.siret_proprietaire.slice(0, 9) // SIREN = 9 premiers chiffres du SIRET
    const groupe = map.get(cle) ?? []
    groupe.push(p)
    map.set(cle, groupe)
  }
  const groupes: GroupeSiret[] = []
  for (const [siret, ps] of map.entries()) {
    const scoreMax = Math.max(...ps.map((p) => p.score ?? 0))
    groupes.push({ siret, prospects: ps, scoreMax })
  }
  // Trie par score max décroissant (priorité aux gros prospects)
  groupes.sort((a, b) => b.scoreMax - a.scoreMax)
  return groupes
}

// ----------------------------------------------------------------------------
// Étape 3 — Enrichir un groupe SIRET (1 appel Hunter pour N prospects)
// ----------------------------------------------------------------------------
async function enrichirGroupe(groupe: GroupeSiret): Promise<ProspectEnrichi | null> {
  // Prend le prospect avec le score le plus élevé comme représentant
  const representant = groupe.prospects.reduce((a, b) =>
    (a.score ?? 0) >= (b.score ?? 0) ? a : b,
  )

  return await enrichirProspect({
    prospect: {
      adresse: representant.adresse,
      code_postal: representant.code_postal ?? undefined,
      lat: representant.lat ?? undefined,
      lng: representant.lng ?? undefined,
      siren: groupe.siret,
    },
    inseeApiKey: INSEE_KEY,
    hunterApiKey: HUNTER_KEY,
  })
}

// ----------------------------------------------------------------------------
// Étape 4 — Insérer les contacts (mode --apply uniquement)
// ----------------------------------------------------------------------------
async function insererContacts(
  groupe: GroupeSiret,
  enrichi: ProspectEnrichi,
): Promise<number> {
  if (enrichi.emails.length === 0 && enrichi.dirigeants.length === 0) {
    return 0
  }

  // Construit les rows outreach_contacts : 1 par (prospect, email)
  const rows: Array<Record<string, unknown>> = []

  for (const prospect of groupe.prospects) {
    // Préférer les emails Hunter.io
    if (enrichi.emails.length > 0) {
      const top = enrichi.emails[0] // l'email le plus pertinent
      rows.push({
        prospect_id: prospect.id,
        prenom: top.prenom ?? null,
        nom: top.nom ?? '',
        titre: top.poste ?? null,
        email_pro: top.email,
        email_verifie: top.confidence >= 70,
        source: 'hunter',
        rang_ciblage: 1,
        actif: true,
      })
    } else if (enrichi.dirigeants.length > 0) {
      // Pas d'email mais on a un dirigeant -> on note le contact sans email
      const d = enrichi.dirigeants[0]
      rows.push({
        prospect_id: prospect.id,
        prenom: d.prenom ?? null,
        nom: d.nom ?? '',
        titre: d.qualite ?? null,
        email_pro: null,
        email_verifie: false,
        source: 'sirene',
        rang_ciblage: 1,
        actif: false, // pas d'email = pas envoyable
      })
    }
  }

  if (rows.length === 0) return 0

  const { error } = await supabase.from('outreach_contacts').insert(rows)
  if (error) {
    throw new Error(`Erreur INSERT outreach_contacts : ${error.message}`)
  }

  // Met à jour le statut des prospects à 'enriched'
  const ids = groupe.prospects.map((p) => p.id)
  await supabase.from('prospects').update({ statut: 'enriched' }).in('id', ids)

  return rows.length
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  section('🎯 Enrichissement prospects — SOL-24')
  log(INFO, `Mode : ${APPLY ? '\x1b[31mAPPLY (écriture DB)\x1b[0m' : '\x1b[32mDRY-RUN (lecture seule)\x1b[0m'}`)
  log(INFO, `Limite groupes : ${LIMIT}`)
  log(INFO, `Max Hunter requests : ${MAX_HUNTER}`)
  log(INFO, `Hunter API : ${HUNTER_KEY ? 'configurée' : '\x1b[33mABSENTE\x1b[0m (patterns seulement)'}`)
  log(INFO, `SIRENE INSEE : ${INSEE_KEY ? 'configurée' : '\x1b[33mABSENTE\x1b[0m (Annuaire fallback)'}`)
  if (SIRET_FILTRE) log(INFO, `Filtre SIRET : ${SIRET_FILTRE}`)

  // 1. Chargement
  section('1. Chargement des prospects')
  const prospects = await chargerProspectsAEnrichir()
  log(OK, `${prospects.length} prospects sans contact (statut new/enriched/solar_calculated)`)

  if (prospects.length === 0) {
    log(WARN, 'Aucun prospect à enrichir. Exit.')
    return
  }

  // 2. Groupement
  section('2. Groupement par SIREN propriétaire')
  let groupes = grouperParSiret(prospects)
  if (SIRET_FILTRE) {
    const sirenFiltre = SIRET_FILTRE.slice(0, 9)
    groupes = groupes.filter((g) => g.siret === sirenFiltre)
  }

  log(OK, `${groupes.length} SIREN uniques`)
  log(INFO, `Économie Hunter : ${prospects.length} prospects → ${groupes.length} requêtes (×${(prospects.length / Math.max(groupes.length, 1)).toFixed(1)})`)

  const sansSiret = prospects.length - groupes.reduce((s, g) => s + g.prospects.length, 0)
  if (sansSiret > 0) {
    log(WARN, `${sansSiret} prospects sans siret_proprietaire — ignorés`)
  }

  // 3. Plan d'enrichissement
  const aTraiter = groupes.slice(0, Math.min(LIMIT, MAX_HUNTER))
  section(`3. Plan : ${aTraiter.length} groupes SIREN seront enrichis`)
  console.log()
  console.log('  rang  SIREN       prospects  score  raison sociale')
  console.log('  ' + '─'.repeat(66))
  for (let i = 0; i < aTraiter.length; i++) {
    const g = aTraiter[i]
    const rs = g.prospects[0].raison_sociale ?? '(inconnu)'
    console.log(
      `  ${String(i + 1).padStart(3)}.  ${g.siret}   ${String(g.prospects.length).padStart(8)}   ${String(g.scoreMax).padStart(4)}   ${rs.slice(0, 40)}`,
    )
  }

  if (!APPLY) {
    section('🛑 DRY-RUN : aucune écriture en base')
    log(INFO, 'Pour exécuter pour de vrai : ajouter --apply')
    return
  }

  // 4. Exécution réelle
  section('4. Enrichissement en cours...')
  const resultats: ResultatEnrichissement[] = []
  let hunterUsed = 0

  for (let i = 0; i < aTraiter.length; i++) {
    const g = aTraiter[i]
    const prefix = `[${i + 1}/${aTraiter.length}] SIREN ${g.siret}`
    try {
      const enrichi = await enrichirGroupe(g)
      if (HUNTER_KEY) hunterUsed++

      let contactsInseres = 0
      if (enrichi) {
        contactsInseres = await insererContacts(g, enrichi)
      }

      resultats.push({
        siret: g.siret,
        nbProspects: g.prospects.length,
        enrichi,
        erreur: null,
        contactsInseres,
      })

      const dirigeants = enrichi?.dirigeants.length ?? 0
      const emails = enrichi?.emails.length ?? 0
      log(
        OK,
        `${prefix} : ${dirigeants} dirigeant(s), ${emails} email(s), ${contactsInseres} contact(s) inséré(s)`,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      resultats.push({
        siret: g.siret,
        nbProspects: g.prospects.length,
        enrichi: null,
        erreur: msg,
        contactsInseres: 0,
      })
      log(FAIL, `${prefix} : ${msg}`)
    }
  }

  // 5. Synthèse
  section('5. Synthèse')
  const succes = resultats.filter((r) => r.contactsInseres > 0).length
  const echec = resultats.filter((r) => r.erreur).length
  const totalContacts = resultats.reduce((s, r) => s + r.contactsInseres, 0)

  log(OK, `${succes}/${aTraiter.length} groupes enrichis avec succès`)
  log(echec > 0 ? FAIL : OK, `${echec} erreurs`)
  log(INFO, `${totalContacts} contacts insérés dans outreach_contacts`)
  log(INFO, `${hunterUsed} requêtes Hunter.io consommées (quota mensuel : 25)`)
  if (hunterUsed >= 20) {
    log(WARN, 'Quota Hunter quasi-épuisé — attendre le 1er du mois pour reset')
  }

  console.log()
  console.log(SEP)
  console.log('  Terminé.')
  console.log(SEP)
}

main().catch((err) => {
  console.error(`${FAIL} Échec script :`, err)
  process.exit(1)
})
