/**
 * =============================================================================
 * ERE SOLAR BOT - Client PVGIS (Photovoltaic Geographical Information System)
 * =============================================================================
 * PVGIS est l'outil de calcul solaire de la Commission europeenne (JRC).
 * Remplace Google Solar API pour la phase MVP : 0 €, pas de cle requise,
 * data scientifiquement valide pour toute l'Europe.
 *
 * Endpoint utilise :
 *   GET https://re.jrc.ec.europa.eu/api/v5_2/PVcalc
 *       ?lat={lat}&lon={lon}
 *       &peakpower={kWc}
 *       &loss={%}
 *       &angle={inclinaison}
 *       &aspect={azimut}
 *       &outputformat=json
 *       &raddatabase=PVGIS-SARAH2
 *
 * Convention azimut PVGIS :
 *   - aspect=0  → plein sud (defaut MVP)
 *   - aspect=-90 → est
 *   - aspect=90  → ouest
 *   - aspect=180 → nord
 * =============================================================================
 */

import { SolarApiError } from './types'

export const PVGIS_ENDPOINT = 'https://re.jrc.ec.europa.eu/api/v5_2/PVcalc'
export const DEFAULT_TIMEOUT_MS = 15_000

/** Hypotheses MVP - toit plat / orientation sud (a affiner avec LiDAR IGN plus tard) */
export const DEFAULT_INCLINAISON_DEG = 30
export const DEFAULT_AZIMUT_DEG = 0
/** Pertes systeme par defaut (cables, onduleur, salissure) - 14% standard */
export const DEFAULT_PERTES_PCT = 14

// ----------------------------------------------------------------------------
// Types reponse PVGIS (subset utile)
// ----------------------------------------------------------------------------

export interface PvgisMonthly {
  /** Mois 1-12 */
  month: number
  /** Production mensuelle (kWh) */
  E_m: number
  /** Irradiation horizontale mensuelle (kWh/m²) */
  'H(i)_m'?: number
}

export interface PvgisFixedTotals {
  /** Production annuelle (kWh) */
  E_y: number
  /** Irradiation globale annuelle plan incline (kWh/m²) */
  'H(i)_y': number
  /** Variabilite annuelle (% std) */
  'SD_y'?: number
}

export interface PvgisRawResponse {
  inputs?: {
    location?: { latitude: number; longitude: number }
    meteo_data?: { radiation_db?: string; year_min?: number; year_max?: number }
    mounting_system?: {
      fixed?: { slope?: { value: number }; azimuth?: { value: number } }
    }
    pv_module?: { peak_power?: number; system_loss?: number }
  }
  outputs?: {
    monthly?: { fixed?: PvgisMonthly[] }
    totals?: { fixed?: PvgisFixedTotals }
  }
  meta?: unknown
}

// ----------------------------------------------------------------------------
// Sortie normalisee
// ----------------------------------------------------------------------------

export interface PvgisResult {
  /** Production annuelle estimee (kWh) */
  productionAnnuelleKwh: number
  /** Production mensuelle (12 entrees) */
  productionMensuelle: Array<{ mois: number; kwh: number }>
  /** Irradiation globale annuelle plan incline (kWh/m²) */
  irradiationAnnuelleKwhM2: number
  /** Pertes systeme appliquees (%) */
  perteSysteme: number
  /** Inclinaison utilisee (°) */
  inclinaisonDeg: number
  /** Azimut utilise (° PVGIS, 0=sud) */
  azimutDeg: number
  /** Puissance crete demandee (kWc) */
  puissanceKwc: number
}

// ----------------------------------------------------------------------------
// Construction URL
// ----------------------------------------------------------------------------

