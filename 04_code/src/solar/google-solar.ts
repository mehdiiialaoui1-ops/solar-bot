/**
 * =============================================================================
 * ERE SOLAR BOT - Client Google Solar API (Building Insights)
 * =============================================================================
 * Endpoint utilise :
 *   GET https://solar.googleapis.com/v1/buildingInsights:findClosest
 *       ?location.latitude={lat}&location.longitude={lng}
 *       &requiredQuality=HIGH
 *       &key={API_KEY}
 *
 * Renvoie pour le batiment le plus proche d'un point GPS donne :
 *   - les configurations possibles de panneaux solaires
 *   - les statistiques par segment de toiture (orientation, pente, surface)
 *   - la production annuelle estimee (kWh DC)
 *   - les coordonnees + bounding box pour calculer l'overlay image satellite
 * =============================================================================
 */

import type {
  BuildingInsightsResponse,
  CalculSolaireResult,
  SolarPanelConfig,
} from './types'
import { SolarApiError } from './types'

export const GOOGLE_SOLAR_ENDPOINT =
  'https://solar.googleapis.com/v1/buildingInsights:findClosest'

export const DEFAULT_TIMEOUT_MS = 20_000

export type SolarQuality = 'HIGH' | 'MEDIUM' | 'LOW'

export interface FetchBuildingInsightsOptions {
  lat: number
  lng: number
  apiKey: string
  /** Qualite minimale requise. Defaut : 'HIGH' (precision ~10cm) */
  requiredQuality?: SolarQuality
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export function buildSolarUrl(opts: {
  lat: number
  lng: number
  apiKey: string
  requiredQuality?: SolarQuality
}): string {
  if (!Number.isFinite(opts.lat) || !Number.isFinite(opts.lng)) {
    throw new SolarApiError(
      `Coordonnees invalides : lat=${opts.lat}, lng=${opts.lng}`,
      'INVALID_INPUT',
    )
  }
  if (!opts.apiKey || opts.apiKey.length < 20) {
    throw new SolarApiError('Cle API Google Solar manquante ou invalide', 'INVALID_INPUT')
  }
  const url = new URL(GOOGLE_SOLAR_ENDPOINT)
  url.searchParams.set('location.latitude', String(opts.lat))
  url.searchParams.set('location.longitude', String(opts.lng))
  url.searchParams.set('requiredQuality', opts.requiredQuality ?? 'HIGH')
  url.searchParams.set('key', opts.apiKey)
  return url.toString()
}

/**
 * Recupere les Building Insights pour un point GPS.
 *
 * @throws SolarApiError - 'NO_BUILDING_FOUND' (404), 'HTTP_ERROR', 'TIMEOUT', 'PARSE_ERROR'
 */
export async function fetchBuildingInsights(
  opts: FetchBuildingInsightsOptions,
): Promise<BuildingInsightsResponse> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new SolarApiError('fetch indisponible (Node < 18 ?)', 'INVALID_INPUT')
  }

  const url = buildSolarUrl(opts)
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new SolarApiError(
        `Timeout Google Solar apres ${timeoutMs}ms`,
        'TIMEOUT',
        err,
      )
    }
    throw new SolarApiError(
      `Erreur reseau Google Solar : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 404) {
    throw new SolarApiError(
      `Aucun batiment trouve a (${opts.lat}, ${opts.lng})`,
      'NO_BUILDING_FOUND',
    )
  }

  if (!res.ok) {
    throw new SolarApiError(
      `Google Solar HTTP ${res.status} ${res.statusText}`,
      'HTTP_ERROR',
    )
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    throw new SolarApiError('Reponse Google Solar illisible', 'PARSE_ERROR', err)
  }

  if (
    !json ||
    typeof json !== 'object' ||
    !(json as { center?: unknown }).center
  ) {
    throw new SolarApiError(
      'Reponse Google Solar inattendue : champ "center" manquant',
      'PARSE_ERROR',
    )
  }

  return json as BuildingInsightsResponse
}

// ----------------------------------------------------------------------------
// Helpers d'analyse - selection de la meilleure configuration
// ----------------------------------------------------------------------------

/**
 * Choisit la configuration "max panneaux" - utile pour estimer le potentiel
 * theorique d'une toiture. Retourne null si aucune config disponible.
 */
export function selectionnerConfigMax(
  configs: SolarPanelConfig[] | undefined,
): SolarPanelConfig | null {
  if (!configs || configs.length === 0) return null
  return configs.reduce((max, c) => (c.panelsCount > max.panelsCount ? c : max))
}

/**
 * Choisit la configuration la plus proche d'un objectif de panneaux donne.
 * Utile pour matcher une puissance cible (ex: 100 kWc -> ~250 panneaux).
 */
export function selectionnerConfigCible(
  configs: SolarPanelConfig[] | undefined,
  cibleNbPanneaux: number,
): SolarPanelConfig | null {
  if (!configs || configs.length === 0) return null
  return configs.reduce((best, c) =>
    Math.abs(c.panelsCount - cibleNbPanneaux) <
    Math.abs(best.panelsCount - cibleNbPanneaux)
      ? c
      : best,
  )
}

/**
 * Convertit une reponse Building Insights en CalculSolaireResult
 * normalise (pret a etre insere dans la table `calculs_solaires`).
 *
 * Strategie :
 * - On prend la config "max panneaux" par defaut
 * - On agrege l'azimut/inclinaison du segment dominant (le plus de panneaux)
 * - On calcule la puissance via panelCapacityWatts
 */
export function buildingInsightsVersCalcul(
  insights: BuildingInsightsResponse,
  prospectId: string | null = null,
): CalculSolaireResult | null {
  const sp = insights.solarPotential
  if (!sp) return null
  const config = selectionnerConfigMax(sp.solarPanelConfigs)
  if (!config) return null

  const panelW = sp.panelCapacityWatts ?? 400
  const puissanceKwc = (config.panelsCount * panelW) / 1000

  // Azimut/inclinaison du segment dominant (celui avec le plus de panneaux)
  const segDominant = config.roofSegmentSummaries?.reduce((a, b) =>
    a.panelsCount > b.panelsCount ? a : b,
  )

  const date = insights.imageryDate
  const imageryDateIso = date
    ? `${date.year.toString().padStart(4, '0')}-${date.month
        .toString()
        .padStart(2, '0')}-${date.day.toString().padStart(2, '0')}`
    : null

  return {
    prospect_id: prospectId,
    nb_panneaux_max: config.panelsCount,
    puissance_kwc: Number(puissanceKwc.toFixed(2)),
    production_kwh_an: Math.round(config.yearlyEnergyDcKwh),
    surface_toiture_utile_m2: Number((sp.maxArrayAreaMeters2 ?? 0).toFixed(1)),
    azimut_deg: segDominant?.azimuthDegrees ?? null,
    inclinaison_deg: segDominant?.pitchDegrees ?? null,
    imagery_date: imageryDateIso,
    source_api: 'pvgis', // Legacy : etait 'google_solar' avant migration
  }
}
