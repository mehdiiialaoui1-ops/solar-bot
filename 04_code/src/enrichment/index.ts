/**
 * =============================================================================
 * ERE SOLAR BOT - Module enrichment - exports publics
 * =============================================================================
 */

export type {
  Dirigeant,
  ContactEnrichi,
  EnrichmentResult,
  RangCiblage,
  PappersEntreprise,
  PappersRepresentant,
  DropcontactResult,
} from './types'

export { EnrichmentError, RANG_LABEL } from './types'

// Pappers
export {
  fetchEntreprise,
  buildPappersUrl,
  qualiteVersRang,
  extraireDirigeants,
  PAPPERS_ENDPOINT,
} from './pappers'

// Dropcontact
export {
  enrichBatch,
  selectionnerEmailPro,
  estEmailPerso,
  dirigeantVersInputDropcontact,
  EMAIL_DOMAINS_PERSO,
  DROPCONTACT_ENDPOINT,
  BATCH_SIZE_MAX,
} from './dropcontact'

// Pattern email fallback
export {
  EMAIL_PATTERNS,
  normaliser,
  genererEmail,
  genererTousPatterns,
  aMxRecord,
  extraireDomaineDepuisUrl,
  tenterPatterns,
} from './pattern-email'

// Orchestrateur
export { enrichProspect, selectionnerContactActif } from './cascade'
