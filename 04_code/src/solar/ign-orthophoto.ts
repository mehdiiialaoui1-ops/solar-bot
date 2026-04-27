/**
 * =============================================================================
 * ERE SOLAR BOT - Client IGN Geoplateforme WMS (orthophotos)
 * =============================================================================
 * Remplace Google Maps Static API. Genere une URL d'image aerienne
 * centree sur des coordonnees GPS via le WMS de l'IGN.
 *
 * Endpoint WMS :
 *   https://data.geopf.fr/wms-r/wms
 *
 * Couche utilisee : ORTHOIMAGERY.ORTHOPHOTOS
 * Pas de cle API necessaire — API ouverte.
 *
 * Contrairement a Google Maps Static qui retourne du PNG directement,
 * le WMS IGN demande une bounding box en coordonnees geographiques.
 * On calcule la bbox depuis lat/lng + zoom + taille image.
 * =============================================================================
 */

import { SolarApiError } from './types'

export const IGN_WMS_URL =
  process.env.IGN_WMS_URL ?? 'https://data.geopf.fr/wms-r/wms'

export const IGN_LAYER = 'ORTHOIMAGERY.ORTHOPHOTOS'

// ----------------------------------------------------------------------------
// Helpers de calcul de bbox
// ----------------------------------------------------------------------------

/**
 * Calcule les metres par pixel pour un niveau de zoom Google-like.
 * Formule standard Mercator : 156543.03 * cos(lat) / 2^zoom
 */
function metresParPixel(lat: number, zoom: number): number {
  return (156543.03 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom)
}

/**
 * Calcule une bounding box EPSG:4326 (lon/lat) depuis un centre,
 * une taille d'image en pixels et un niveau de zoom.
 */
export function calculerBbox(opts: {
  lat: number
  lng: number
  zoom: number
  width: number
  height: number
}): { minLng: number; minLat: number; maxLng: number; maxLat: number } {
  const mpp = metresParPixel(opts.lat, opts.zoom)

  // Demi-largeur et demi-hauteur en metres
  const halfWidthM = (opts.width / 2) * mpp
  const halfHeightM = (opts.height / 2) * mpp

  // Conversion metres -> degres (approximation valable en France)
  const dLat = halfHeightM / 111320
  const dLng = halfWidthM / (111320 * Math.cos((opts.lat * Math.PI) / 180))

  return {
    minLng: opts.lng - dLng,
    minLat: opts.lat - dLat,
    maxLng: opts.lng + dLng,
    maxLat: opts.lat + dLat,
  }
}

// ----------------------------------------------------------------------------
// Construction URL WMS
// ----------------------------------------------------------------------------

export interface BuildOrthophotoUrlOptions {
  lat: number
  lng: number
  /** Niveau de zoom (equivalent Google). Defaut : 20 */
  zoom?: number
  /** Largeur en pixels. Defaut : 800 */
  width?: number
  /** Hauteur en pixels. Defaut : 600 */
  height?: number
  /** Format image. Defaut : 'image/jpeg' */
  format?: 'image/jpeg' | 'image/png'
}

/**
 * Construit l'URL WMS IGN pour obtenir une orthophoto aerienne.
 * L'URL retournee est directement utilisable comme `src` d'une balise <img>.
 */
export function buildOrthophotoUrl(opts: BuildOrthophotoUrlOptions): string {
  if (!Number.isFinite(opts.lat) || !Number.isFinite(opts.lng)) {
    throw new SolarApiError(
      `Coordonnees invalides : lat=${opts.lat}, lng=${opts.lng}`,
      'INVALID_INPUT',
    )
  }

  const zoom = opts.zoom ?? 20
  const width = opts.width ?? 800
  const height = opts.height ?? 600
  const format = opts.format ?? 'image/jpeg'

  const bbox = calculerBbox({ lat: opts.lat, lng: opts.lng, zoom, width, height })

  const url = new URL(IGN_WMS_URL)
  url.searchParams.set('SERVICE', 'WMS')
  url.searchParams.set('VERSION', '1.3.0')
  url.searchParams.set('REQUEST', 'GetMap')
  url.searchParams.set('LAYERS', IGN_LAYER)
  url.searchParams.set('CRS', 'EPSG:4326')
  // WMS 1.3.0 avec EPSG:4326 : BBOX = minLat,minLng,maxLat,maxLng
  url.searchParams.set(
    'BBOX',
    `${bbox.minLat},${bbox.minLng},${bbox.maxLat},${bbox.maxLng}`,
  )
  url.searchParams.set('WIDTH', String(width))
  url.searchParams.set('HEIGHT', String(height))
  url.searchParams.set('FORMAT', format)
  url.searchParams.set('STYLES', '')
  return url.toString()
}

/**
 * Recupere l'image orthophoto et renvoie un ArrayBuffer.
 * (Pour le microsite on utilisera plutot l'URL directe.)
 */
export async function fetchOrthophoto(
  opts: BuildOrthophotoUrlOptions & {
    timeoutMs?: number
    fetchImpl?: typeof fetch
  },
): Promise<ArrayBuffer> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const url = buildOrthophotoUrl(opts)
  const timeoutMs = opts.timeoutMs ?? 15_000

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetchImpl(url, { signal: controller.signal })
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new SolarApiError(`Timeout IGN WMS apres ${timeoutMs}ms`, 'TIMEOUT', err)
    }
    throw new SolarApiError(
      `Erreur reseau IGN WMS : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    throw new SolarApiError(
      `IGN WMS HTTP ${res.status} ${res.statusText}`,
      'HTTP_ERROR',
    )
  }

  return await res.arrayBuffer()
}
