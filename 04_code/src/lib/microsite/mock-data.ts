/**
 * =============================================================================
 * ERE SOLAR BOT — Données microsite (Supabase)
 * =============================================================================
 * Récupère les données du microsite par slug depuis les tables :
 *   - microsites (slug, titre, image)
 *   - prospects (adresse, commune, surface, usage, obligations)
 *   - calculs_solaires (puissance, production, aides, ROI)
 *   - outreach_contacts (décideur : prénom, nom, titre)
 *
 * Conserve l'interface MicrositeData existante pour compatibilité
 * avec les composants Hero, SystemeSolaire, Aides, CTA.
 * =============================================================================
 */

import { createServerClient } from '../supabase/client'

export interface MicrositeData {
  slug: string
  prospect: {
    raison_sociale: string
    adresse: string
    code_postal: string
    commune: string
    surface_m2: number
    usage: string
    annee_construction?: number
  }
  decideur: {
    prenom: string
    nom: string
    titre: string
  }
  calcul_solaire: {
    nb_panneaux: number
    puissance_kwc: number
    production_kwh_an: number
    surface_toiture_utile_m2: number
    azimut_deg: number
    inclinaison_deg: number
    economie_annuelle_eur: number
    cout_installation_eur: number
    retour_investissement_ans: number
    co2_evite_tonnes_an: number
    satellite_image_url: string
    overlay_svg_url?: string
  }
  aides: {
    prime_autoconsommation_eur: number
    suramortissement_eur: number
    cee_eur: number
    rachat_surplus_eur_par_an: number
  }
  obligations: {
    aper: boolean
    decret_tertiaire: boolean
  }
  cta: {
    rdv_url: string
  }
}

// Tarif rachat surplus EDF OA T1 2026 (< 100 kWc, vente surplus)
const TARIF_RACHAT_SURPLUS_EUR_KWH = 0.1269
// Part autoconsommation estimée tertiaire
const TAUX_AUTOCONSOMMATION = 0.70
// Facteur émission mix élec France (kg CO2 / kWh)
const FACTEUR_CO2_KG_PAR_KWH = 0.0569

/**
 * Récupère les données complètes du microsite par slug
 * depuis Supabase (microsites + prospects + calculs_solaires + outreach_contacts).
 */
export async function getMicrositeData(slug: string): Promise<MicrositeData | null> {
  const supabase = createServerClient()

  // 1. Récupérer le microsite par slug
  const { data: microsite, error: mErr } = await supabase
    .from('microsites')
    .select('*')
    .eq('slug', slug)
    .single()

  if (mErr || !microsite) return null

  // 2. Récupérer le prospect associé
  const { data: prospect, error: pErr } = await supabase
    .from('prospects')
    .select('*')
    .eq('id', microsite.prospect_id)
    .single()

  if (pErr || !prospect) return null

  // 3. Récupérer le calcul solaire le plus récent
  const { data: calculs } = await supabase
    .from('calculs_solaires')
    .select('*')
    .eq('prospect_id', prospect.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const calcul = calculs?.[0] ?? null

  // 4. Récupérer le décideur (contact principal) si existant
  const { data: contacts } = await supabase
    .from('outreach_contacts')
    .select('*')
    .eq('prospect_id', prospect.id)
    .limit(1)

  const contact = contacts?.[0] ?? null

  // 5. Calculer les valeurs dérivées
  const productionAn = calcul?.production_kwh_an ?? 0
  const surplusAn = productionAn * (1 - TAUX_AUTOCONSOMMATION)
  const rachatSurplusAn = Math.round(surplusAn * TARIF_RACHAT_SURPLUS_EUR_KWH)
  const co2EviteTonnes = parseFloat(
    ((productionAn * FACTEUR_CO2_KG_PAR_KWH) / 1000).toFixed(2),
  )

  // 6. Mapper vers l'interface MicrositeData
  return {
    slug,
    prospect: {
      raison_sociale: prospect.raison_sociale ?? `Bâtiment ${prospect.adresse}`,
      adresse: prospect.adresse,
      code_postal: prospect.code_postal,
      commune: prospect.commune,
      surface_m2: prospect.surface_m2,
      usage: prospect.usage,
      annee_construction: prospect.annee_construction ?? undefined,
    },
    decideur: {
      prenom: contact?.prenom ?? 'Propriétaire',
      nom: contact?.nom ?? '',
      titre: contact?.titre ?? 'Décideur',
    },
    calcul_solaire: {
      nb_panneaux: calcul?.nb_panneaux_max ?? Math.round((calcul?.puissance_kwc ?? 0) / 0.4),
      puissance_kwc: calcul?.puissance_kwc ?? 0,
      production_kwh_an: productionAn,
      surface_toiture_utile_m2: calcul?.surface_toiture_utile_m2 ?? prospect.surface_m2 * 0.3,
      azimut_deg: calcul?.azimut_deg ?? 180,
      inclinaison_deg: calcul?.inclinaison_deg ?? 20,
      economie_annuelle_eur: calcul?.economie_annuelle_eur ?? 0,
      cout_installation_eur: calcul?.cout_installation_eur ?? 0,
      retour_investissement_ans: calcul?.retour_investissement_ans ?? 0,
      co2_evite_tonnes_an: co2EviteTonnes,
      satellite_image_url: microsite.image_satellite_url ?? calcul?.satellite_image_url ?? '',
    },
    aides: {
      prime_autoconsommation_eur: calcul?.prime_autoconsommation_eur ?? 0,
      suramortissement_eur: calcul?.suramortissement_eur ?? 0,
      cee_eur: calcul?.cee_eur ?? 0,
      rachat_surplus_eur_par_an: rachatSurplusAn,
    },
    obligations: {
      aper: prospect.obligation_aper ?? false,
      decret_tertiaire: prospect.obligation_dec_tert ?? false,
    },
    cta: {
      rdv_url: 'https://cal.com/ere-experts/etude-solaire',
    },
  }
}
