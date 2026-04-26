/**
 * =============================================================================
 * ERE SOLAR BOT - Client API Cadastre IGN (apicarto)
 * =============================================================================
 * Recupere les parcelles cadastrales d'une commune par son code INSEE.
 *
 * Endpoint utilise :
 *   GET https://apicarto.ign.fr/api/cadastre/parcelle?code_insee={code}
 *
 * L'API IGN renvoie du GeoJSON (FeatureCollection). Chaque feature represente
 * une parcelle avec sa geometrie et ses proprietes administratives. La
 * surface de la parcelle est dans `properties.contenance` (en m2).
 *
 * NB : cette couche se contente de fetch + parser. La logique metier
 * (filtrage taille, croisement BDNB, calcul du score) est dans index.ts.
 * =============================================================================
 */

import type {
  IgnParcelleCollection,
  IgnParcelleFeature,
} from './types'
import { SourcingError } from './types'

/** Endpoint apicarto IGN - parcelle cadastrale */
export const IGN_CADASTRE_ENDPOINT =
  'https://apicarto.ign.fr/api/cadastre/parcelle'

/** Timeout par defaut (ms). L'API IGN peut etre lente sur des grosses communes. */
export const DEFAULT_TIMEOUT_MS = 15_000

export interface FetchParcellesOptions {
  /** Code INSEE de la commune (5 chiffres). */
  codeInsee: string
  /** Section cadastrale optionnelle pour reduire la volumetrie */
  section?: string
  /** Numero de parcelle optionnel (rarement utilise au sourcing) */
  numero?: string
  /** Timeout reseau en millisecondes. Defaut : 15 000 ms. */
  timeoutMs?: number
  /** Surcharge du fetch (utile pour les tests). Defaut : globalThis.fetch */
  fetchImpl?: typeof fetch
}

/**
 * Construit l'URL d'appel apicarto IGN cadastre/parcelle.
 *
 * Exporte pour permettre des tests d'URL et le debug.
 */
export function buildIgnUrl(opts: {
  codeInsee: string
  section?: string
  numero?: string
}): string {
  if (!/^\d{5}$/.test(opts.codeInsee)) {
    throw new SourcingError(
      `Code INSEE invalide : "${opts.codeInsee}" (attendu 5 chiffres)`,
      'INVALID_INPUT',
    )
  }
  const url = new URL(IGN_CADASTRE_ENDPOINT)
  url.searchParams.set('code_insee', opts.codeInsee)
  if (opts.section) url.searchParams.set('section', opts.section)
  if (opts.numero) url.searchParams.set('numero', opts.numero)
  return url.toString()
}

/**
 * Fetch les parcelles cadastrales d'une commune via l'API IGN.
 *
 * @returns la FeatureCollection brute renvoyee par l'API.
 * @throws SourcingError en cas d'erreur reseau, timeout, parse ou HTTP non 2xx.
 */
export async function fetchParcelles(
  opts: FetchParcellesOptions,
): Promise<IgnParcelleCollection> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new SourcingError(
      'fetch indisponible (Node < 18 ?). Passez fetchImpl explicitement.',
      'INVALID_INPUT',
    )
  }

  const url = buildIgnUrl({
    codeInsee: opts.codeInsee,
    section: opts.section,
    numero: opts.numero,
  })
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
      throw new SourcingError(
        `Timeout IGN apres ${timeoutMs}ms (${url})`,
        'TIMEOUT',
        err,
      )
    }
    throw new SourcingError(
      `Erreur reseau IGN : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    throw new SourcingError(
      `IGN HTTP ${res.status} ${res.statusText} sur ${url}`,
      'HTTP_ERROR',
    )
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    throw new SourcingError('Reponse IGN illisible (JSON parse)', 'PARSE_ERROR', err)
  }

  if (
    !json ||
    typeof json !== 'object' ||
    (json as { type?: unknown }).type !== 'FeatureCollection' ||
    !Array.isArray((json as { features?: unknown }).features)
  ) {
    throw new SourcingError(
      'Reponse IGN inattendue : FeatureCollection manquante',
      'PARSE_ERROR',
    )
  }

  return json as IgnParcelleCollection
}

/**
 * Filtre les parcelles a partir d'une surface minimale (m2).
 * La cible loi APER 2026 = >= 500 m2 mais on permet de surcharger.
 *
 * Une parcelle sans `contenance` est ecartee silencieusement
 * (pas exploitable pour le sourcing solaire).
 */
export function filtrerParcellesParSurface(
  features: IgnParcelleFeature[],
  surfaceMinM2 = 500,
): IgnParcelleFeature[] {
  return features.filter(
    (f) =>
      typeof f.properties?.contenance === 'number' &&
      f.properties.contenance >= surfaceMinM2,
  )
}

/**
 * Calcule le centroide approximatif d'une parcelle (moyenne des
 * coordonnees du polygone exterieur). Suffisant pour pre-localiser
 * un candidat avant le geocodage fin BAN.
 *
 * Retourne `null` si la geometrie est inexploitable.
 */
export function centroideParcelle(
  feature: IgnParcelleFeature,
): { lat: number; lng: number } | null {
  const geom = feature.geometry
  if (!geom) return null

  // On accepte Polygon (number[][][]) et MultiPolygon (number[][][][])
  // En GeoJSON, l'ordre est [longitude, latitude].
  let ring: number[][] | undefined
  if (geom.type === 'Polygon') {
    const coords = geom.coordinates as number[][][]
    ring = coords?.[0]
  } else if (geom.type === 'MultiPolygon') {
    const coords = geom.coordinates as number[][][][]
    ring = coords?.[0]?.[0]
  }
  if (!ring || ring.length === 0) return null

  let sumLng = 0
  let sumLat = 0
  for (const [lng, lat] of ring) {
    sumLng += lng
    sumLat += lat
  }
  return { lng: sumLng / ring.length, lat: sumLat / ring.length }
}
