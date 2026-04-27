/**
 * =============================================================================
 * ERE SOLAR BOT - Client API Adresse (data.gouv.fr) — Geocodage
 * =============================================================================
 * Convertit une adresse postale en coordonnees GPS (et inversement).
 * Necessaire pour alimenter PVGIS en lat/lng a partir d'une adresse.
 *
 * Endpoint :
 *   GET https://api-adresse.data.gouv.fr/search/?q={adresse}&limit=1
 *   GET https://api-adresse.data.gouv.fr/reverse/?lon={lng}&lat={lat}
 *
 * Pas de cle API necessaire — API ouverte, maintenue par Etalab.
 * =============================================================================
 */

export const ADRESSE_API_URL =
  process.env.ADRESSE_API_URL ?? 'https://api-adresse.data.gouv.fr'

export const DEFAULT_TIMEOUT_MS = 10_000

// ----------------------------------------------------------------------------
// Types reponse API Adresse (GeoJSON)
// ----------------------------------------------------------------------------

export interface AdresseProperties {
  label: string
  score: number
  housenumber?: string
  id: string
  type: string
  name: string
  postcode: string
  citycode: string
  city: string
  context: string
  importance: number
  street?: string
}

export interface AdresseFeature {
  type: 'Feature'
  geometry: {
    type: 'Point'
    coordinates: [number, number] // [lng, lat]
  }
  properties: AdresseProperties
}

export interface AdresseResponse {
  type: 'FeatureCollection'
  features: AdresseFeature[]
  query?: string
}

// ----------------------------------------------------------------------------
// Erreur typee
// ----------------------------------------------------------------------------

export class GeocodageError extends Error {
  constructor(
    message: string,
    public readonly code: 'HTTP_ERROR' | 'TIMEOUT' | 'PARSE_ERROR' | 'NOT_FOUND',
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'GeocodageError'
  }
}

// ----------------------------------------------------------------------------
// Resultat normalise
// ----------------------------------------------------------------------------

export interface ResultatGeocodage {
  lat: number
  lng: number
  /** Adresse complete normalisee par la BAN */
  label: string
  /** Code postal */
  codePostal: string
  /** Commune */
  commune: string
  /** Code INSEE de la commune */
  codeInsee: string
  /** Score de confiance (0 a 1) */
  score: number
}

// ----------------------------------------------------------------------------
// Geocodage direct : adresse -> GPS
// ----------------------------------------------------------------------------

export interface GeocoderOptions {
  /** Adresse a geocoder */
  adresse: string
  /** Code postal (ameliore la precision) */
  codePostal?: string
  /** Nombre max de resultats. Defaut : 1 */
  limit?: number
  /** Timeout reseau */
  timeoutMs?: number
  /** Surcharge fetch pour tests */
  fetchImpl?: typeof fetch
}

/**
 * Geocode une adresse postale en coordonnees GPS.
 *
 * @throws GeocodageError - 'NOT_FOUND', 'HTTP_ERROR', 'TIMEOUT', 'PARSE_ERROR'
 */
export async function geocoder(
  opts: GeocoderOptions,
): Promise<ResultatGeocodage> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const url = new URL(`${ADRESSE_API_URL}/search/`)
  url.searchParams.set('q', opts.adresse)
  url.searchParams.set('limit', String(opts.limit ?? 1))
  if (opts.codePostal) {
    url.searchParams.set('postcode', opts.codePostal)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new GeocodageError(
        `Timeout geocodage apres ${timeoutMs}ms`,
        'TIMEOUT',
        err,
      )
    }
    throw new GeocodageError(
      `Erreur reseau geocodage : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    throw new GeocodageError(
      `Geocodage HTTP ${res.status} ${res.statusText}`,
      'HTTP_ERROR',
    )
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    throw new GeocodageError('Reponse geocodage illisible', 'PARSE_ERROR', err)
  }

  const data = json as AdresseResponse
  if (!data.features || data.features.length === 0) {
    throw new GeocodageError(
      `Aucun resultat pour "${opts.adresse}"`,
      'NOT_FOUND',
    )
  }

  const feature = data.features[0]
  const [lng, lat] = feature.geometry.coordinates

  return {
    lat,
    lng,
    label: feature.properties.label,
    codePostal: feature.properties.postcode,
    commune: feature.properties.city,
    codeInsee: feature.properties.citycode,
    score: feature.properties.score,
  }
}

// ----------------------------------------------------------------------------
// Geocodage inverse : GPS -> adresse
// ----------------------------------------------------------------------------

/**
 * Geocodage inverse : retrouve l'adresse depuis des coordonnees GPS.
 */
export async function reverseGeocode(opts: {
  lat: number
  lng: number
  timeoutMs?: number
  fetchImpl?: typeof fetch
}): Promise<ResultatGeocodage> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const url = new URL(`${ADRESSE_API_URL}/reverse/`)
  url.searchParams.set('lat', String(opts.lat))
  url.searchParams.set('lon', String(opts.lng))

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetchImpl(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new GeocodageError(
        `Timeout geocodage inverse apres ${timeoutMs}ms`,
        'TIMEOUT',
        err,
      )
    }
    throw new GeocodageError(
      `Erreur reseau geocodage inverse : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    throw new GeocodageError(
      `Geocodage inverse HTTP ${res.status} ${res.statusText}`,
      'HTTP_ERROR',
    )
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    throw new GeocodageError('Reponse geocodage inverse illisible', 'PARSE_ERROR', err)
  }

  const data = json as AdresseResponse
  if (!data.features || data.features.length === 0) {
    throw new GeocodageError(
      `Aucune adresse trouvee pour (${opts.lat}, ${opts.lng})`,
      'NOT_FOUND',
    )
  }

  const feature = data.features[0]
  const [lng, lat] = feature.geometry.coordinates

  return {
    lat,
    lng,
    label: feature.properties.label,
    codePostal: feature.properties.postcode,
    commune: feature.properties.city,
    codeInsee: feature.properties.citycode,
    score: feature.properties.score,
  }
}
