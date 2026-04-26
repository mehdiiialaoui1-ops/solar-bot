/**
 * =============================================================================
 * ERE SOLAR BOT - Types enrichment (Pappers + Dropcontact + pattern fallback)
 * =============================================================================
 * Référence : 01_specs/strategie_enrichissement.md (Mehdi, 2026-04-26).
 *
 * Cascade : SIREN → Pappers (dirigeants) → Dropcontact (email) → pattern (fallback)
 * Sortie normalisée : ContactEnrichi prêt à insérer dans `outreach_contacts`.
 * =============================================================================
 */

// ----------------------------------------------------------------------------
// Pappers API - réponse v2/entreprise
// ----------------------------------------------------------------------------

export interface PappersRepresentant {
  nom: string
  prenom?: string
  qualite?: string
  date_prise_poste?: string
  date_fin_poste?: string | null
  type_representant?: string
}

export interface PappersBeneficiaireEffectif {
  nom: string
  prenom?: string
  pourcentage_parts?: number
}

export interface PappersSiege {
  adresse_ligne_1?: string
  domaine_activite?: string
  url_site_web?: string
  code_postal?: string
  ville?: string
}

export interface PappersEntreprise {
  siren: string
  denomination?: string
  forme_juridique?: string
  date_creation?: string
  effectif?: string
  representants?: PappersRepresentant[]
  beneficiaires_effectifs?: PappersBeneficiaireEffectif[]
  siege?: PappersSiege
}

// ----------------------------------------------------------------------------
// Dropcontact API - réponse batch
// ----------------------------------------------------------------------------

export interface DropcontactEmail {
  email: string
  /** "valid" | "invalid" | "risky" | "unknown" */
  qualification?: string
}

export interface DropcontactPhone {
  number: string
  type?: string
}

export interface DropcontactResult {
  /** Echo de l'input (pour matcher le résultat à la requête) */
  first_name?: string
  last_name?: string
  company?: string
  siren?: string
  /** Données enrichies */
  email?: DropcontactEmail[]
  phone?: DropcontactPhone[]
  linkedin?: string
  website?: string
}

export interface DropcontactBatchResponse {
  request_id?: string
  data: DropcontactResult[]
}

// ----------------------------------------------------------------------------
// Domaine métier - Hiérarchie de ciblage
// ----------------------------------------------------------------------------

export type RangCiblage = 1 | 2 | 3 | 4 | 5 | 6

export const RANG_LABEL: Record<RangCiblage, string> = {
  1: 'Propriétaire-dirigeant',
  2: 'Directeur Général',
  3: 'DAF',
  4: 'Directeur Immobilier',
  5: 'Directeur RSE',
  6: 'Autre',
}

// ----------------------------------------------------------------------------
// Sortie normalisée - ContactEnrichi (pour outreach_contacts)
// ----------------------------------------------------------------------------

export interface Dirigeant {
  prenom: string
  nom: string
  titre: string
  rang_ciblage: RangCiblage
  date_prise_poste?: string
  source_enrichment: 'pappers_representant' | 'pappers_beneficiaire'
}

export interface ContactEnrichi extends Dirigeant {
  prospect_id: string
  email_pro: string | null
  telephone_pro: string | null
  linkedin_url: string | null
  email_verifie: boolean
  /** Source finale de l'email (Dropcontact ou pattern fallback) */
  source_email: 'dropcontact' | 'pattern' | null
  actif: boolean
}

export interface EnrichmentResult {
  prospect_id: string
  contacts: ContactEnrichi[]
  /** Contact actif sélectionné (meilleur rang + email vérifié), null si aucun trouvé */
  contact_actif: ContactEnrichi | null
  /** Statut résultant pour la table prospects */
  statut: 'enriched' | 'no_contact' | 'enrichment_failed'
}

// ----------------------------------------------------------------------------
// Erreurs typées
// ----------------------------------------------------------------------------

export class EnrichmentError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'HTTP_ERROR'
      | 'TIMEOUT'
      | 'PARSE_ERROR'
      | 'INVALID_INPUT'
      | 'SIREN_NOT_FOUND'
      | 'SIREN_RADIE'
      | 'RATE_LIMITED'
      | 'NO_DIRIGEANT',
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'EnrichmentError'
  }
}
