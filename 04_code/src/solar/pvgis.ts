/**
 * =============================================================================
 * ERE SOLAR BOT - Client API PVGIS (Commission europeenne)
 * =============================================================================
 * Remplace Google Solar API. Calcule la production solaire estimee
 * pour des coordonnees GPS en France.
 *
 * Endpoint utilise :
 *   GET https://re.jrc.ec.europa.eu/api/v5_2/PVcalc
 *       ?lat={lat}&lon={lng}
 *       &peakpower={kwc}
 *       &loss={pertes}
 *       &angle={inclinaison}
 *       &aspect={azimut}
 *       &outputformat=json
 *
 * Documentation : https://re.jrc.ec.europa.eu/pvg_tools/en/
 * Pas de cle API necessaire — API ouverte.
 * =============================================================================
 */

import type { CalculSolaireResult } from './types'
import { SolarApiError } from './types'

export const PVGIS_BASE_URL =
  process.env.PVGIS_BASE_URL ?? 'https://re.jrc.ec.europa.eu/api/v5_2'

export const DEFAULT_TIMEOUT_MS = 30_000

// ----------------------------------------------------------------------------
// Types reponse PVGIS
// ----------------------------------------------------------------------------

export interface PvgisMonthlyProduction {
  month: number
  /** Production mensuelle en kWh */
  E_m: number
  /** Irradiation mensuelle sur le plan (kWh/m2) */
  'H(i)_m': number
  /** Ratio de performance */
  SD_m?: number
}

export interface PvgisResponse {
  inputs: {
    location: { latitude: number; longitude: number; elevation?: number }
    pv_module: { technology?: string; peak_power: number; system_loss: number }
    mounting_system: {
      fixed?: { slope: { value: number }; azimuth: { value: number } }
    }
  }
  outputs: {
    monthly: {
      fixed: PvgisMonthlyProduction[]
    }
    totals: {
      fixed: {
        /** Production annuelle en kWh */
        E_y: number
        /** Irradiation annuelle sur le plan (kWh/m2) */
        'H(i)_y': number
        /** Ratio de performance */
        SD_y?: number
      }
    }
  }
}

// ----------------------------------------------------------------------------
// Options d'appel
// ----------------------------------------------------------------------------

export interface FetchPvgisOptions {
  /** Latitude du batiment */
  lat: number
  /** Longitude du batiment */
  lng: number
  /** Puissance crete en kWc */
  puissanceKwc: number
  /** Pertes systeme en % (defaut : 14%) */
  pertePourcent?: number
  /** Inclinaison du toit en degres (defaut : 30) */
  angleDeg?: number
  /** Azimut : 0=sud, -90=est, 90=ouest (defaut : 0 = plein sud) */
  aspectDeg?: number
  /** Timeout reseau */
  timeoutMs?: number
  /** Surcharge fetch pour tests */
  fetchImpl?: typeof fetch
}

// ----------------------------------------------------------------------------
// Construction URL
// ----------------------------------------------------------------------------

export function buildPvgisUrl(opts: {
  lat: number
  lng: number
  puissanceKwc: number
  pertePourcent?: number
  angleDeg?: number
  aspectDeg?: number
}): string {
  if (!Number.isFinite(opts.lat) || !Number.isFinite(opts.lng)) {
    throw new SolarApiError(
      `Coordonnees invalides : lat=${opts.lat}, lng=${opts.lng}`,
      'INVALID_INPUT',
    )
  }
  if (opts.puissanceKwc <= 0) {
    throw new SolarApiError(
      `Puissance invalide : ${opts.puissanceKwc} kWc (doit etre > 0)`,
      'INVALID_INPUT',
    )
  }

  const url = new URL(`${PVGIS_BASE_URL}/PVcalc`)
  url.searchParams.set('lat', String(opts.lat))
  url.searchParams.set('lon', String(opts.lng))
  url.searchParams.set('peakpower', String(opts.puissanceKwc))
  url.searchParams.set('loss', String(opts.pertePourcent ?? 14))
  url.searchParams.set('angle', String(opts.angleDeg ?? 30))
  url.searchParams.set('aspect', String(opts.aspectDeg ?? 0))
  url.searchParams.set('outputformat', 'json')
  return url.toString()
}

// ----------------------------------------------------------------------------
// Fetch PVGIS
// ----------------------------------------------------------------------------

/**
 * Appelle PVGIS pour obtenir la production solaire estimee.
 *
 * @throws SolarApiError - 'HTTP_ERROR', 'TIMEOUT', 'PARSE_ERROR', 'INVALID_INPUT'
 */
export async function fetchPvgis(
  opts: FetchPvgisOptions,
): Promise<PvgisResponse> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new SolarApiError('fetch indisponible (Node < 18 ?)', 'INVALID_INPUT')
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
      throw new SolarApiError(
        `Timeout PVGIS apres ${timeoutMs}ms`,
        'TIMEOUT',
        err,
      )
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
    throw new SolarApiError('Reponse PVGIS illisible', 'PARSE_ERROR', err)
  }

  if (
    !json ||
    typeof json !== 'object' ||
    !(json as { outputs?: unknown }).outputs
  ) {
    throw new SolarApiError(
      'Reponse PVGIS inattendue : champ "outputs" manquant',
      'PARSE_ERROR',
    )
  }

  return json as PvgisResponse
}

// ----------------------------------------------------------------------------
// Conversion vers CalculSolaireResult
// ----------------------------------------------------------------------------

/**
 * Convertit une reponse PVGIS en CalculSolaireResult normalise.
 *
 * @param pvgis - Reponse PVGIS
 * @param nbPanneaux - Nombre de panneaux estimes (calcule en amont)
 * @param surfaceToitureM2 - Surface de toiture utile en m2
 * @param prospectId - ID du prospect (optionnel)
 */
export function pvgisVersCalcul(
  pvgis: PvgisResponse,
  nbPanneaux: number,
  surfaceToitureM2: number,
  prospectId: string | null = null,
): CalculSolaireResult {
  const totals = pvgis.outputs.totals.fixed
  const inputs = pvgis.inputs

  const puissanceKwc = inputs.pv_module.peak_power
  const angleDeg = inputs.mounting_system.fixed?.slope?.value ?? null
  const aspectDeg = inputs.mounting_system.fixed?.azimuth?.value ?? null

  return {
    prospect_id: prospectId,
    nb_panneaux_max: nbPanneaux,
    puissance_kwc: Number(puissanceKwc.toFixed(2)),
    production_kwh_an: Math.round(totals.E_y),
    surface_toiture_utile_m2: Number(surfaceToitureM2.toFixed(1)),
    azimut_deg: aspectDeg,
    inclinaison_deg: angleDeg,
    imagery_date: null,
    source_api: 'pvgis',
  }
}
