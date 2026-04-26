/**
 * =============================================================================
 * ERE SOLAR BOT - Génération email via Claude API
 * =============================================================================
 * Endpoint Anthropic Messages API :
 *   POST https://api.anthropic.com/v1/messages
 *   Headers : x-api-key, anthropic-version: 2023-06-01
 *
 * Charge le prompt système depuis 02_prompts/v1_email_copy.txt, substitue
 * les variables prospect, appelle Claude, parse l'objet + corps.
 * =============================================================================
 */

import type {
  AnthropicResponse,
  EmailGenere,
  PromptVariables,
} from './types'
import { OutreachError } from './types'

export const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages'
export const DEFAULT_MODEL = 'claude-sonnet-4-6'
export const DEFAULT_TIMEOUT_MS = 30_000
export const MAX_OUTPUT_TOKENS = 600
export const LIMITE_MOTS = 150

/** Tous les placeholders attendus dans le prompt v1_email_copy.txt */
export const VARIABLES_REQUISES: ReadonlyArray<keyof PromptVariables> = [
  'prenom',
  'nom',
  'raison_sociale',
  'adresse',
  'code_postal',
  'commune',
  'surface_m2',
  'puissance_kwc',
  'production_annuelle_kwh',
  'economie_annuelle_eur',
  'obligations_list',
  'microsite_url',
]

// ----------------------------------------------------------------------------
// Substitution des variables {var} dans le prompt
// ----------------------------------------------------------------------------

/**
 * Remplace les placeholders {var} dans le template par les valeurs.
 * Lève PROMPT_TEMPLATE_INVALID si une variable est manquante dans le template.
 */
export function substituerVariables(
  template: string,
  variables: PromptVariables,
): string {
  let out = template
  for (const key of VARIABLES_REQUISES) {
    const placeholder = `{${key}}`
    const value = String(variables[key as keyof PromptVariables])
    out = out.split(placeholder).join(value)
  }
  // Détection de placeholders restants (= bug template)
  const restant = out.match(/\{[a-z_]+\}/g)
  if (restant && restant.length > 0) {
    throw new OutreachError(
      `Placeholders non substitués dans le prompt : ${restant.join(', ')}`,
      'PROMPT_TEMPLATE_INVALID',
    )
  }
  return out
}

// ----------------------------------------------------------------------------
// Appel Claude
// ----------------------------------------------------------------------------

export interface GenererEmailOptions {
  /** Template système (issu de 02_prompts/v1_email_copy.txt) */
  promptTemplate: string
  variables: PromptVariables
  apiKey: string
  /** Modèle Claude. Defaut : claude-sonnet-4-6 */
  model?: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export async function appelerClaudeApi(
  opts: GenererEmailOptions,
): Promise<string> {
  if (!opts.apiKey || opts.apiKey.length < 20) {
    throw new OutreachError('Clé API Anthropic manquante ou invalide', 'INVALID_INPUT')
  }
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    throw new OutreachError('fetch indisponible', 'INVALID_INPUT')
  }

  const promptComplet = substituerVariables(opts.promptTemplate, opts.variables)
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetchImpl(ANTHROPIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: opts.model ?? DEFAULT_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [{ role: 'user', content: promptComplet }],
      }),
      signal: controller.signal,
    })
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new OutreachError(`Timeout Claude apres ${timeoutMs}ms`, 'TIMEOUT', err)
    }
    throw new OutreachError(
      `Erreur reseau Claude : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    if (res.status === 429) {
      throw new OutreachError('Claude rate limit (429)', 'CLAUDE_OVER_LIMIT')
    }
    throw new OutreachError(
      `Claude HTTP ${res.status} ${res.statusText}`,
      'HTTP_ERROR',
    )
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    throw new OutreachError('Reponse Claude illisible', 'PARSE_ERROR', err)
  }

  const data = json as AnthropicResponse
  if (data.stop_reason === 'refusal') {
    throw new OutreachError('Claude a refusé la génération', 'CLAUDE_REFUSED')
  }
  const text = data.content?.[0]?.text
  if (!text) {
    throw new OutreachError('Reponse Claude sans contenu', 'PARSE_ERROR')
  }
  return text
}

// ----------------------------------------------------------------------------
// Parser email - extrait objet + corps depuis la sortie Claude
// ----------------------------------------------------------------------------

/**
 * Compte les mots d'un texte (sépération par espaces, ponctuation ignorée).
 */
export function compterMots(texte: string): number {
  const mots = texte.trim().split(/\s+/).filter((m) => m.length > 0)
  return mots.length
}

/**
 * Parse l'output Claude en EmailGenere. Le prompt demande un format
 * libre - on extrait l'objet via la première ligne qui matche
 * "Objet :" / "Subject:" / etc., puis le corps qui suit.
 */
export function parserEmail(raw: string): EmailGenere {
  const text = raw.trim()
  // 1. Cherche une ligne objet
  const matchObjet = text.match(/^(?:objet|subject|sujet)\s*:\s*(.+?)$/im)
  let objet = ''
  let corps = text
  if (matchObjet) {
    objet = matchObjet[1].trim()
    // Le corps est tout ce qui suit la ligne objet
    const apresObjet = text.slice(matchObjet.index! + matchObjet[0].length)
    corps = apresObjet.trim()
  } else {
    // Fallback : la première ligne courte (< 100 chars) est probablement l'objet
    const lignes = text.split(/\n+/).map((l) => l.trim()).filter(Boolean)
    if (lignes.length > 1 && lignes[0].length <= 100 && !lignes[0].endsWith('.')) {
      objet = lignes[0]
      corps = lignes.slice(1).join('\n\n')
    }
  }

  return {
    objet,
    corps,
    raw: text,
    motsCount: compterMots(corps),
  }
}

// ----------------------------------------------------------------------------
// Orchestrateur génération email
// ----------------------------------------------------------------------------

/**
 * Pipeline complet : substitution + appel Claude + parsing.
 *
 * Lève OutreachError si :
 *  - prompt template invalide (placeholders manquants)
 *  - Claude refuse / rate limit / erreur réseau
 *  - corps > 150 mots (limite spec)
 */
export async function genererEmail(
  opts: GenererEmailOptions,
): Promise<EmailGenere> {
  const raw = await appelerClaudeApi(opts)
  const email = parserEmail(raw)

  if (email.motsCount > LIMITE_MOTS) {
    throw new OutreachError(
      `Email genere trop long : ${email.motsCount} mots (max ${LIMITE_MOTS}). Demander a Claude un email plus court.`,
      'CLAUDE_OVER_LIMIT',
    )
  }
  if (!email.objet) {
    throw new OutreachError('Objet email introuvable dans la reponse Claude', 'PARSE_ERROR')
  }
  return email
}
