/**
 * =============================================================================
 * ERE SOLAR BOT - Client Lemlist API (envoi emails outreach)
 * =============================================================================
 * Endpoint utilisé :
 *   POST https://api.lemlist.com/api/campaigns/{campaignId}/leads/{email}
 *   Header : Authorization: Basic base64(":" + apiKey)
 *
 * Lemlist gère la séquence d'envoi (J0, J3, J5) côté serveur. Notre rôle
 * est juste d'ajouter le lead à la campagne avec les variables custom.
 * =============================================================================
 */

import type { LemlistAddLeadResponse, LemlistLead } from './types'
import { OutreachError } from './types'

export const LEMLIST_BASE = 'https://api.lemlist.com/api'
export const DEFAULT_TIMEOUT_MS = 15_000

export interface AddLeadOptions {
  campaignId: string
  lead: LemlistLead
  apiKey: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

/**
 * Construit le header Authorization Basic pour Lemlist.
 * Lemlist attend Basic ":apikey" (username vide, password = clé).
 */
export function buildAuthHeader(apiKey: string): string {
  if (!apiKey || apiKey.length < 10) {
    throw new OutreachError('Clé API Lemlist manquante ou invalide', 'INVALID_INPUT')
  }
  // btoa est dispo en Node 16+ et browser
  const encoded =
    typeof btoa !== 'undefined'
      ? btoa(`:${apiKey}`)
      : Buffer.from(`:${apiKey}`).toString('base64')
  return `Basic ${encoded}`
}

export function buildAddLeadUrl(campaignId: string, email: string): string {
  if (!campaignId || campaignId.length < 5) {
    throw new OutreachError(`campaignId invalide : "${campaignId}"`, 'INVALID_INPUT')
  }
  if (!email || !email.includes('@')) {
    throw new OutreachError(`Email lead invalide : "${email}"`, 'INVALID_INPUT')
  }
  return `${LEMLIST_BASE}/campaigns/${encodeURIComponent(
    campaignId,
  )}/leads/${encodeURIComponent(email)}`
}

/**
 * Ajoute un lead à une campagne Lemlist. Si le lead existe deja
 * (duplicate) ou si la campagne est en pause, on retourne un statut
 * specifique sans lever d'erreur.
 */
export async function addLead(
  opts: AddLeadOptions,
): Promise<LemlistAddLeadResponse> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new OutreachError('fetch indisponible', 'INVALID_INPUT')
  }

  const url = buildAddLeadUrl(opts.campaignId, opts.lead.email)
  const auth = buildAuthHeader(opts.apiKey)
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: auth,
      },
      body: JSON.stringify(opts.lead),
      signal: controller.signal,
    })
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new OutreachError(`Timeout Lemlist apres ${timeoutMs}ms`, 'TIMEOUT', err)
    }
    throw new OutreachError(
      `Erreur reseau Lemlist : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 409) {
    return {
      email: opts.lead.email,
      campaignId: opts.campaignId,
      status: 'duplicate',
    }
  }
  if (res.status === 423) {
    return {
      email: opts.lead.email,
      campaignId: opts.campaignId,
      status: 'paused',
    }
  }
  if (!res.ok) {
    throw new OutreachError(
      `Lemlist HTTP ${res.status} ${res.statusText}`,
      'HTTP_ERROR',
    )
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    throw new OutreachError('Reponse Lemlist illisible', 'PARSE_ERROR', err)
  }

  const data = json as LemlistAddLeadResponse
  return {
    _id: data._id,
    email: opts.lead.email,
    campaignId: opts.campaignId,
    status: 'added',
  }
}
