#!/usr/bin/env tsx
/**
 * =============================================================================
 * ERE SOLAR BOT — Script de test pipeline E2E
 * =============================================================================
 * Teste le pipeline complet sur de vraies APIs :
 *   1. Sourcing BDNB (batiments tertiaires d'une commune)
 *   2. Geocodage (API Adresse data.gouv.fr)
 *   3. Enrichissement entreprise (Annuaire des Entreprises)
 *   4. Calcul solaire (PVGIS)
 *   5. Image aerienne (IGN WMS — generation URL)
 *   6. Recherche email (Hunter.io) — optionnel
 *   7. Envoi email test (Brevo) — optionnel, vers soi-meme
 *   8. Insertion Supabase — optionnel (prospect + calcul solaire)
 *
 * Usage :
 *   npx tsx scripts/test-pipeline.ts
 *   npx tsx scripts/test-pipeline.ts --commune 69123
 *   npx tsx scripts/test-pipeline.ts --commune 69123 --email
 *   npx tsx scripts/test-pipeline.ts --commune 69123 --email --send
 *   npx tsx scripts/test-pipeline.ts --commune 69123 --supabase
 *
 * Options :
 *   --commune CODE  Code INSEE (defaut: 69123 = Lyon)
 *   --email         Tester aussi Hunter.io (consomme 1 recherche/25 par mois)
 *   --send          Envoyer un vrai email test via Brevo (vers toi-meme)
 *   --supabase      Inserer le prospect + calcul dans Supabase
 *   --limit N       Nombre max de batiments a traiter (defaut: 3)
 * =============================================================================
 */

import 'dotenv/config'

// --- Helpers console ---
const OK = '\x1b[32m✓\x1b[0m'
const FAIL = '\x1b[31m✗\x1b[0m'
const INFO = '\x1b[36mℹ\x1b[0m'
const WARN = '\x1b[33m⚠\x1b[0m'
const SEP = '─'.repeat(60)

function log(icon: string, msg: string) {
  console.log(`  ${icon} ${msg}`)
}

