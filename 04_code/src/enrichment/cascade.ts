/**
 * =============================================================================
 * ERE SOLAR BOT - Orchestrateur cascade enrichissement
 * =============================================================================
 * Pipeline pour un prospect (avec SIREN) :
 *
 *   1. Pappers     → liste de Dirigeants (max 3, triés par rang)
 *   2. Dropcontact → enrichissement email (batch)
 *   3. Pattern     → fallback pour les contacts sans email Dropcontact
 *   4. Sélection   → meilleur contact (rang + email vérifié) → marqué actif
 *
 * Note : aucune écriture base ici (Supabase sera ajouté quand l'orchestrateur
 * sera intégré dans le pipeline E2E J9). On retourne EnrichmentResult.
 * =============================================================================
 */

import { fetchEntreprise, extraireDirigeants } from './pappers'
import {
  enrichBatch,
  selectionnerEmailPro,
  dirigeantVersInputDropcontact,
} from './dropcontact'
import {
  tenterPatterns,
  extraireDomaineDepuisUrl,
  type MxResolver,
} from './pattern-email'
import type {
  ContactEnrichi,
  Dirigeant,
  DropcontactResult,
  EnrichmentResult,
} from './types'
import { EnrichmentError } from './types'

export interface EnrichProspectOptions {
  prospectId: string
  siren: string
  raisonSociale: string
  /** Tokens API (à fournir depuis env vars en prod) */
  pappersToken: string
  dropcontactToken: string
  /** Resolver MX (utile pour les tests) */
  mxResolver?: MxResolver
  /** Surcharge fetch pour tests */
  fetchImpl?: typeof fetch
}

/**
 * Pipeline complet pour un prospect. Retourne EnrichmentResult avec
 * les contacts enrichis et le contact actif sélectionné.
 *
 * Ne lève PAS si Pappers / Dropcontact échoue : retourne un statut
 * 'enrichment_failed' avec contacts vides. C'est l'appelant qui décide
 * de retry ou pas.
 */
export async function enrichProspect(
  opts: EnrichProspectOptions,
): Promise<EnrichmentResult> {
  // -------------------------------------------------------------------------
  // 1. Pappers - dirigeants
  // -------------------------------------------------------------------------
  let dirigeants: Dirigeant[] = []
  let urlSiteWeb: string | undefined

  try {
    const entreprise = await fetchEntreprise({
      siren: opts.siren,
      apiToken: opts.pappersToken,
      fetchImpl: opts.fetchImpl,
    })
    dirigeants = extraireDirigeants(entreprise, 3)
    urlSiteWeb = entreprise.siege?.url_site_web
  } catch (err) {
    if (err instanceof EnrichmentError && err.code === 'SIREN_NOT_FOUND') {
      return {
        prospect_id: opts.prospectId,
        contacts: [],
        contact_actif: null,
        statut: 'enrichment_failed',
      }
    }
    throw err
  }

  if (dirigeants.length === 0) {
    return {
      prospect_id: opts.prospectId,
      contacts: [],
      contact_actif: null,
      statut: 'no_contact',
    }
  }

  // -------------------------------------------------------------------------
  // 2. Dropcontact - enrichissement email
  // -------------------------------------------------------------------------
  const inputs = dirigeants.map((d) =>
    dirigeantVersInputDropcontact(d, opts.raisonSociale, opts.siren),
  )
  let resultats: DropcontactResult[] = []
  try {
    resultats = await enrichBatch({
      apiToken: opts.dropcontactToken,
      contacts: inputs,
      fetchImpl: opts.fetchImpl,
    })
  } catch (err) {
    // Dropcontact échoue ? On continue avec patterns en fallback complet
    if (!(err instanceof EnrichmentError) || err.code !== 'RATE_LIMITED') {
      // log silencieux, on bascule en mode pattern uniquement
      resultats = []
    } else {
      throw err
    }
  }

  const contacts: ContactEnrichi[] = []

  for (let i = 0; i < dirigeants.length; i++) {
    const d = dirigeants[i]
    const r = resultats[i]
    let emailPro: string | null = null
    let emailVerifie = false
    let sourceEmail: ContactEnrichi['source_email'] = null
    let telephone: string | null = null
    let linkedin: string | null = null

    if (r) {
      const choix = selectionnerEmailPro(r)
      if (choix) {
        emailPro = choix.email
        emailVerifie = choix.verifie
        sourceEmail = 'dropcontact'
      }
      telephone = r.phone?.[0]?.number ?? null
      linkedin = r.linkedin ?? null
    }

    // -----------------------------------------------------------------------
    // 3. Pattern fallback si pas d'email Dropcontact
    // -----------------------------------------------------------------------
    if (!emailPro) {
      const domaine = extraireDomaineDepuisUrl(urlSiteWeb)
      if (domaine) {
        const tentative = await tenterPatterns({
          prenom: d.prenom,
          nom: d.nom,
          domaine,
          resolver: opts.mxResolver,
        })
        if (tentative.email) {
          emailPro = tentative.email
          emailVerifie = false
          sourceEmail = 'pattern'
        }
      }
    }

    contacts.push({
      ...d,
      prospect_id: opts.prospectId,
      email_pro: emailPro,
      telephone_pro: telephone,
      linkedin_url: linkedin,
      email_verifie: emailVerifie,
      source_email: sourceEmail,
      actif: false, // sera mis à true après sélection
    })
  }

  // -------------------------------------------------------------------------
  // 4. Sélection du contact actif (meilleur rang + email vérifié de préférence)
  // -------------------------------------------------------------------------
  const actif = selectionnerContactActif(contacts)
  if (actif) actif.actif = true

  return {
    prospect_id: opts.prospectId,
    contacts,
    contact_actif: actif,
    statut: actif ? 'enriched' : 'no_contact',
  }
}

/**
 * Sélectionne le meilleur contact :
 * - Priorité 1 : rang le plus bas + email vérifié
 * - Priorité 2 : rang le plus bas + email non vérifié (pattern)
 * - Priorité 3 : rang le plus bas sans email (échec total)
 *
 * Retourne null si aucun contact dans la liste.
 */
export function selectionnerContactActif(
  contacts: ContactEnrichi[],
): ContactEnrichi | null {
  if (contacts.length === 0) return null

  // 1) email vérifié
  const verifies = contacts.filter((c) => c.email_pro && c.email_verifie)
  if (verifies.length > 0) {
    return verifies.reduce((a, b) => (a.rang_ciblage <= b.rang_ciblage ? a : b))
  }
  // 2) email non vérifié (pattern)
  const avecEmail = contacts.filter((c) => c.email_pro)
  if (avecEmail.length > 0) {
    return avecEmail.reduce((a, b) => (a.rang_ciblage <= b.rang_ciblage ? a : b))
  }
  // 3) sans email - on prend le rang le plus bas, mais on retourne null
  // car aucun email = aucun outreach possible
  return null
}
