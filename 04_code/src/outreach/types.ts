/**
 * =============================================================================
 * ERE SOLAR BOT - Types outreach (Claude + Lemlist)
 * =============================================================================
 * Module de génération d'email personnalisé via Claude API + envoi via Lemlist.
 * Spec : 02_prompts/v1_email_copy.txt + 01_specs/templates_emails.md
 * =============================================================================
 */

// ----------------------------------------------------------------------------
// Variables du prompt Claude (placeholders attendus dans v1_email_copy.txt)
// ----------------------------------------------------------------------------

/**
 * Variables à substituer dans le prompt Claude pour générer un email
 * de prospection personnalisé.
 */
export interface PromptVariables {
  prenom: string
  nom: string
  raison_sociale: string
  adresse: string
  code_postal: string
  commune: string
  surface_m2: number
  puissance_kwc: number
  production_annuelle_kwh: number
  economie_annuelle_eur: number
  /** Liste des obligations applicables au prospect (ex: "loi APER", "Décret tertiaire palier 2030") */
  obligations_list: string
  microsite_url: string
}

// ----------------------------------------------------------------------------
// Email généré (output Claude parsé)
// ----------------------------------------------------------------------------

export interface EmailGenere {
  /** Objet de l'email (ligne "Subject:") */
  objet: string
  /** Corps de l'email (paragraphes après l'objet) */
  corps: string
  /** Texte brut original retourné par Claude (pour debug) */
  raw: string
  /** Compte de mots du corps (utile pour valider <= 150 mots) */
  motsCount: number
}

// ----------------------------------------------------------------------------
// Anthropic API - réponse minimale parsée
// ----------------------------------------------------------------------------

export interface AnthropicResponse {
  id?: string
  type?: 'message'
  role?: 'assistant'
  content: Array<{
    type: 'text'
    text: string
  }>
  model?: string
  stop_reason?: string
  usage?: {
    input_tokens: number
    output_tokens: number
  }
}

// ----------------------------------------------------------------------------
// Lemlist API - structures
// ----------------------------------------------------------------------------

export interface LemlistLead {
  email: string
  /** Champs personnalisés référencés dans la séquence Lemlist */
  firstName?: string
  lastName?: string
  companyName?: string
  /** Variables custom alignées sur le template Lemlist (ex: micrositeUrl) */
  [customField: string]: unknown
}

export interface LemlistAddLeadResponse {
  _id?: string
  email: string
  campaignId: string
  status?: 'added' | 'duplicate' | 'paused'
}

// ----------------------------------------------------------------------------
// Pipeline outreach
// ----------------------------------------------------------------------------

export interface OutreachInput {
  prospectId: string
  contactId: string
  /** Variables du prompt Claude */
  variables: PromptVariables
  /** ID de la campagne Lemlist où ajouter le lead */
  campagneLemlistId: string
  /** Email du destinataire (vérifié) */
  destinataireEmail: string
}

export interface OutreachResult {
  prospectId: string
  contactId: string
  email: EmailGenere
  /** Réponse Lemlist (ID du lead créé) */
  lemlistLeadId: string | null
  statut: 'sent' | 'duplicate' | 'paused' | 'failed'
}

// ----------------------------------------------------------------------------
// Erreurs typées
// ----------------------------------------------------------------------------

export class OutreachError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'HTTP_ERROR'
      | 'TIMEOUT'
      | 'PARSE_ERROR'
      | 'INVALID_INPUT'
      | 'PROMPT_TEMPLATE_INVALID'
      | 'CLAUDE_REFUSED'
      | 'CLAUDE_OVER_LIMIT'
      | 'LEMLIST_DUPLICATE'
      | 'LEMLIST_PAUSED',
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'OutreachError'
  }
}
