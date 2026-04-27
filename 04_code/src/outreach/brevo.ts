/**
 * =============================================================================
 * ERE SOLAR BOT - Client API Brevo (ex-Sendinblue)
 * =============================================================================
 * Remplace Lemlist pour l'envoi d'emails de prospection avec tracking.
 *
 * Endpoints utilises :
 *   POST https://api.brevo.com/v3/smtp/email         (envoi transactionnel)
 *   GET  https://api.brevo.com/v3/smtp/statistics/events (tracking)
 *
 * Limites plan gratuit :
 *   - 300 emails/jour
 *   - Tracking ouvertures + clics inclus
 *   - Logo Brevo dans le footer
 *
 * Auth : header api-key
 * =============================================================================
 */

export const BREVO_API_URL = 'https://api.brevo.com/v3'
export const DEFAULT_TIMEOUT_MS = 15_000

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface BrevoSender {
  name: string
  email: string
}

export interface BrevoDestinataire {
  email: string
  name?: string
}

export interface BrevoEmailOptions {
  /** Expediteur */
  sender: BrevoSender
  /** Destinataire(s) */
  to: BrevoDestinataire[]
  /** Objet de l'email */
  subject: string
  /** Corps HTML de l'email */
  htmlContent: string
  /** Tags pour categoriser (ex: ["campagne-lyon-2026", "step-1"]) */
  tags?: string[]
  /** Reponse vers (optionnel) */
  replyTo?: BrevoSender
  /** Headers personnalises */
  headers?: Record<string, string>
}

export interface BrevoEnvoiResult {
  messageId: string
}

export interface BrevoWebhookEvent {
  event: 'delivered' | 'opened' | 'click' | 'hard_bounce' | 'soft_bounce' | 'spam' | 'unsubscribed'
  email: string
  date: string
  messageId?: string
  tag?: string
  link?: string
}

export class BrevoError extends Error {
  constructor(
    message: string,
    public readonly code: 'HTTP_ERROR' | 'TIMEOUT' | 'PARSE_ERROR' | 'AUTH_ERROR' | 'RATE_LIMIT',
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'BrevoError'
  }
}

// ----------------------------------------------------------------------------
// Envoi d'email transactionnel
// ----------------------------------------------------------------------------

export interface EnvoyerEmailOptions extends BrevoEmailOptions {
  /** Cle API Brevo */
  apiKey: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

/**
 * Envoie un email transactionnel via l'API Brevo SMTP.
 *
 * @returns l'identifiant du message (messageId)
 * @throws BrevoError
 */
export async function envoyerEmail(
  opts: EnvoyerEmailOptions,
): Promise<BrevoEnvoiResult> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  if (!opts.apiKey) {
    throw new BrevoError('Cle API Brevo manquante', 'AUTH_ERROR')
  }

