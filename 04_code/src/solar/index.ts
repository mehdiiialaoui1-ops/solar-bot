/**
 * =============================================================================
 * ERE SOLAR BOT - Orchestrateur calculs solaires
 * =============================================================================
 * Combine Google Solar Building Insights + Google Maps Static pour
 * produire un calcul complet pour un prospect :
 *   - dimensionnement (nb panneaux, puissance kWc, production kWh/an)
 *   - URL image satellite pour le microsite
 *   - calculs financiers (reutilise @/lib/calculs-solaires)
 *
 * NB : pas d'insertion DB ici tant que la PR J2 n'est pas mergee.
 * =============================================================================
 */

import {
  fetchBuildingInsights,
  buildingInsightsVersCalcul,
} from './google-solar'
import { buildStaticMapUrl } from './google-maps-static'
import type { CalculSolaireResult } from './types'
import {
  calculerEconomieAnnuelle,
  calculerROI,
  estimerCoutInstallation,
  calculerPrimeAutoconsommation,
  calculerSuramortissement,
} from '@/lib/calculs-solaires'

export interface CalculerPotentielSolaireOptions {
  lat: number
  lng: number
  apiKeyGoogleSolar: string
  apiKeyGoogleMaps: string
  prospectId?: string | null
  fetchImpl?: typeof fetch
}

export interface PotentielSolaireComplet extends CalculSolaireResult {
  /** URL image satellite pour le microsite */
  satelliteImageUrl: string
  /** Calculs financiers */
  cout_installation_eur: number
  economie_annuelle_eur: number
  retour_investissement_ans: number
  prime_autoconsommation_eur: number
  suramortissement_eur: number
}

/**
 * Calcul complet pour un prospect : appelle Google Solar pour le
 * dimensionnement, construit l'URL image satellite et chaine les
 * calculs financiers.
 */
export async function calculerPotentielSolaire(
  opts: CalculerPotentielSolaireOptions,
): Promise<PotentielSolaireComplet | null> {
  // 1. Building Insights (panneaux, production, segments toiture)
  const insights = await fetchBuildingInsights({
    lat: opts.lat,
    lng: opts.lng,
    apiKey: opts.apiKeyGoogleSolar,
    fetchImpl: opts.fetchImpl,
  })

  const calcul = buildingInsightsVersCalcul(insights, opts.prospectId ?? null)
  if (!calcul) return null

  // 2. URL image satellite (centree sur le batiment)
  const satelliteImageUrl = buildStaticMapUrl({
    lat: insights.center.latitude,
    lng: insights.center.longitude,
    apiKey: opts.apiKeyGoogleMaps,
    zoom: 20,
    width: 800,
    height: 600,
    scale: 2,
  })

  // 3. Calculs financiers (reutilise les fonctions pures de J1)
  const cout = estimerCoutInstallation(calcul.puissance_kwc)
  const economie = calculerEconomieAnnuelle(calcul.production_kwh_an)
  const prime = calculerPrimeAutoconsommation(calcul.puissance_kwc)
  const sura = calculerSuramortissement(cout)
  const aidesTotales = prime + sura
  const roi = calculerROI({
    coutInstallationEur: cout,
    economieAnnuelleEur: economie,
    aidesTotalesEur: aidesTotales,
  })

  return {
    ...calcul,
    satelliteImageUrl,
    cout_installation_eur: cout,
    economie_annuelle_eur: economie,
    retour_investissement_ans: roi,
    prime_autoconsommation_eur: prime,
    suramortissement_eur: sura,
  }
}

// Re-exports
export type { BuildingInsightsResponse, CalculSolaireResult } from './types'
export { SolarApiError } from './types'
export { buildSolarUrl, fetchBuildingInsights, selectionnerConfigMax } from './google-solar'
export { buildStaticMapUrl, gpsVersPixelImage } from './google-maps-static'