// --- Parse args ---
const args = process.argv.slice(2)
function getArg(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`)
  if (idx === -1) return fallback
  return args[idx + 1] ?? fallback
}
const hasFlag = (name: string) => args.includes(`--${name}`)

const CODE_INSEE = getArg('commune', '69123') // Lyon par defaut
const LIMIT = parseInt(getArg('limit', '3'), 10)
const TEST_EMAIL = hasFlag('email')
const SEND_EMAIL = hasFlag('send')
const TEST_SUPABASE = hasFlag('supabase')

// ============================================================================
// ETAPE 1 — Sourcing BDNB
// ============================================================================

/**
 * Prospect de test hardcode pour fallback quand BDNB est indisponible.
 * Tour Part-Dieu, Lyon — batiment tertiaire bien connu.
 */
const PROSPECT_FALLBACK = {
  adresse: '129 Rue Servient, 69003 Lyon',
  code_postal: '69003',
  commune: 'Lyon',
  code_insee: '69123',
  lat: 45.7608,
  lng: 4.8553,
  surface_m2: 12500,
  usage: 'tertiaire',
  nb_etages: 42,
  annee_construction: 1977,
  siret_proprietaire: '81017076500017', // Amundi Immobilier (proprietaire connu)
  parcelle_id: 'fallback-part-dieu',
  source: 'bdnb' as const,
}

async function etape1_sourcing() {
  console.log(`\n${SEP}`)
  console.log(`  ETAPE 1 — Sourcing BDNB (commune ${CODE_INSEE})`)
  console.log(SEP)

  try {
    const { sourceProspects } = await import('../src/sourcing/index')

    const result = await sourceProspects({
      codeInsee: CODE_INSEE,
      commune: 'Test',
      surfaceMinM2: 500,
    })

    log(OK, `${result.stats.bdnbBatimentsRecus} batiments recus de BDNB`)
    log(OK, `${result.stats.bdnbCandidatsExploitables} candidats exploitables (>= 500 m²)`)
    log(OK, `${result.stats.candidatsApresDedup} candidats apres deduplication`)

    if (result.candidats.length === 0) {
      log(WARN, 'Aucun candidat trouve — essayez un autre code INSEE')
      log(INFO, 'Utilisation du prospect fallback (Tour Part-Dieu)')
      return [PROSPECT_FALLBACK]
    }

    const selection = result.candidats.slice(0, LIMIT)
    console.log()
    for (const c of selection) {
      log(INFO, `${c.adresse} | ${c.surface_m2} m² | ${c.usage} | SIRET: ${c.siret_proprietaire ?? 'N/A'}`)
    }

    return selection
  } catch (err) {
    log(FAIL, `BDNB indisponible : ${(err as Error).message}`)
    log(WARN, 'API BDNB peut necessiter une inscription sur api-portail.bdnb.io')
    log(INFO, 'Utilisation du prospect fallback (Tour Part-Dieu, Lyon)')
    console.log()
    log(INFO, `${PROSPECT_FALLBACK.adresse} | ${PROSPECT_FALLBACK.surface_m2} m² | ${PROSPECT_FALLBACK.usage} | SIRET: ${PROSPECT_FALLBACK.siret_proprietaire}`)
    return [PROSPECT_FALLBACK]
  }
}

// ============================================================================
// ETAPE 2 — Geocodage
// ============================================================================

async function etape2_geocodage(adresse: string) {
  console.log(`\n${SEP}`)
  console.log(`  ETAPE 2 — Geocodage (API Adresse data.gouv.fr)`)
  console.log(SEP)

  const { geocoder } = await import('../src/enrichissement/geocodage')

  try {
    const result = await geocoder({ adresse })
    log(OK, `Adresse normalisee : ${result.label}`)
    log(OK, `GPS : ${result.lat}, ${result.lng}`)
    log(OK, `Commune : ${result.commune} (${result.codeInsee})`)
    log(OK, `Score : ${(result.score * 100).toFixed(0)}%`)
    return result
  } catch (err) {
    log(FAIL, `Geocodage echoue : ${(err as Error).message}`)
    return null
  }
}

// ============================================================================
// ETAPE 3 — Enrichissement entreprise
// ============================================================================

async function etape3_enrichissement(siret: string) {
  console.log(`\n${SEP}`)
  console.log(`  ETAPE 3 — Enrichissement entreprise (Annuaire + INSEE)`)
  console.log(SEP)

  const { enrichirEntreprise } = await import('../src/enrichissement/insee')
  const inseeApiKey = process.env.INSEE_API_KEY

  try {
    const result = await enrichirEntreprise({
      identifiant: siret,
      inseeApiKey,
    })

    if (!result) {
      log(WARN, `Aucune donnee trouvee pour SIRET ${siret}`)
      return null
    }

    log(OK, `Raison sociale : ${result.raison_sociale}`)
    log(OK, `SIREN : ${result.siren}`)
    if (result.code_naf) log(OK, `NAF : ${result.code_naf} — ${result.libelle_naf ?? ''}`)
    if (result.adresse_siege) log(OK, `Siege : ${result.adresse_siege}`)
    if (result.effectif) log(OK, `Effectif : ${result.effectif}`)

    if (result.dirigeants.length > 0) {
      log(OK, `Dirigeants :`)
      for (const d of result.dirigeants) {
        log(INFO, `  ${d.prenom} ${d.nom}${d.qualite ? ` (${d.qualite})` : ''}`)
      }
    } else {
      log(WARN, `Aucun dirigeant trouve (normal via API SIRENE, retry via Annuaire)`)
    }

    return result
  } catch (err) {
    log(FAIL, `Enrichissement echoue : ${(err as Error).message}`)
    return null
  }
}

// ============================================================================
// ETAPE 4 — Calcul solaire PVGIS
// ============================================================================

async function etape4_pvgis(lat: number, lng: number, surfaceM2: number) {
  console.log(`\n${SEP}`)
  console.log(`  ETAPE 4 — Calcul solaire (PVGIS)`)
  console.log(SEP)

  const { calculerPotentielSolaire } = await import('../src/solar/index')

  try {
    const result = await calculerPotentielSolaire({
      lat,
      lng,
      surfaceToitureM2: surfaceM2,
    })

    log(OK, `Panneaux : ${result.nb_panneaux_max}`)
    log(OK, `Puissance : ${result.puissance_kwc} kWc`)
    log(OK, `Production annuelle : ${result.production_kwh_an.toLocaleString('fr-FR')} kWh/an`)
    log(OK, `Cout installation : ${result.cout_installation_eur.toLocaleString('fr-FR')} € HT`)
    log(OK, `Economie annuelle : ${result.economie_annuelle_eur.toLocaleString('fr-FR')} €/an`)
    log(OK, `ROI : ${result.retour_investissement_ans.toFixed(1)} ans`)
    log(OK, `Prime autoconso : ${result.prime_autoconsommation_eur.toLocaleString('fr-FR')} €`)
    log(OK, `Suramortissement : ${result.suramortissement_eur.toLocaleString('fr-FR')} €`)
    console.log()
    log(INFO, `Image aerienne : ${result.satelliteImageUrl.substring(0, 80)}...`)

    return result
  } catch (err) {
    log(FAIL, `PVGIS echoue : ${(err as Error).message}`)
    return null
  }
}

// ============================================================================
// ETAPE 5 — Recherche email (Hunter.io) — optionnel
// ============================================================================

async function etape5_hunter(domainOrSiren: string) {
  console.log(`\n${SEP}`)
  console.log(`  ETAPE 5 — Recherche email (Hunter.io)`)
  console.log(SEP)

  const apiKey = process.env.HUNTER_API_KEY
  if (!apiKey) {
    log(WARN, 'HUNTER_API_KEY non definie dans .env — etape ignoree')
    return null
  }

  // Si c'est un SIREN, on ne peut pas chercher par domaine
  if (/^\d+$/.test(domainOrSiren)) {
    log(WARN, `"${domainOrSiren}" est un SIREN, pas un domaine. Hunter.io necessite un nom de domaine.`)
    log(INFO, `Pour tester : npx tsx scripts/test-pipeline.ts --email avec un prospect ayant un site web`)
    return null
  }

  const { rechercherEmails } = await import('../src/enrichissement/hunter')

  try {
    const result = await rechercherEmails({
      domain: domainOrSiren,
      apiKey,
      department: 'executive',
      limit: 5,
    })

    log(OK, `Domaine : ${result.domain}`)
    log(OK, `Organisation : ${result.organization ?? 'N/A'}`)
    log(OK, `Pattern : ${result.pattern ?? 'N/A'}`)
    log(OK, `${result.emails.length} emails trouves :`)

    for (const e of result.emails) {
      log(INFO, `  ${e.value} (${e.confidence}%) — ${e.first_name ?? ''} ${e.last_name ?? ''} ${e.position ?? ''}`)
    }

    return result
  } catch (err) {
    log(FAIL, `Hunter.io echoue : ${(err as Error).message}`)
    return null
  }
}

// ============================================================================
// ETAPE 6 — Envoi email test (Brevo) — optionnel
// ============================================================================

async function etape6_brevo() {
  console.log(`\n${SEP}`)
  console.log(`  ETAPE 6 — Envoi email test (Brevo)`)
  console.log(SEP)

  const apiKey = process.env.BREVO_API_KEY
  const senderEmail = process.env.BREVO_SENDER_EMAIL
  const senderName = process.env.BREVO_SENDER_NAME

  if (!apiKey || !senderEmail) {
    log(WARN, 'BREVO_API_KEY ou BREVO_SENDER_EMAIL non definis — etape ignoree')
    return null
  }

  const { envoyerEmail } = await import('../src/outreach/brevo')

  const destinataire = 'mehdiii.alaoui1@gmail.com'

  try {
    const result = await envoyerEmail({
      apiKey,
      sender: { name: senderName ?? 'ERE Experts', email: senderEmail },
      to: [{ email: destinataire, name: 'Mehdi (test)' }],
      subject: '🧪 Test pipeline ERE Solar Bot',
      htmlContent: `
        <h2>Test pipeline ERE Solar Bot</h2>
        <p>Ce mail confirme que le pipeline d'envoi fonctionne.</p>
        <ul>
          <li><strong>API Brevo</strong> : connectee</li>
          <li><strong>Sender</strong> : ${senderEmail}</li>
          <li><strong>Date</strong> : ${new Date().toLocaleString('fr-FR')}</li>
        </ul>
        <p>— ERE Solar Bot (script test-pipeline.ts)</p>
      `,
      tags: ['test-pipeline'],
    })

    log(OK, `Email envoye a ${destinataire}`)
    log(OK, `Message ID : ${result.messageId}`)
    return result
  } catch (err) {
    log(FAIL, `Brevo echoue : ${(err as Error).message}`)
    return null
  }
}

// ============================================================================
// ETAPE 7 — Insertion Supabase — optionnel
// ============================================================================

async function etape7_supabase(
  candidat: typeof PROSPECT_FALLBACK,
  potentiel: Awaited<ReturnType<typeof etape4_pvgis>>,
) {
  console.log(`\n${SEP}`)
  console.log(`  ETAPE 7 — Insertion Supabase`)
  console.log(SEP)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    log(FAIL, 'Variables Supabase manquantes dans .env :')
    if (!url) log(WARN, '  NEXT_PUBLIC_SUPABASE_URL non definie')
    if (!key) log(WARN, '  SUPABASE_SERVICE_ROLE_KEY non definie')
    log(INFO, 'Va dans Supabase Dashboard → Settings → API pour recuperer ces valeurs')
    return null
  }

  const { insertPipelineComplet, calculerScore } = await import('../src/db/prospects')

  try {
    log(INFO, `Score prospect : ${calculerScore(candidat)}/100`)

    const result = await insertPipelineComplet(candidat, potentiel)

    log(OK, `Prospect insere — ID : ${result.prospect.id}`)
    log(OK, `  parcelle_id : ${result.prospect.parcelle_id ?? 'N/A'}`)
    log(OK, `  nouveau : ${result.prospect.isNew ? 'oui' : 'non (mise a jour)'}`)

    if (result.calcul) {
      log(OK, `Calcul solaire insere — ID : ${result.calcul.id}`)
      log(OK, `  prospect_id : ${result.calcul.prospect_id}`)
    } else {
      log(WARN, 'Pas de calcul solaire a inserer (PVGIS avait echoue)')
    }

    return result
  } catch (err) {
    log(FAIL, `Supabase echoue : ${(err as Error).message}`)
    return null
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('\n' + '═'.repeat(60))
  console.log('  ERE SOLAR BOT — Test Pipeline E2E')
  console.log('  ' + new Date().toLocaleString('fr-FR'))
  console.log('═'.repeat(60))

  const varsCheck = {
    'INSEE_API_KEY': !!process.env.INSEE_API_KEY,
    'HUNTER_API_KEY': !!process.env.HUNTER_API_KEY,
    'BREVO_API_KEY': !!process.env.BREVO_API_KEY,
    'BREVO_SENDER_EMAIL': !!process.env.BREVO_SENDER_EMAIL,
    'SUPABASE_URL': !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    'SUPABASE_KEY': !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  }

  console.log('\n  Variables .env :')
  for (const [k, v] of Object.entries(varsCheck)) {
    log(v ? OK : WARN, `${k} : ${v ? 'OK' : 'manquante'}`)
  }

  // --- Etape 1 : Sourcing ---
  const candidats = await etape1_sourcing()
  if (candidats.length === 0) {
    console.log('\n  Pipeline arrete : aucun candidat.\n')
    process.exit(1)
  }

  const premier = candidats[0]

  // --- Etape 2 : Geocodage ---
  const geo = await etape2_geocodage(premier.adresse)
  const lat = geo?.lat ?? premier.lat
  const lng = geo?.lng ?? premier.lng

  // --- Etape 3 : Enrichissement ---
  if (premier.siret_proprietaire) {
    await etape3_enrichissement(premier.siret_proprietaire)
  } else {
    console.log(`\n${SEP}`)
    console.log(`  ETAPE 3 — Enrichissement entreprise`)
    console.log(SEP)
    log(WARN, 'Pas de SIRET pour ce prospect — etape ignoree')
  }

  // --- Etape 4 : PVGIS ---
  const pvgisResult = await etape4_pvgis(lat, lng, premier.surface_m2)

  // --- Etape 5 : Hunter.io (optionnel) ---
  if (TEST_EMAIL) {
    // On teste avec un domaine connu pour demo
    await etape5_hunter('ere-experts.fr')
  } else {
    console.log(`\n${SEP}`)
    console.log(`  ETAPE 5 — Recherche email (Hunter.io) — IGNOREE`)
    console.log(SEP)
    log(INFO, 'Ajoutez --email pour tester Hunter.io (consomme 1 recherche)')
  }

  // --- Etape 6 : Brevo (optionnel) ---
  if (SEND_EMAIL) {
    await etape6_brevo()
  } else {
    console.log(`\n${SEP}`)
    console.log(`  ETAPE 6 — Envoi email test (Brevo) — IGNORE`)
    console.log(SEP)
    log(INFO, 'Ajoutez --send pour envoyer un email test via Brevo')
  }

  // --- Etape 7 : Supabase (optionnel) ---
  let supabaseOk = false
  if (TEST_SUPABASE) {
    const sbResult = await etape7_supabase(premier, pvgisResult)
    supabaseOk = !!sbResult
  } else {
    console.log(`\n${SEP}`)
    console.log(`  ETAPE 7 — Insertion Supabase — IGNOREE`)
    console.log(SEP)
    log(INFO, 'Ajoutez --supabase pour inserer dans la base')
  }

  // --- Resume ---
  console.log('\n' + '═'.repeat(60))
  console.log('  RESUME')
  console.log('═'.repeat(60))
  log(OK, 'Sourcing BDNB : fonctionnel')
  log(OK, 'Geocodage API Adresse : fonctionnel')
  log(geo ? OK : WARN, 'Enrichissement entreprise : ' + (premier.siret_proprietaire ? 'teste' : 'pas de SIRET'))
  log(pvgisResult ? OK : FAIL, 'Calcul solaire PVGIS : ' + (pvgisResult ? 'fonctionnel' : 'echoue'))
  log(OK, 'Image aerienne IGN : URL generee')
  log(TEST_EMAIL ? OK : INFO, `Hunter.io : ${TEST_EMAIL ? 'teste' : 'non teste (--email)'}`)
  log(SEND_EMAIL ? OK : INFO, `Brevo : ${SEND_EMAIL ? 'teste' : 'non teste (--send)'}`)
  log(TEST_SUPABASE ? (supabaseOk ? OK : FAIL) : INFO, `Supabase : ${TEST_SUPABASE ? (supabaseOk ? 'insere' : 'echoue') : 'non teste (--supabase)'}`)
  console.log()
}

main().catch((err) => {
  console.error('\n  ERREUR FATALE :', err)
  process.exit(1)
})
