/**
 * =============================================================================
 * ERE SOLAR BOT - Client Google Maps Static API
 * =============================================================================
 * Endpoint utilise :
 *   GET https://maps.googleapis.com/maps/api/staticmap
 *       ?center={lat},{lng}
 *       &zoom={z}
 *       &size={W}x{H}
 *       &maptype=satellite
 *       &key={API_KEY}
 *
 * Renvoie une image satellite PNG/JPG centree sur les coordonnees
 * fournies. Servira de fond pour l'overlay des panneaux solaires
 * dans le microsite.
 * =============================================================================
 */

import { SolarApiError } from './types'

export const GOOGLE_MAPS_STATIC_ENDPOINT =
  'https://maps.googleapis.com/maps/api/staticmap'

export type MapType = 'satellite' | 'hybrid' | 'roadmap' | 'terrain'

export interface BuildStaticMapUrlOptions {
  lat: number
  lng: number
  apiKey: string
  /** Niveau de zoom (0=monde, 21=batiment). Defaut : 20 */
  zoom?: number
  /** Largeur en pixels (max 640 free, 2048 premium). Defaut : 600 */
  width?: number
  /** Hauteur en pixels. Defaut : 400 */
  height?: number
  /** Multiplicateur retina (1 ou 2). Defaut : 2 */
  scale?: 1 | 2
  /** Type de carte. Defaut : 'satellite' */
  mapType?: MapType
}

export function buildStaticMapUrl(opts: BuildStaticMapUrlOptions): string {
  if (!Number.isFinite(opts.lat) || !Number.isFinite(opts.lng)) {
    throw new SolarApiError(
      `Coordonnees invalides : lat=${opts.lat}, lng=${opts.lng}`,
      'INVALID_INPUT',
    )
  }
  if (!opts.apiKey || opts.apiKey.length < 20) {
    throw new SolarApiError('Cle API Google Maps manquante ou invalide', 'INVALID_INPUT')
  }
  const zoom = opts.zoom ?? 20
  if (zoom < 0 || zoom > 21) {
    throw new SolarApiError(`Zoom invalide : ${zoom} (attendu 0-21)`, 'INVALID_INPUT')
  }
  const width = opts.width ?? 600
  const height = opts.height ?? 400

  const url = new URL(GOOGLE_MAPS_STATIC_ENDPOINT)
  url.searchParams.set('center', `${opts.lat},${opts.lng}`)
  url.searchParams.set('zoom', String(zoom))
  url.searchParams.set('size', `${width}x${height}`)
  url.searchParams.set('scale', String(opts.scale ?? 2))
  url.searchParams.set('maptype', opts.mapType ?? 'satellite')
  url.searchParams.set('key', opts.apiKey)
  return url.toString()
}

/**
 * Recupere l'image satellite et renvoie un Buffer/ArrayBuffer.
 * (Pour le microsite on utilisera plutot l'URL directe.)
 */
export async function fetchStaticMap(
  opts: BuildStaticMapUrlOptions & {
    timeoutMs?: number
    fetchImpl?: typeof fetch
  },
): Promise<ArrayBuffer> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const url = buildStaticMapUrl(opts)
  const timeoutMs = opts.timeoutMs ?? 10_000

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetchImpl(url, { signal: controller.signal })
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new SolarApiError(`Timeout Maps Static apres ${timeoutMs}ms`, 'TIMEOUT', err)
    }
    throw new SolarApiError(
      `Erreur reseau Maps Static : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    throw new SolarApiError(
      `Maps Static HTTP ${res.status} ${res.statusText}`,
      'HTTP_ERROR',
    )
  }

  return await res.arrayBuffer()
}

// ----------------------------------------------------------------------------
// Conversion GPS -> pixel (Mercator) pour overlay
// ----------------------------------------------------------------------------

/**
 * Convertit une coordonnee GPS (lat, lng) en coordonnee pixel relative
 * au centre d'une image Maps Static. Indispensable pour positionner
 * les panneaux solaires en overlay sur l'image satellite.
 *
 * Modele Mercator simplifie - precis a +/- 1 pixel pour zoom 18-21
 * et taille d'image standard.
 *
 * Reutilise la logique existante dans @/lib/calculs-solaires::gpsVersPixel
 * (testee 40 fois en J1).
 */
export function gpsVersPixelImage(opts: {
  lat: number
  lng: number
  centerLat: number
  centerLng: number
  zoom: number
  width: number
  height: number
}): { x: number; y: number } {
  const TILE_SIZE = 256
  const scale = TILE_SIZE * Math.pow(2, opts.zoom)

  // Projection Mercator du centre
  const centerSinLat = Math.sin((opts.centerLat * Math.PI) / 180)
  const centerWorldX = (scale * (opts.centerLng + 180)) / 360
  const centerWorldY =
    scale *
    (0.5 -
      Math.log((1 + centerSinLat) / (1 - centerSinLat)) / (4 * Math.PI))

  // Projection Mercator du point cible
  const sinLat = Math.sin((opts.lat * Math.PI) / 180)
  const worldX = (scale * (opts.lng + 180)) / 360
  const worldY =
    scale * (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI))

  // Decalage pixel par rapport au centre, ramene a la taille de l'image
  const dx = worldX - centerWorldX
  const dy = worldY - centerWorldY

  return {
    x: Math.round(opts.width / 2 + dx),
    y: Math.round(opts.height / 2 + dy),
  }
}
