/**
 * =============================================================================
 * ERE SOLAR BOT - Client API BDNB (CSTB)
 * =============================================================================
 * Recupere les batiments tertiaires d'une commune via la BDNB
 * (Base de Donnees Nationale du Batiment).
 *
 * MIGRATION Janvier 2024 :
 *   L'ancienne API (bdnb.io/api/v1/donnees/batiment_groupe) a ete
 *   arretee le 30 juin 2024. La nouvelle API est hebergee sur le
 *   portail api-open.bdnb.io avec des filtres PostgREST.
 *
 * Endpoint utilise :
 *   GET https://api.bdnb.io/v1/bdnb/donnees/batiment_groupe_complet
 *       ?code_commune_insee=eq.{code}
 *       &usage_principal_bdnb_open=eq.tertiaire
 *       &limit={limit}
 *       &offset={offset}
 *
 * Filtrage surface : PostgREST ne supporte pas _min, on filtre cote client.
 * Pagination : offset-based (limit/offset), pas de cursor "next".
 * =============================================================================
 */

import type {
  BdnbBatiment,
  BdnbReponse,
  ProspectCandidat,
} from './types'
import { SourcingError } from './types'

/** Endpoint BDNB - batiment groupe complet (nouvelle API depuis jan 2024) */
export const BDNB_ENDPOINT =
  'https://api.bdnb.io/v1/bdnb/donnees/batiment_groupe_complet'

/** Timeout par defaut (ms) */
export const DEFAULT_TIMEOUT_MS = 15_000

/** Surface minimale loi APER 2026 (m2) */
export const SURFACE_APER_M2 = 500

/** Nombre de resultats par page (max 100 sur le plan Open BDNB) */
export const DEFAULT_PAGE_SIZE = 100

/** Maximum de pages a recuperer pour eviter de boucler indefiniment */
export const DEFAULT_MAX_PAGES = 20

export interface FetchBatimentsOptions {
  /** Code INSEE de la commune (5 chiffres) */
  codeInsee: string
  /** Surface minimale (m2). Defaut : 500 (APER) — filtre cote client */
  surfaceMinM2?: number
  /** Usages principaux BDNB. Defaut : ['Tertiaire', 'Industriel']. */
  usages?: string[]
  /** Nombre maximum de pages a parcourir (securite anti-boucle) */
  maxPages?: number
  /** Nombre de resultats par page */
  pageSize?: number
  /** Timeout reseau */
  timeoutMs?: number
  /** Surcharge fetch pour tests */
  fetchImpl?: typeof fetch
}

/**
 * Construit l'URL de la nouvelle API BDNB (PostgREST).
 *
 * Filtres PostgREST : operateur=eq.valeur
 * Pagination : limit + offset
 */
/** Usages cibles par defaut : tertiaire + industriel + mixte */
export const USAGES_CIBLES = ['Tertiaire', 'Industriel', 'Mixte']

export function buildBdnbUrl(opts: {
  codeInsee: string
  usages?: string[]
  limit?: number
  offset?: number
  /** Champ de filtre commune. 'commune_parente' pour Paris/Lyon/Marseille */
  communeField?: 'code_commune_insee' | 'commune_parente'
}): string {
  if (!/^\d{5}$/.test(opts.codeInsee)) {
    throw new SourcingError(
      `Code INSEE invalide : "${opts.codeInsee}" (attendu 5 chiffres)`,
      'INVALID_INPUT',
    )
  }
  const url = new URL(BDNB_ENDPOINT)
  // Filtre commune : code_commune_insee par defaut, commune_parente en fallback
  const field = opts.communeField ?? 'code_commune_insee'
  url.searchParams.set(field, `eq.${opts.codeInsee}`)
  // Filtre usage : operateur PostgREST in.() pour cibler plusieurs usages
  const usages = opts.usages ?? USAGES_CIBLES
  if (usages.length === 1) {
    url.searchParams.set('usage_principal_bdnb_open', `eq.${usages[0]}`)
  } else {
    url.searchParams.set(
      'usage_principal_bdnb_open',
      `in.(${usages.join(',')})`,
    )
  }
  // Pagination offset-based
  url.searchParams.set('limit', String(opts.limit ?? DEFAULT_PAGE_SIZE))
  if (opts.offset && opts.offset > 0) {
    url.searchParams.set('offset', String(opts.offset))
  }
  return url.toString()
}

/**
 * Recupere une page BDNB. La nouvelle API retourne un tableau JSON
 * directement (PostgREST), pas un objet {results, next}.
 */
