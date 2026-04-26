/**
 * =============================================================================
 * ERE SOLAR BOT - Client Dropcontact API (batch enrichissement email)
 * =============================================================================
 * Endpoint utilisé :
 *   POST https://api.dropcontact.io/batch
 *   Header : X-Access-Token: {token}
 *
 * Spec : 01_specs/strategie_enrichissement.md
 * - Batch de 25 contacts max par appel
 * - Filtre emails perso (gmail, hotmail, yahoo) - rejetés
 * - Ne conserve que les emails qualification = "valid"
 * =============================================================================
 */

import type {
  Dirigeant,
  DropcontactBatchResponse,
  DropcontactResult,
} from './types'
import { EnrichmentError } from './types'

export const DROPCONTACT_ENDPOINT = 'https://api.dropcontact.io/batch'
export const DEFAULT_TIMEOUT_MS = 60_000
export const BATCH_SIZE_MAX = 25

/** Domaines emails personnels à rejeter (jamais des emails pros) */
export const EMAIL_DOMAINS_PERSO = new Set([
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.fr',
  'outlook.com',
  'outlook.fr',
  'yahoo.com',
  'yahoo.fr',
  'live.com',
  'live.fr',
  'free.fr',
  'orange.fr',
  'wanadoo.fr',
  'sfr.fr',
  'laposte.net',
])

export interface DropcontactInputContact {
  first_name: string
  last_name: string
  company?: string
  siren?: string
}

export interface EnrichBatchOptions {
  apiToken: string
  contacts: DropcontactInputContact[]
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

/**
 * Envoie un batch (max 25) à Dropcontact et récupère les résultats.
 * NB : Dropcontact peut être asynchrone et retourner un request_id à
 * poller. Cette implémentation suppose la réponse synchrone (mode batch
 * v2). Si Dropcontact bascule en async, il faudra ajouter une boucle
 * de polling sur GET /batch/{request_id}.
 */
export async function enrichBatch(
  opts: EnrichBatchOptions,
): Promise<DropcontactResult[]> {
  if (opts.contacts.length === 0) return []
  if (opts.contacts.length > BATCH_SIZE_MAX) {
    throw new EnrichmentError(
      `Batch trop grand : ${opts.contacts.length} contacts (max ${BATCH_SIZE_MAX})`,
      'INVALID_INPUT',
    )
  }
  if (!opts.apiToken || opts.apiToken.length < 10) {
    throw new EnrichmentError('Token Dropcontact manquant ou invalide', 'INVALID_INPUT')
  }

  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetchImpl(DROPCONTACT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Access-Token': opts.apiToken,
      },
      body: JSON.stringify({
        data: opts.contacts,
        siren: true,
        language: 'fr',
      }),
      signal: controller.signal,
    })
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new EnrichmentError(`Timeout Dropcontact ${timeoutMs}ms`, 'TIMEOUT', err)
    }
    throw new EnrichmentError(
      `Erreur reseau Dropcontact : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 429) {
    throw new EnrichmentError('Dropcontact rate limit (429)', 'RATE_LIMITED')
  }
  if (!res.ok) {
    throw new EnrichmentError(
      `Dropcontact HTTP ${res.status} ${res.statusText}`,
      'HTTP_ERROR',
    )
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    throw new EnrichmentError('Reponse Dropcontact illisible', 'PARSE_ERROR', err)
  }
  if (!json || !Array.isArray((json as DropcontactBatchResponse).data)) {
    throw new EnrichmentError(
      'Reponse Dropcontact inattendue : tableau "data" manquant',
      'PARSE_ERROR',
    )
  }
  return (json as DropcontactBatchResponse).data
}

// ----------------------------------------------------------------------------
// Filtrage / qualification des emails retournés
// ----------------------------------------------------------------------------

/**
 * Vrai si l'email est un email personnel (gmail.com, etc.) à rejeter.
 */
export function estEmailPerso(email: string): boolean {
  const at = email.lastIndexOf('@')
  if (at === -1) return true
  const domaine = email.slice(at + 1).toLowerCase()
  return EMAIL_DOMAINS_PERSO.has(domaine)
}

/**
 * Sélectionne le meilleur email d'un résultat Dropcontact :
 * - qualification = "valid"
 * - n'est pas un email personnel
 *
 * Retourne null si aucun email exploitable.
 */
export function selectionnerEmailPro(
  result: DropcontactResult,
): { email: string; verifie: boolean } | null {
  const emails = result.email ?? []
  for (const e of emails) {
    if (!e.email) continue
    if (estEmailPerso(e.email)) continue
    if (e.qualification === 'valid') {
      return { email: e.email, verifie: true }
    }
  }
  // En second recours : un email pro non-vérifié est mieux que rien
  for (const e of emails) {
    if (e.email && !estEmailPerso(e.email)) {
      return { email: e.email, verifie: false }
    }
  }
  return null
}

// ----------------------------------------------------------------------------
// Préparation des contacts pour l'API depuis nos Dirigeants
// ----------------------------------------------------------------------------

export function dirigeantVersInputDropcontact(
  d: Dirigeant,
  raisonSociale: string,
  siren: string,
): DropcontactInputContact {
  return {
    first_name: d.prenom,
    last_name: d.nom,
    company: raisonSociale,
    siren,
  }
}
