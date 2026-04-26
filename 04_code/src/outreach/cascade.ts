/**
 * =============================================================================
 * ERE SOLAR BOT - Orchestrateur outreach (Claude → Lemlist)
 * =============================================================================
 * Pour un prospect enrichi (sortie SOL-16) :
 *   1. Génère un email personnalisé via Claude (depuis prompt + variables)
 *   2. Ajoute le lead à la campagne Lemlist avec les variables custom
 *
 * Lemlist gère la séquence J0/J3/J5 côté serveur via son template configuré.
 * On ne fait PAS d'envoi direct depuis notre code.
 * =============================================================================
 */

import { genererEmail } from './claude-email'
import { addLead } from './lemlist'
import type {
  EmailGenere,
  LemlistLead,
  OutreachInput,
  OutreachResult,
} from './types'
import { OutreachError } from './types'

export interface RunOutreachOptions extends OutreachInput {
  /** Template Claude (chargé depuis 02_prompts/v1_email_copy.txt) */
  promptTemplate: string
  /** Clés API */
  anthropicApiKey: string
  lemlistApiKey: string
  /** Surcharge fetch pour tests */
  fetchImpl?: typeof fetch
  /** Surcharge modèle Claude */
  claudeModel?: string
}

/**
 * Prend les variables prospect, génère l'email Claude et ajoute le lead
 * à Lemlist. Utile pour qualifier l'envoi : on choisit un "premier touch"
 * et on laisse Lemlist envoyer la séquence.
 */
export async function runOutreach(
  opts: RunOutreachOptions,
): Promise<OutreachResult> {
  // 1. Génération email Claude
  let email: EmailGenere
  try {
    email = await genererEmail({
      promptTemplate: opts.promptTemplate,
      variables: opts.variables,
      apiKey: opts.anthropicApiKey,
      model: opts.claudeModel,
      fetchImpl: opts.fetchImpl,
    })
  } catch (err) {
    if (err instanceof OutreachError && err.code === 'CLAUDE_OVER_LIMIT') {
      // Fallback : on retourne un OutreachResult statut failed sans lever
      return {
        prospectId: opts.prospectId,
        contactId: opts.contactId,
        email: {
          objet: '',
          corps: '',
          raw: '',
          motsCount: 0,
        },
        lemlistLeadId: null,
        statut: 'failed',
      }
    }
    throw err
  }

  // 2. Préparation lead Lemlist avec champs custom
  const lead: LemlistLead = {
    email: opts.destinataireEmail,
    firstName: opts.variables.prenom,
    lastName: opts.variables.nom,
    companyName: opts.variables.raison_sociale,
    micrositeUrl: opts.variables.microsite_url,
    surfaceM2: opts.variables.surface_m2,
    puissanceKwc: opts.variables.puissance_kwc,
    productionAnnuelleKwh: opts.variables.production_annuelle_kwh,
    economieAnnuelleEur: opts.variables.economie_annuelle_eur,
    obligations: opts.variables.obligations_list,
    // L'objet/corps Claude peut etre injecte dans Lemlist via les variables
    // {{customSubject}} et {{customBody}} si la sequence est configuree pour
    customSubject: email.objet,
    customBody: email.corps,
  }

  // 3. Ajout Lemlist
  const lemlistRes = await addLead({
    campaignId: opts.campagneLemlistId,
    lead,
    apiKey: opts.lemlistApiKey,
    fetchImpl: opts.fetchImpl,
  })

  let statut: OutreachResult['statut']
  if (lemlistRes.status === 'added') statut = 'sent'
  else if (lemlistRes.status === 'duplicate') statut = 'duplicate'
  else if (lemlistRes.status === 'paused') statut = 'paused'
  else statut = 'failed'

  return {
    prospectId: opts.prospectId,
    contactId: opts.contactId,
    email,
    lemlistLeadId: lemlistRes._id ?? null,
    statut,
  }
}