  const body = {
    sender: opts.sender,
    to: opts.to,
    subject: opts.subject,
    htmlContent: opts.htmlContent,
    tags: opts.tags,
    replyTo: opts.replyTo,
    headers: opts.headers,
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetchImpl(`${BREVO_API_URL}/smtp/email`, {
      method: 'POST',
      headers: {
        'api-key': opts.apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new BrevoError(`Timeout Brevo apres ${timeoutMs}ms`, 'TIMEOUT', err)
    }
    throw new BrevoError(
      `Erreur reseau Brevo : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 401) {
    throw new BrevoError('Cle API Brevo invalide', 'AUTH_ERROR')
  }
  if (res.status === 429) {
    throw new BrevoError('Quota Brevo atteint (300 emails/jour)', 'RATE_LIMIT')
  }
  if (!res.ok) {
    let errBody = ''
    try { errBody = await res.text() } catch { /* ignore */ }
    throw new BrevoError(
      `Brevo HTTP ${res.status} ${res.statusText}: ${errBody}`,
      'HTTP_ERROR',
    )
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    throw new BrevoError('Reponse Brevo illisible', 'PARSE_ERROR', err)
  }

  const data = json as { messageId?: string }
  return { messageId: data.messageId ?? '' }
}

// ----------------------------------------------------------------------------
// Envoi de sequence (J0, J3, J5)
// ----------------------------------------------------------------------------

export interface EmailSequenceStep {
  /** Delai en jours depuis le premier envoi */
  delaiJours: number
  /** Objet de l'email */
  subject: string
  /** Corps HTML */
  htmlContent: string
}

export interface SequenceConfig {
  /** Expediteur */
  sender: BrevoSender
  /** Destinataire */
  to: BrevoDestinataire
  /** Etapes de la sequence */
  steps: EmailSequenceStep[]
  /** Tags de campagne */
  tags?: string[]
  /** Cle API Brevo */
  apiKey: string
  fetchImpl?: typeof fetch
}

/**
 * Sequence email predefinies : J0, J3, J5.
 * NB : cette fonction envoie uniquement l'etape courante.
 * L'orchestration (cron Vercel) appelle cette fonction avec
 * le bon index de step au bon moment.
 *
 * @param config - Configuration de la sequence
 * @param stepIndex - Index de l'etape a envoyer (0, 1, 2...)
 * @returns le resultat d'envoi ou null si l'index est hors bornes
 */
export async function envoyerEtapeSequence(
  config: SequenceConfig,
  stepIndex: number,
): Promise<BrevoEnvoiResult | null> {
  if (stepIndex < 0 || stepIndex >= config.steps.length) return null

  const step = config.steps[stepIndex]
  return envoyerEmail({
    sender: config.sender,
    to: [config.to],
    subject: step.subject,
    htmlContent: step.htmlContent,
    tags: [
      ...(config.tags ?? []),
      `step-${stepIndex}`,
      `J${step.delaiJours}`,
    ],
    apiKey: config.apiKey,
    fetchImpl: config.fetchImpl,
  })
}

// ----------------------------------------------------------------------------
// Webhook handler — tracking ouvertures/clics/bounces
// ----------------------------------------------------------------------------

/**
 * Parse et valide un evenement webhook Brevo.
 * A utiliser dans une API route Next.js (POST /api/webhooks/brevo).
 *
 * @param body - Corps de la requete POST webhook
 * @returns l'evenement parse, ou null si invalide
 */
export function parseBrevoWebhook(body: unknown): BrevoWebhookEvent | null {
  if (!body || typeof body !== 'object') return null

  const evt = body as Record<string, unknown>
  const event = evt.event as string | undefined
  const email = evt.email as string | undefined

  if (!event || !email) return null

  const validEvents = [
    'delivered', 'opened', 'click', 'hard_bounce',
    'soft_bounce', 'spam', 'unsubscribed',
  ]
  if (!validEvents.includes(event)) return null

  return {
    event: event as BrevoWebhookEvent['event'],
    email,
    date: (evt.date as string) ?? new Date().toISOString(),
    messageId: evt['message-id'] as string | undefined,
    tag: evt.tag as string | undefined,
    link: evt.link as string | undefined,
  }
}

// ----------------------------------------------------------------------------
// Helpers de contenu email
// ----------------------------------------------------------------------------

/**
 * Genere le lien de desinscription RGPD obligatoire.
 * A inclure dans le footer de chaque email de prospection.
 */
export function lienDesinscription(
  baseUrl: string,
  contactId: string,
): string {
  return `${baseUrl}/api/unsubscribe?id=${encodeURIComponent(contactId)}`
}

/**
 * Wrap le contenu HTML dans un template avec le footer RGPD.
 */
export function wrapEmailHtml(
  content: string,
  unsubscribeUrl: string,
  senderName = 'ERE Experts',
): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
${content}
<hr style="margin-top: 40px; border: none; border-top: 1px solid #e0e0e0;">
<p style="font-size: 11px; color: #999; text-align: center;">
  ${senderName} — Cabinet de conseil architecture et bâtiment<br>
  78 avenue des Champs Élysées, 75008 Paris<br>
  <a href="${unsubscribeUrl}" style="color: #999;">Se désinscrire</a>
</p>
</body>
</html>`
}