export async function fetchBdnbPage(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<BdnbBatiment[]> {
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
        `Timeout BDNB apres ${timeoutMs}ms (${url})`,
        'TIMEOUT',
        err,
      )
    }
    throw new SourcingError(
      `Erreur reseau BDNB : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    throw new SourcingError(
      `BDNB HTTP ${res.status} ${res.statusText} sur ${url}`,
      'HTTP_ERROR',
    )
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    throw new SourcingError('Reponse BDNB illisible (JSON parse)', 'PARSE_ERROR', err)
  }

  // Nouvelle API : retourne un tableau JSON directement
  if (Array.isArray(json)) {
    return json as BdnbBatiment[]
  }

  // Retro-compat : ancien format {results: [...], next: ...}
  if (
    json &&
    typeof json === 'object' &&
    Array.isArray((json as BdnbReponse).results)
  ) {
    return (json as BdnbReponse).results
  }

  throw new SourcingError(
    'Reponse BDNB inattendue : ni tableau ni objet {results}',
    'PARSE_ERROR',
  )
}

/**
 * Fetch toutes les pages BDNB pour une commune et concatene les resultats.
 * Utilise la pagination offset-based de PostgREST.
 */
export async function fetchBatiments(
  opts: FetchBatimentsOptions,
): Promise<BdnbBatiment[]> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new SourcingError(
      'fetch indisponible (Node < 18 ?). Passez fetchImpl explicitement.',
      'INVALID_INPUT',
    )
  }
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxPages = opts.maxPages ?? DEFAULT_MAX_PAGES
  const pageSize = opts.pageSize ?? DEFAULT_PAGE_SIZE
  const surfaceMin = opts.surfaceMinM2 ?? SURFACE_APER_M2

  // Essai 1 : code_commune_insee (communes normales)
  // Essai 2 : commune_parente (Paris/Lyon/Marseille avec arrondissements)
  const communeFields: Array<'code_commune_insee' | 'commune_parente'> = [
    'code_commune_insee',
    'commune_parente',
  ]

  for (const communeField of communeFields) {
    const collected: BdnbBatiment[] = []
    let offset = 0
    let pages = 0

    while (pages < maxPages) {
      const url = buildBdnbUrl({
        codeInsee: opts.codeInsee,
        usages: opts.usages,
        limit: pageSize,
        offset,
        communeField,
      })

      const batch = await fetchBdnbPage(url, fetchImpl, timeoutMs)

      // Filtre surface cote client (PostgREST n'a pas de _min natif)
      for (const bat of batch) {
        if (
          typeof bat.s_geom_groupe === 'number' &&
          bat.s_geom_groupe >= surfaceMin
        ) {
          collected.push(bat)
        } else if (
          typeof bat.surface_activite === 'number' &&
          bat.surface_activite >= surfaceMin
        ) {
          collected.push(bat)
        }
      }

      // Si on a recu moins que la page size, c'est la derniere page
      if (batch.length < pageSize) break

      offset += pageSize
      pages++
    }

    // Si on a trouve des resultats, on retourne
    if (collected.length > 0) return collected

    // Sinon, on essaie le champ suivant (commune_parente)
  }

  // Aucun resultat ni par code_commune_insee ni par commune_parente
  return []
}

// ----------------------------------------------------------------------------
// Helpers de transformation BDNB -> ProspectCandidat
// ----------------------------------------------------------------------------

/**
 * Parse un POINT WKT du type "POINT(lng lat)" en {lat, lng}.
 * Retourne null si le format est inattendu.
 */
export function parseWktPoint(
  wkt: string | undefined,
): { lat: number; lng: number } | null {
  if (!wkt) return null
  const m = wkt.match(/POINT\s*\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/i)
  if (!m) return null
  const lng = Number(m[1])
  const lat = Number(m[2])
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
  return { lat, lng }
}

/**
 * Convertit des coordonnees Lambert 93 (EPSG:2154) en WGS84 (lat/lng).
 * Formule simplifiee mais suffisamment precise pour le sourcing (~10m).
 *
 * Source : IGN — algorithmes de projection conique conforme de Lambert
 * Parametres Lambert 93 : voir https://geodesie.ign.fr/contenu/fichiers/Lambert93.pdf
 */
export function lambert93ToWgs84(x: number, y: number): { lat: number; lng: number } {
  // Constantes Lambert 93
  const n = 0.7256077650
  const c = 11754255.426
  const xs = 700000.0
  const ys = 12655612.050
  const e = 0.08181919106

  const lng0 = 3.0 // meridien central (degres)

  const dx = x - xs
  const dy = y - ys
  const R = Math.sqrt(dx * dx + dy * dy)
  const gamma = Math.atan2(dx, -dy)

  const latIso = Math.log(c / R) / n
  const lng = lng0 + (gamma / n) * (180 / Math.PI)

  // Calcul iteratif de la latitude
  let lat = 2 * Math.atan(Math.exp(latIso)) - Math.PI / 2
  for (let i = 0; i < 10; i++) {
    const sinLat = Math.sin(lat)
    const eSinLat = e * sinLat
    lat = 2 * Math.atan(
      Math.exp(latIso) * Math.pow((1 + eSinLat) / (1 - eSinLat), e / 2),
    ) - Math.PI / 2
  }

  return { lat: lat * (180 / Math.PI), lng }
}

/**
 * Extrait un centroide approximatif d'une geometrie GeoJSON (string ou objet).
 * La BDNB retourne `geom_groupe` comme un objet GeoJSON (Polygon ou
 * MultiPolygon). Les coordonnees peuvent etre en EPSG:2154 (Lambert 93,
 * valeurs > 100000) ou en WGS84 (degres).
 */
export function parseGeoJsonCentroid(
  geom: string | Record<string, unknown> | undefined,
): { lat: number; lng: number } | null {
  if (!geom) return null

  let parsed: Record<string, unknown>
  if (typeof geom === 'string') {
    // Si c'est un WKT, on laisse parseWktPoint s'en charger
    if (geom.startsWith('POINT') || geom.startsWith('point')) return null
    try {
      parsed = JSON.parse(geom) as Record<string, unknown>
    } catch {
      return null
    }
  } else {
    parsed = geom
  }

  const type = parsed.type as string | undefined
  const coordinates = parsed.coordinates as number[][][] | number[][][][] | undefined
  if (!coordinates) return null

  // Extraire le premier anneau de coordonnees
  let ring: number[][]
  if (type === 'Polygon') {
    ring = (coordinates as number[][][])[0]
  } else if (type === 'MultiPolygon') {
    ring = (coordinates as number[][][][])[0]?.[0]
  } else {
    return null
  }

  if (!ring || ring.length === 0) return null

  // Centroide = moyenne des points
  let sumX = 0
  let sumY = 0
  for (const point of ring) {
    sumX += point[0]
    sumY += point[1]
  }
  const cx = sumX / ring.length
  const cy = sumY / ring.length

  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null

  // Detecter si les coordonnees sont en Lambert 93 (EPSG:2154)
  // Lambert 93 : x entre 100 000 et 1 300 000, y entre 6 000 000 et 7 200 000
  if (cx > 100_000 && cy > 1_000_000) {
    return lambert93ToWgs84(cx, cy)
  }

  // Sinon WGS84 classique : GeoJSON = [lng, lat]
  return { lat: cy, lng: cx }
}

/**
 * Convertit un batiment BDNB en ProspectCandidat. Retourne `null` si
 * les champs minimaux (surface, INSEE, coordonnees) sont absents.
 *
 * Supporte les deux formats (ancienne et nouvelle API).
 */
export function bdnbVersProspectCandidat(
  bat: BdnbBatiment,
  fallbackCommune = '',
): ProspectCandidat | null {
  // code_commune_insee (nouvelle API) ou code_insee (ancienne)
  const codeInsee = bat.code_commune_insee ?? bat.code_insee
  // s_geom_groupe (nouvelle API) ou surface_activite (ancienne)
  const surface = bat.s_geom_groupe ?? bat.surface_activite

  if (
    !codeInsee ||
    typeof surface !== 'number' ||
    surface < SURFACE_APER_M2
  ) {
    return null
  }

  // Localisation : WKT centroide > GeoJSON geom_groupe > lat/lng explicites
  const coords =
    parseWktPoint(bat.geom_centroide) ??
    parseGeoJsonCentroid(bat.geom_groupe) ??
    (typeof bat.latitude === 'number' && typeof bat.longitude === 'number'
      ? { lat: bat.latitude, lng: bat.longitude }
      : null)
  if (!coords) return null

  return {
    adresse: bat.libelle_adr_principale_ban ?? `Bâtiment BDNB ${bat.batiment_groupe_id}`,
    code_postal: bat.code_postal ?? '',
    commune: fallbackCommune,
    code_insee: codeInsee,
    lat: coords.lat,
    lng: coords.lng,
    surface_m2: surface,
    usage: bat.usage_principal_bdnb_open ?? 'tertiaire',
    nb_etages: bat.nb_niveau ?? null,
    annee_construction: bat.annee_construction ?? null,
    siret_proprietaire: bat.siret_proprietaire ?? bat.l_siren?.[0] ?? null,
    parcelle_id: bat.batiment_groupe_id,
    source: 'bdnb',
  }
}
