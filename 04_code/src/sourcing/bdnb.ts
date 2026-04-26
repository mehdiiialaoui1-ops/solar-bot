/**
 * =============================================================================
 * ERE SOLAR BOT - Client API BDNB (CSTB)
 * =============================================================================
 * Recupere les batiments tertiaires d'une commune via la BDNB
 * (Base de Donnees Nationale du Batiment).
 *
 * Endpoint utilise :
 *   GET https://bdnb.io/api/v1/donnees/batiment_groupe
 *       ?code_insee={code}
 *       &usage_principal_bdnb_open=tertiaire
 *       &surface_activite_min=500
 *
 * La BDNB renvoie des reponses paginees (pagination par cursor `next`).
 * Cette couche se charge du fetch + parsing + iteration sur les pages.
 * =============================================================================
 */

import type {
  BdnbBatiment,
  BdnbReponse,
  ProspectCandidat,
} from './types'
import { SourcingError } from './types'

/** Endpoint BDNB - batiment groupe */
export const BDNB_ENDPOINT =
  'https://bdnb.io/api/v1/donnees/batiment_groupe'

/** Timeout par defaut (ms) */
export const DEFAULT_TIMEOUT_MS = 15_000

/** Surface minimale loi APER 2026 (m2) */
export const SURFACE_APER_M2 = 500

/** Maximum de pages a recuperer pour eviter de boucler indefiniment */
export const DEFAULT_MAX_PAGES = 20

export interface FetchBatimentsOptions {
  /** Code INSEE de la commune (5 chiffres) */
  codeInsee: string
  /** Surface minimale (m2). Defaut : 500 (APER) */
  surfaceMinM2?: number
  /** Usage principal BDNB. Defaut : 'tertiaire'. Peut etre 'industriel' aussi */
  usagePrincipal?: 'tertiaire' | 'industriel' | string
  /** Nombre maximum de pages a parcourir (securite anti-boucle) */
  maxPages?: number
  /** Timeout reseau */
  timeoutMs?: number
  /** Surcharge fetch pour tests */
  fetchImpl?: typeof fetch
}

export function buildBdnbUrl(opts: {
  codeInsee: string
  surfaceMinM2?: number
  usagePrincipal?: string
}): string {
  if (!/^\d{5}$/.test(opts.codeInsee)) {
    throw new SourcingError(
      `Code INSEE invalide : "${opts.codeInsee}" (attendu 5 chiffres)`,
      'INVALID_INPUT',
    )
  }
  const url = new URL(BDNB_ENDPOINT)
  url.searchParams.set('code_insee', opts.codeInsee)
  url.searchParams.set(
    'usage_principal_bdnb_open',
    opts.usagePrincipal ?? 'tertiaire',
  )
  url.searchParams.set(
    'surface_activite_min',
    String(opts.surfaceMinM2 ?? SURFACE_APER_M2),
  )
  return url.toString()
}

/**
 * Recupere une seule page BDNB. Helper interne, exporte pour les tests.
 */
export async function fetchBdnbPage(
  url: string,
  fetchImpl: typeof fetch,
  timeoutMs: number,
): Promise<BdnbReponse> {
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

  if (
    !json ||
    typeof json !== 'object' ||
    !Array.isArray((json as { results?: unknown }).results)
  ) {
    throw new SourcingError(
      'Reponse BDNB inattendue : tableau "results" manquant',
      'PARSE_ERROR',
    )
  }

  return json as BdnbReponse
}

/**
 * Fetch toutes les pages BDNB pour une commune et concatene les resultats.
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

  const firstUrl = buildBdnbUrl({
    codeInsee: opts.codeInsee,
    surfaceMinM2: opts.surfaceMinM2,
    usagePrincipal: opts.usagePrincipal,
  })

  const collected: BdnbBatiment[] = []
  let nextUrl: string | null = firstUrl
  let pages = 0

  while (nextUrl && pages < maxPages) {
    const page: BdnbReponse = await fetchBdnbPage(nextUrl, fetchImpl, timeoutMs)
    collected.push(...page.results)
    nextUrl = page.next ?? null
    pages++
  }

  return collected
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
 * Convertit un batiment BDNB en ProspectCandidat. Retourne `null` si
 * les champs minimaux (surface, INSEE, coordonnees) sont absents.
 */
export function bdnbVersProspectCandidat(
  bat: BdnbBatiment,
  fallbackCommune = '',
): ProspectCandidat | null {
  if (
    !bat.code_insee ||
    typeof bat.surface_activite !== 'number' ||
    bat.surface_activite < SURFACE_APER_M2
  ) {
    return null
  }

  // Localisation : on essaie WKT centroide, puis lat/lng explicites
  const coords =
    parseWktPoint(bat.geom_centroide) ??
    (typeof bat.latitude === 'number' && typeof bat.longitude === 'number'
      ? { lat: bat.latitude, lng: bat.longitude }
      : null)
  if (!coords) return null

  return {
    adresse: bat.libelle_adr_principale_ban ?? `Bâtiment BDNB ${bat.batiment_groupe_id}`,
    code_postal: bat.code_postal ?? '',
    commune: fallbackCommune,
    code_insee: bat.code_insee,
    lat: coords.lat,
    lng: coords.lng,
    surface_m2: bat.surface_activite,
    usage: bat.usage_principal_bdnb_open ?? 'tertiaire',
    nb_etages: bat.nb_niveau ?? null,
    annee_construction: bat.annee_construction ?? null,
    siret_proprietaire: bat.siret_proprietaire ?? null,
    parcelle_id: bat.batiment_groupe_id,
    source: 'bdnb',
  }
}
