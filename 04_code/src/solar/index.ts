/**
 * =============================================================================
 * ERE SOLAR BOT - Orchestrateur calculs solaires
 * =============================================================================
 * Combine PVGIS (production solaire) + IGN WMS (image aerienne) pour
 * produire un calcul complet pour un prospect :
 *   - dimensionnement (nb panneaux, puissance kWc, production kWh/an)
 *   - URL image aerienne pour le microsite
 *   - calculs financiers (reutilise @/lib/calculs-solaires)
 *
 * Remplace l'ancien orchestrateur Google Solar + Google Maps Static.
 * =============================================================================
 */

import { fetchPvgis, pvgisVersCalcul } from './pvgis'
import { buildOrthophotoUrl } from './ign-orthophoto'
import type { CalculSolaireResult } from './types'
import {
  calculerNbPanneaux,
  calculerPuissanceKwc,
  calculerEconomieAnnuelle,
  calculerROI,
  estimerCoutInstallation,
  calculerPrimeAutoconsommation,
  calculerSuramortissement,
  RATIO_SURFACE_UTILE,
} from '@/lib/calculs-solaires'

export interface CalculerPotentielSolaireOptions {
  lat: number
  lng: number
  /** Surface de toiture totale en m2 (issue du sourcing BDNB/IGN) */
  surfaceToitureM2: number
  /** Inclinaison du toit en degres. Defaut : 30 */
  inclinaisonDeg?: number
  /** Azimut : 0=sud, -90=est, 90=ouest. Defaut : 0 */
  azimutDeg?: number
  prospectId?: string | null
  fetchImpl?: typeof fetch
}

export interface PotentielSolaireComplet extends CalculSolaireResult {
  /** URL image aerienne IGN pour le microsite */
  satelliteImageUrl: string
  /** Calculs financiers */
  cout_installation_eur: number
  economie_annuelle_eur: number
  retour_investissement_ans: number
  prime_autoconsommation_eur: number
  suramortissement_eur: number
}

/**
 * Calcul complet pour un prospect :
 * 1. Dimensionnement panneaux a partir de la surface de toiture
 * 2. Appel PVGIS pour la production estimee
 * 3. Construction de l'URL image aerienne IGN
 * 4. Calculs financiers
 */
export async function calculerPotentielSolaire(
  opts: CalculerPotentielSolaireOptions,
): Promise<PotentielSolaireComplet> {
  // 1. Dimensionnement a partir de la surface
  const surfaceUtile = opts.surfaceToitureM2 * RATIO_SURFACE_UTILE
  const nbPanneaux = calculerNbPanneaux(opts.surfaceToitureM2)
  const puissanceKwc = calculerPuissanceKwc(nbPanneaux)

  // 2. PVGIS — production solaire estimee
  const pvgis = await fetchPvgis({
    lat: opts.lat,
    lng: opts.lng,
    puissanceKwc,
    angleDeg: opts.inclinaisonDeg ?? 30,
    aspectDeg: opts.azimutDeg ?? 0,
    fetchImpl: opts.fetchImpl,
  })

  const calcul = pvgisVersCalcul(
    pvgis,
    nbPanneaux,
    surfaceUtile,
    opts.prospectId ?? null,
  )

  // 3. URL image aerienne IGN (centree sur le batiment)
  const satelliteImageUrl = buildOrthophotoUrl({
    lat: opts.lat,
    lng: opts.lng,
    zoom: 20,
    width: 800,
    height: 600,
  })

  // 4. Calculs financiers
  const cout = estimerCoutInstallation(puissanceKwc)
  const economie = calculerEconomieAnnuelle(calcul.production_kwh_an)
  const prime = calculerPrimeAutoconsommation(puissanceKwc)
  const sura = calculerSuramortissement(cout)
  const aidesTotales = prime + sura
  const roi = calculerROI(cout, economie, aidesTotales)

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
export type { CalculSolaireResult } from './types'
export { SolarApiError } from './types'
export { fetchPvgis, pvgisVersCalcul, buildPvgisUrl } from './pvgis'
export { buildOrthophotoUrl, fetchOrthophoto, calculerBbox } from './ign-orthophoto'