export interface FetchPvgisOptions {
  lat: number
  lon: number
  /** Puissance crete (kWc) */
  puissanceKwc: number
  /** Inclinaison (°), defaut 30 */
  inclinaisonDeg?: number
  /** Azimut (° PVGIS, 0=sud), defaut 0 */
  azimutDeg?: number
  /** Pertes systeme (%), defaut 14 */
  pertesPct?: number
  /** Base de donnees radiation (defaut PVGIS-SARAH2 pour Europe) */
  radDatabase?: 'PVGIS-SARAH2' | 'PVGIS-ERA5' | 'PVGIS-NSRDB' | 'PVGIS-COSMO'
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export function buildPvgisUrl(opts: FetchPvgisOptions): string {
  if (!Number.isFinite(opts.lat) || !Number.isFinite(opts.lon)) {
    throw new SolarApiError(
      `Coordonnees invalides : lat=${opts.lat}, lon=${opts.lon}`,
      'INVALID_INPUT',
    )
  }
  if (opts.lat < -90 || opts.lat > 90 || opts.lon < -180 || opts.lon > 180) {
    throw new SolarApiError(
      `Coordonnees hors bornes : lat=${opts.lat}, lon=${opts.lon}`,
      'INVALID_INPUT',
    )
  }
  if (!Number.isFinite(opts.puissanceKwc) || opts.puissanceKwc <= 0) {
    throw new SolarApiError(
      `Puissance crete invalide : ${opts.puissanceKwc} kWc (doit etre > 0)`,
      'INVALID_INPUT',
    )
  }
  const inclinaison = opts.inclinaisonDeg ?? DEFAULT_INCLINAISON_DEG
  if (inclinaison < 0 || inclinaison > 90) {
    throw new SolarApiError(
      `Inclinaison hors bornes : ${inclinaison}° (0-90 attendu)`,
      'INVALID_INPUT',
    )
  }
  const azimut = opts.azimutDeg ?? DEFAULT_AZIMUT_DEG
  if (azimut < -180 || azimut > 180) {
    throw new SolarApiError(
      `Azimut hors bornes : ${azimut}° (-180 a 180 attendu)`,
      'INVALID_INPUT',
    )
  }
  const pertes = opts.pertesPct ?? DEFAULT_PERTES_PCT

  const url = new URL(PVGIS_ENDPOINT)
  url.searchParams.set('lat', String(opts.lat))
  url.searchParams.set('lon', String(opts.lon))
  url.searchParams.set('peakpower', String(opts.puissanceKwc))
  url.searchParams.set('loss', String(pertes))
  url.searchParams.set('angle', String(inclinaison))
  url.searchParams.set('aspect', String(azimut))
  url.searchParams.set('outputformat', 'json')
  url.searchParams.set('raddatabase', opts.radDatabase ?? 'PVGIS-SARAH2')
  return url.toString()
}

// ----------------------------------------------------------------------------
// Fetch + parsing
// ----------------------------------------------------------------------------

export async function fetchPvgis(opts: FetchPvgisOptions): Promise<PvgisResult> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new SolarApiError('fetch indisponible', 'INVALID_INPUT')
  }

  const url = buildPvgisUrl(opts)
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
      throw new SolarApiError(`Timeout PVGIS apres ${timeoutMs}ms`, 'TIMEOUT', err)
    }
    throw new SolarApiError(
      `Erreur reseau PVGIS : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    throw new SolarApiError(
      `PVGIS HTTP ${res.status} ${res.statusText}`,
      'HTTP_ERROR',
    )
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    throw new SolarApiError('Reponse PVGIS illisible (JSON parse)', 'PARSE_ERROR', err)
  }

  return parserReponsePvgis(json, {
    inclinaisonDeg: opts.inclinaisonDeg ?? DEFAULT_INCLINAISON_DEG,
    azimutDeg: opts.azimutDeg ?? DEFAULT_AZIMUT_DEG,
    pertesPct: opts.pertesPct ?? DEFAULT_PERTES_PCT,
    puissanceKwc: opts.puissanceKwc,
  })
}

/**
 * Parse une reponse PVGIS brute en PvgisResult normalise.
 * Exporte pour les tests.
 */
export function parserReponsePvgis(
  raw: unknown,
  fallback: {
    inclinaisonDeg: number
    azimutDeg: number
    pertesPct: number
    puissanceKwc: number
  },
): PvgisResult {
  if (!raw || typeof raw !== 'object') {
    throw new SolarApiError('Reponse PVGIS vide', 'PARSE_ERROR')
  }
  const data = raw as PvgisRawResponse
  const totals = data.outputs?.totals?.fixed
  const monthly = data.outputs?.monthly?.fixed
  if (!totals || typeof totals.E_y !== 'number') {
    throw new SolarApiError(
      'Reponse PVGIS inattendue : outputs.totals.fixed.E_y manquant',
      'PARSE_ERROR',
    )
  }
  if (!Array.isArray(monthly) || monthly.length !== 12) {
    throw new SolarApiError(
      'Reponse PVGIS inattendue : 12 entrees monthly attendues',
      'PARSE_ERROR',
    )
  }

  return {
    productionAnnuelleKwh: Math.round(totals.E_y),
    productionMensuelle: monthly.map((m) => ({
      mois: m.month,
      kwh: Math.round(m.E_m),
    })),
    irradiationAnnuelleKwhM2: Math.round(totals['H(i)_y']),
    perteSysteme: fallback.pertesPct,
    inclinaisonDeg: fallback.inclinaisonDeg,
    azimutDeg: fallback.azimutDeg,
    puissanceKwc: fallback.puissanceKwc,
  }
}

// ----------------------------------------------------------------------------
// Helper - estimation installation depuis surface toiture
// ----------------------------------------------------------------------------

/** Surface d'un panneau standard 400Wc (m²) */
export const SURFACE_PANNEAU_M2 = 1.7
/** Puissance crete d'un panneau standard (Wc) */
export const PUISSANCE_PANNEAU_WC = 400
/** Taux de couverture utile (cheminees, ombres, retraits...) */
export const TAUX_COUVERTURE = 0.7

export interface EstimationInstallation {
  surfaceUtile: number
  nbPanneaux: number
  puissanceKwc: number
}

/**
 * Estime l'installation possible a partir de la surface de toiture
 * (avant appel PVGIS pour la production).
 */
export function estimerInstallation(
  surfaceToitureM2: number,
): EstimationInstallation {
  if (!Number.isFinite(surfaceToitureM2) || surfaceToitureM2 <= 0) {
    throw new SolarApiError(
      `Surface toiture invalide : ${surfaceToitureM2} m²`,
      'INVALID_INPUT',
    )
  }
  const surfaceUtile = surfaceToitureM2 * TAUX_COUVERTURE
  const nbPanneaux = Math.floor(surfaceUtile / SURFACE_PANNEAU_M2)
  const puissanceKwc = (nbPanneaux * PUISSANCE_PANNEAU_WC) / 1000
  return { surfaceUtile, nbPanneaux, puissanceKwc }
}
