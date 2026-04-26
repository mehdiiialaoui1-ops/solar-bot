/**
 * =============================================================================
 * ERE SOLAR BOT - Génération email par pattern + vérification MX
 * =============================================================================
 * Fallback quand Dropcontact ne trouve pas l'email (~30-40 % des PME).
 *
 * Stratégie (spec 01_specs/strategie_enrichissement.md) :
 * 1. Normaliser prénom/nom (sans accents, lowercase)
 * 2. Tester 6 patterns dans l'ordre de fréquence en France
 * 3. Vérifier le MX record du domaine (DNS)
 * 4. Marquer email_verifie = false (pas de garantie 100%)
 *
 * Pas de SMTP RCPT TO ici (problèmes anti-spam, faux positifs). On
 * s'appuie uniquement sur le MX du domaine.
 * =============================================================================
 */

import { EnrichmentError } from './types'

/** 6 patterns dans l'ordre de fréquence en France */
export const EMAIL_PATTERNS = [
  '{prenom}.{nom}@{domaine}',
  '{p}.{nom}@{domaine}',
  '{prenom}{nom}@{domaine}',
  '{nom}.{prenom}@{domaine}',
  '{prenom}@{domaine}',
  '{p}{nom}@{domaine}',
] as const

/**
 * Normalise un nom ou prénom pour l'utiliser dans un email :
 * - Décompose les caractères accentués (NFD)
 * - Retire les diacritiques (combining marks)
 * - Lowercase
 * - Retire tout ce qui n'est pas a-z, ce qui supprime espaces, apostrophes, traits d'union
 */
export function normaliser(nom: string): string {
  return nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
}

/**
 * Génère un email à partir d'un pattern et des composants (prenom, nom, domaine).
 * Retourne null si un composant requis est vide.
 */
export function genererEmail(
  pattern: string,
  prenom: string,
  nom: string,
  domaine: string,
): string | null {
  const p = normaliser(prenom)
  const n = normaliser(nom)
  if (!n || !domaine) return null
  const initiale = p.charAt(0)
  const rendu = pattern
    .replace('{prenom}', p)
    .replace('{p}', initiale)
    .replace('{nom}', n)
    .replace('{domaine}', domaine)
  // Si un placeholder est resté ou qu'on a une partie vide, on rejette
  if (rendu.includes('{') || /^@|@$|@\./.test(rendu)) return null
  if (!p && (pattern.includes('{prenom}') || pattern.includes('{p}'))) return null
  return rendu
}

/**
 * Génère tous les patterns candidats pour un dirigeant donné.
 */
export function genererTousPatterns(
  prenom: string,
  nom: string,
  domaine: string,
): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const pat of EMAIL_PATTERNS) {
    const e = genererEmail(pat, prenom, nom, domaine)
    if (e && !seen.has(e)) {
      seen.add(e)
      out.push(e)
    }
  }
  return out
}

// ----------------------------------------------------------------------------
// Vérification MX (DNS lookup)
// ----------------------------------------------------------------------------

export interface MxRecord {
  exchange: string
  priority: number
}

export interface MxResolver {
  resolveMx(hostname: string): Promise<MxRecord[]>
}

/**
 * Resolver MX par défaut, basé sur dns/promises (Node natif).
 * Retourne null si le module dns n'est pas dispo (browser / edge runtime).
 */
export async function resolverMxParDefaut(): Promise<MxResolver | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dns: typeof import('node:dns/promises') = await import('node:dns/promises')
    return {
      resolveMx: async (hostname: string) => dns.resolveMx(hostname),
    }
  } catch {
    return null
  }
}

/**
 * Vérifie qu'un domaine a un enregistrement MX (donc un serveur mail).
 *
 * @returns true si au moins un MX trouvé, false sinon (ou en cas d'erreur DNS).
 */
export async function aMxRecord(
  domaine: string,
  resolver?: MxResolver,
): Promise<boolean> {
  if (!domaine || /[^a-z0-9.\-]/i.test(domaine)) return false
  const r = resolver ?? (await resolverMxParDefaut())
  if (!r) return false
  try {
    const records = await r.resolveMx(domaine)
    return Array.isArray(records) && records.length > 0
  } catch {
    return false
  }
}

// ----------------------------------------------------------------------------
// Extraction de domaine depuis URL site web
// ----------------------------------------------------------------------------

/**
 * Extrait le domaine principal depuis une URL (https://www.acme.fr → acme.fr).
 * Retourne null si l'URL est invalide.
 */
export function extraireDomaineDepuisUrl(url: string | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    let host = u.hostname.toLowerCase()
    if (host.startsWith('www.')) host = host.slice(4)
    if (!host.includes('.')) return null
    return host
  } catch {
    return null
  }
}

// ----------------------------------------------------------------------------
// Stratégie d'essai - Trouve le premier email plausible
// ----------------------------------------------------------------------------

export interface TenterPatternsOptions {
  prenom: string
  nom: string
  domaine: string
  /** Resolver MX pour les tests (mock dans Vitest) */
  resolver?: MxResolver
}

export interface TenterPatternsResult {
  email: string | null
  /** Tous les emails générés (pour debug/log) */
  candidats: string[]
  /** Vrai si le domaine a un MX record (sinon tous les emails sont rejetés) */
  domaineValide: boolean
}

/**
 * Génère et teste les patterns. Si le domaine a un MX record, retourne
 * le premier candidat (par ordre de fréquence) - sinon null.
 *
 * Note importante : on ne fait PAS de SMTP check par email - juste un MX
 * sur le domaine. Le score email_verifie restera donc false.
 */
export async function tenterPatterns(
  opts: TenterPatternsOptions,
): Promise<TenterPatternsResult> {
  const candidats = genererTousPatterns(opts.prenom, opts.nom, opts.domaine)
  if (candidats.length === 0) {
    return { email: null, candidats: [], domaineValide: false }
  }
  const domaineValide = await aMxRecord(opts.domaine, opts.resolver)
  if (!domaineValide) {
    return { email: null, candidats, domaineValide: false }
  }
  return { email: candidats[0], candidats, domaineValide: true }
}

// Erreur publique pour cas extrême (jamais utilisée actuellement mais facilite les tests)
export function erreurDomaineInvalide(domaine: string): EnrichmentError {
  return new EnrichmentError(
    `Domaine "${domaine}" sans MX record exploitable`,
    'INVALID_INPUT',
  )
}
