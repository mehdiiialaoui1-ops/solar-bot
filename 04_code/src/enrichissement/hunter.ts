/**
 * =============================================================================
 * ERE SOLAR BOT - Client API Hunter.io (enrichissement email)
 * =============================================================================
 * Remplace Dropcontact pour trouver les emails professionnels
 * des decideurs a partir du nom de domaine de l'entreprise.
 *
 * Endpoints utilises :
 *   GET https://api.hunter.io/v2/domain-search?domain={domain}&api_key={key}
 *   GET https://api.hunter.io/v2/email-verifier?email={email}&api_key={key}
 *   GET https://api.hunter.io/v2/email-finder?domain={domain}&first_name={}&last_name={}&api_key={key}
 *
 * Limites plan gratuit :
 *   - 25 recherches/mois (domain-search)
 *   - 50 verifications/mois (email-verifier)
 *
 * Strategie : Hunter.io d'abord, puis fallback pattern email + verification.
 * =============================================================================
 */

export const HUNTER_API_URL = 'https://api.hunter.io/v2'
export const DEFAULT_TIMEOUT_MS = 10_000

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface HunterEmail {
  value: string
  type: 'personal' | 'generic'
  confidence: number
  first_name?: string
  last_name?: string
  position?: string
  department?: string
  linkedin?: string
}

export interface HunterDomainResult {
  domain: string
  organization?: string
  emails: HunterEmail[]
  pattern?: string // ex: "{first}.{last}"
}

export interface HunterVerifyResult {
  email: string
  result: 'deliverable' | 'undeliverable' | 'risky' | 'unknown'
  score: number
}

export class HunterError extends Error {
  constructor(
    message: string,
    public readonly code: 'HTTP_ERROR' | 'TIMEOUT' | 'PARSE_ERROR' | 'AUTH_ERROR' | 'RATE_LIMIT',
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'HunterError'
  }
}

// ----------------------------------------------------------------------------
// Domain Search — trouver les emails d'une entreprise
// ----------------------------------------------------------------------------

export interface DomainSearchOptions {
  /** Nom de domaine (ex: "paprec.com") */
  domain: string
  /** Cle API Hunter.io */
  apiKey: string
  /** Departement cible (optionnel) : "executive", "management", etc. */
  department?: string
  /** Nombre de resultats. Defaut : 10 */
  limit?: number
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

/**
 * Recherche les emails associes a un nom de domaine.
 *
 * @throws HunterError
 */
export async function rechercherEmails(
  opts: DomainSearchOptions,
): Promise<HunterDomainResult> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  if (!opts.apiKey) {
    throw new HunterError('Cle API Hunter.io manquante', 'AUTH_ERROR')
  }

  const url = new URL(`${HUNTER_API_URL}/domain-search`)
  url.searchParams.set('domain', opts.domain)
  url.searchParams.set('api_key', opts.apiKey)
  if (opts.department) url.searchParams.set('department', opts.department)
  url.searchParams.set('limit', String(opts.limit ?? 10))

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
      throw new HunterError(`Timeout Hunter.io apres ${timeoutMs}ms`, 'TIMEOUT', err)
    }
    throw new HunterError(
      `Erreur reseau Hunter.io : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 401) {
    throw new HunterError('Cle API Hunter.io invalide', 'AUTH_ERROR')
  }
  if (res.status === 429) {
    throw new HunterError('Quota Hunter.io atteint (25 recherches/mois)', 'RATE_LIMIT')
  }
  if (!res.ok) {
    throw new HunterError(`Hunter.io HTTP ${res.status} ${res.statusText}`, 'HTTP_ERROR')
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    throw new HunterError('Reponse Hunter.io illisible', 'PARSE_ERROR', err)
  }

  const data = json as {
    data?: {
      domain?: string
      organization?: string
      emails?: HunterEmail[]
      pattern?: string
    }
  }

  return {
    domain: data.data?.domain ?? opts.domain,
    organization: data.data?.organization,
    emails: data.data?.emails ?? [],
    pattern: data.data?.pattern,
  }
}

// ----------------------------------------------------------------------------
// Email Finder — trouver l'email d'une personne specifique
// ----------------------------------------------------------------------------

export interface EmailFinderOptions {
  domain: string
  firstName: string
  lastName: string
  apiKey: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

/**
 * Trouve l'email professionnel d'une personne a partir de son nom
 * et du domaine de l'entreprise.
 */
export async function trouverEmail(
  opts: EmailFinderOptions,
): Promise<{ email: string; confidence: number } | null> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const url = new URL(`${HUNTER_API_URL}/email-finder`)
  url.searchParams.set('domain', opts.domain)
  url.searchParams.set('first_name', opts.firstName)
  url.searchParams.set('last_name', opts.lastName)
  url.searchParams.set('api_key', opts.apiKey)

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
      throw new HunterError(`Timeout email-finder apres ${timeoutMs}ms`, 'TIMEOUT', err)
    }
    throw new HunterError(
      `Erreur reseau email-finder : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 429) {
    throw new HunterError('Quota Hunter.io atteint', 'RATE_LIMIT')
  }
  if (!res.ok) return null

  let json: unknown
  try {
    json = await res.json()
  } catch {
    return null
  }

  const data = json as {
    data?: { email?: string; confidence?: number }
  }

  if (!data.data?.email) return null

  return {
    email: data.data.email,
    confidence: data.data.confidence ?? 0,
  }
}

// ----------------------------------------------------------------------------
// Email Verifier — verifier qu'un email est delivrable
// ----------------------------------------------------------------------------

/**
 * Verifie qu'un email est delivrable via Hunter.io.
 * Consomme 1 verification sur le quota mensuel (50/mois gratuit).
 */
export async function verifierEmail(opts: {
  email: string
  apiKey: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}): Promise<HunterVerifyResult> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const url = new URL(`${HUNTER_API_URL}/email-verifier`)
  url.searchParams.set('email', opts.email)
  url.searchParams.set('api_key', opts.apiKey)

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
      throw new HunterError(`Timeout email-verifier apres ${timeoutMs}ms`, 'TIMEOUT', err)
    }
    throw new HunterError(
      `Erreur reseau email-verifier : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 429) {
    throw new HunterError('Quota verifications Hunter.io atteint (50/mois)', 'RATE_LIMIT')
  }
  if (!res.ok) {
    throw new HunterError(`email-verifier HTTP ${res.status}`, 'HTTP_ERROR')
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    throw new HunterError('Reponse email-verifier illisible', 'PARSE_ERROR', err)
  }

  const data = json as {
    data?: { email?: string; result?: string; score?: number }
  }

  return {
    email: data.data?.email ?? opts.email,
    result: (data.data?.result as HunterVerifyResult['result']) ?? 'unknown',
    score: data.data?.score ?? 0,
  }
}

// ----------------------------------------------------------------------------
// Fallback : generation de patterns email
// ----------------------------------------------------------------------------

/**
 * Genere des patterns d'email probables a partir du prenom, nom et domaine.
 * Utilise quand Hunter.io ne trouve rien (quota depasse ou domaine inconnu).
 */
export function genererPatternsEmail(
  prenom: string,
  nom: string,
  domaine: string,
): string[] {
  const p = prenom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const n = nom.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const pi = p.charAt(0)

  return [
    `${p}.${n}@${domaine}`,
    `${pi}.${n}@${domaine}`,
    `${p}${n}@${domaine}`,
    `${p}@${domaine}`,
    `${n}.${p}@${domaine}`,
    `${pi}${n}@${domaine}`,
  ]
}
