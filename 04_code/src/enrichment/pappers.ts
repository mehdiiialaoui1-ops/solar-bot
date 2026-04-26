/**
 * =============================================================================
 * ERE SOLAR BOT - Client Pappers API
 * =============================================================================
 * Endpoint utilisé :
 *   GET https://api.pappers.fr/v2/entreprise?siren={siren}&api_token={token}
 *
 * Récupère pour un SIREN : les représentants actifs (dirigeants), les
 * bénéficiaires effectifs (fallback PME), et l'adresse / site web du siège.
 *
 * Mapping qualité Pappers → rang ciblage selon spec strategie_enrichissement.md.
 * =============================================================================
 */

import type {
  Dirigeant,
  PappersEntreprise,
  PappersRepresentant,
  RangCiblage,
} from './types'
import { EnrichmentError } from './types'

export const PAPPERS_ENDPOINT = 'https://api.pappers.fr/v2/entreprise'
export const DEFAULT_TIMEOUT_MS = 10_000

export interface FetchEntrepriseOptions {
  siren: string
  apiToken: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export function buildPappersUrl(opts: { siren: string; apiToken: string }): string {
  if (!/^\d{9}$/.test(opts.siren)) {
    throw new EnrichmentError(
      `SIREN invalide : "${opts.siren}" (attendu 9 chiffres)`,
      'INVALID_INPUT',
    )
  }
  if (!opts.apiToken || opts.apiToken.length < 10) {
    throw new EnrichmentError('Token Pappers manquant ou invalide', 'INVALID_INPUT')
  }
  const url = new URL(PAPPERS_ENDPOINT)
  url.searchParams.set('siren', opts.siren)
  url.searchParams.set('api_token', opts.apiToken)
  return url.toString()
}

/**
 * Fetch une entreprise par SIREN.
 * @throws EnrichmentError - 'SIREN_NOT_FOUND' (404), 'RATE_LIMITED' (429), etc.
 */
export async function fetchEntreprise(
  opts: FetchEntrepriseOptions,
): Promise<PappersEntreprise> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new EnrichmentError('fetch indisponible', 'INVALID_INPUT')
  }

  const url = buildPappersUrl(opts)
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
      throw new EnrichmentError(`Timeout Pappers apres ${timeoutMs}ms`, 'TIMEOUT', err)
    }
    throw new EnrichmentError(
      `Erreur reseau Pappers : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 404) {
    throw new EnrichmentError(`SIREN ${opts.siren} introuvable`, 'SIREN_NOT_FOUND')
  }
  if (res.status === 429) {
    throw new EnrichmentError('Pappers rate limit (429)', 'RATE_LIMITED')
  }
  if (!res.ok) {
    throw new EnrichmentError(
      `Pappers HTTP ${res.status} ${res.statusText}`,
      'HTTP_ERROR',
    )
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    throw new EnrichmentError('Reponse Pappers illisible', 'PARSE_ERROR', err)
  }

  if (!json || typeof json !== 'object' || !(json as { siren?: unknown }).siren) {
    throw new EnrichmentError('Reponse Pappers inattendue : siren manquant', 'PARSE_ERROR')
  }
  return json as PappersEntreprise
}

// ----------------------------------------------------------------------------
// Mapping qualité Pappers → rang ciblage
// ----------------------------------------------------------------------------

/**
 * Détermine le rang de ciblage à partir de la qualité Pappers.
 * Chaîne de matching insensible à la casse, par stems pour gérer
 * les formes féminines (Présidente, Directrice, etc.) et masculines.
 */
export function qualiteVersRang(qualite: string | undefined): RangCiblage {
  if (!qualite) return 6
  const q = qualite.toLowerCase()

  // Rang 1 - Propriétaire-dirigeant (président·e, gérant·e)
  if (
    q.includes('président') ||  // président, présidente, président du directoire
    q.includes('president') ||  // sans accent
    q.includes('gérant') ||     // gérant, gérante
    q.includes('gerant')        // sans accent
  ) {
    return 1
  }

  const motDirecteur = q.includes('directeur') || q.includes('directrice')

  // Rang 2 - Directeur·trice général·e (couvre DG délégué·e aussi)
  if (
    (motDirecteur && (q.includes('général') || q.includes('general'))) ||
    q === 'dg'
  ) {
    return 2
  }
  // Rang 3 - DAF (administratif·ve et financier·ère, ou directeur·trice financier·ère)
  if (q.includes('administrati') && q.includes('financ')) {
    return 3
  }
  if (motDirecteur && q.includes('financ')) {
    return 3
  }
  if (q === 'daf') {
    return 3
  }
  // Rang 4 - Immobilier / patrimoine
  if (q.includes('immobil') || q.includes('patrimoine')) {
    return 4
  }
  // Rang 5 - RSE / Développement durable
  if (
    q.includes('rse') ||
    q.includes('développement durable') ||
    q.includes('developpement durable')
  ) {
    return 5
  }
  return 6
}

// ----------------------------------------------------------------------------
// Extraction des dirigeants (filtrage + tri)
// ----------------------------------------------------------------------------

function representantActif(r: PappersRepresentant): boolean {
  return !r.date_fin_poste && !!r.nom
}

/**
 * Convertit la réponse Pappers en liste de Dirigeants triés par rang
 * (les plus prioritaires en premier). Limite par défaut : 3.
 *
 * Si aucun représentant actif, fallback sur le bénéficiaire effectif principal.
 */
export function extraireDirigeants(
  entreprise: PappersEntreprise,
  topN = 3,
): Dirigeant[] {
  const reps = entreprise.representants?.filter(representantActif) ?? []

  if (reps.length > 0) {
    const dirigeants = reps.map<Dirigeant>((r) => ({
      prenom: r.prenom ?? '',
      nom: r.nom,
      titre: r.qualite ?? 'Représentant',
      rang_ciblage: qualiteVersRang(r.qualite),
      date_prise_poste: r.date_prise_poste,
      source_enrichment: 'pappers_representant',
    }))
    dirigeants.sort((a, b) => a.rang_ciblage - b.rang_ciblage)
    return dirigeants.slice(0, topN)
  }

  // Fallback bénéficiaire effectif
  const ben = entreprise.beneficiaires_effectifs?.[0]
  if (ben?.nom) {
    return [
      {
        prenom: ben.prenom ?? '',
        nom: ben.nom,
        titre: 'Bénéficiaire effectif',
        rang_ciblage: 1,
        source_enrichment: 'pappers_beneficiaire',
      },
    ]
  }

  return []
}
