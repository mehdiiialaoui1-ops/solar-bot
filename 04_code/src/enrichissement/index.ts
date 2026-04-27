/**
 * =============================================================================
 * ERE SOLAR BOT - Orchestrateur enrichissement prospect
 * =============================================================================
 * Pipeline d'enrichissement complet pour un prospect :
 * 1. Geocodage (adresse -> GPS) si coordonnees manquantes
 * 2. Enrichissement entreprise (SIREN -> raison sociale, dirigeants, NAF)
 * 3. Recherche email (domaine -> emails decideurs)
 *
 * Chaque etape est independante et echoue silencieusement (le prospect
 * reste exploitable meme si certaines etapes echouent).
 * =============================================================================
 */

import { geocoder, reverseGeocode } from './geocodage'
import { enrichirEntreprise, type EntrepriseEnrichie, type Dirigeant } from './insee'
import { rechercherEmails, trouverEmail, genererPatternsEmail, type HunterEmail } from './hunter'

export interface ProspectAEnrichir {
  adresse?: string
  code_postal?: string
  lat?: number
  lng?: number
  siren?: string
  siret?: string
}

export interface ProspectEnrichi {
  /** Coordonnees GPS */
  lat: number | null
  lng: number | null
  /** Adresse normalisee BAN */
  adresse_normalisee: string | null
  code_postal: string | null
  commune: string | null
  code_insee: string | null
  /** Donnees entreprise */
  raison_sociale: string | null
  code_naf: string | null
  libelle_naf: string | null
  effectif: string | null
  dirigeants: Dirigeant[]
  /** Contact email */
  emails: Array<{
    email: string
    confidence: number
    prenom?: string
    nom?: string
    poste?: string
  }>
}

export interface EnrichirOptions {
  /** Prospect a enrichir */
  prospect: ProspectAEnrichir
  /** Cle API INSEE (optionnel — fallback si Annuaire indispo) */
  inseeApiKey?: string
  /** Cle API Hunter.io */
  hunterApiKey?: string
  /** Surcharge fetch pour tests */
  fetchImpl?: typeof fetch
}

/**
 * Enrichit un prospect avec geocodage, donnees entreprise et emails.
 * Chaque etape echoue silencieusement — on retourne ce qu'on a.
 */
export async function enrichirProspect(
  opts: EnrichirOptions,
): Promise<ProspectEnrichi> {
  const result: ProspectEnrichi = {
    lat: opts.prospect.lat ?? null,
    lng: opts.prospect.lng ?? null,
    adresse_normalisee: null,
    code_postal: opts.prospect.code_postal ?? null,
    commune: null,
    code_insee: null,
    raison_sociale: null,
    code_naf: null,
    libelle_naf: null,
    effectif: null,
    dirigeants: [],
    emails: [],
  }

  // 1. Geocodage
  try {
    if (opts.prospect.adresse && (!result.lat || !result.lng)) {
      const geo = await geocoder({
        adresse: opts.prospect.adresse,
        codePostal: opts.prospect.code_postal,
        fetchImpl: opts.fetchImpl,
      })
      result.lat = geo.lat
      result.lng = geo.lng
      result.adresse_normalisee = geo.label
      result.code_postal = geo.codePostal
      result.commune = geo.commune
      result.code_insee = geo.codeInsee
    } else if (result.lat && result.lng && !opts.prospect.adresse) {
      const geo = await reverseGeocode({
        lat: result.lat,
        lng: result.lng,
        fetchImpl: opts.fetchImpl,
      })
      result.adresse_normalisee = geo.label
      result.code_postal = geo.codePostal
      result.commune = geo.commune
      result.code_insee = geo.codeInsee
    }
  } catch {
    // Geocodage echoue — on continue
  }

  // 2. Enrichissement entreprise
  let entreprise: EntrepriseEnrichie | null = null
  const identifiant = opts.prospect.siret ?? opts.prospect.siren
  if (identifiant) {
    try {
      entreprise = await enrichirEntreprise({
        identifiant,
        inseeApiKey: opts.inseeApiKey,
        fetchImpl: opts.fetchImpl,
      })
      if (entreprise) {
        result.raison_sociale = entreprise.raison_sociale || null
        result.code_naf = entreprise.code_naf ?? null
        result.libelle_naf = entreprise.libelle_naf ?? null
        result.effectif = entreprise.effectif ?? null
        result.dirigeants = entreprise.dirigeants
      }
    } catch {
      // Enrichissement echoue — on continue
    }
  }

  // 3. Recherche emails via Hunter.io
  if (opts.hunterApiKey && entreprise?.nom_domaine) {
    try {
      const hunterResult = await rechercherEmails({
        domain: entreprise.nom_domaine,
        apiKey: opts.hunterApiKey,
        department: 'executive',
        limit: 5,
        fetchImpl: opts.fetchImpl,
      })
      result.emails = hunterResult.emails.map((e: HunterEmail) => ({
        email: e.value,
        confidence: e.confidence,
        prenom: e.first_name,
        nom: e.last_name,
        poste: e.position,
      }))
    } catch {
      // Hunter echoue — on essaie les patterns si on a des dirigeants
    }

    // Fallback patterns si aucun email trouve via Hunter
    if (result.emails.length === 0 && result.dirigeants.length > 0 && entreprise?.nom_domaine) {
      const d = result.dirigeants[0]
      if (d.prenom && d.nom) {
        try {
          const found = await trouverEmail({
            domain: entreprise.nom_domaine,
            firstName: d.prenom,
            lastName: d.nom,
            apiKey: opts.hunterApiKey,
            fetchImpl: opts.fetchImpl,
          })
          if (found) {
            result.emails = [{
              email: found.email,
              confidence: found.confidence,
              prenom: d.prenom,
              nom: d.nom,
              poste: d.qualite,
            }]
          }
        } catch {
          // email-finder echoue — patterns manuels
          const patterns = genererPatternsEmail(d.prenom, d.nom, entreprise.nom_domaine)
          result.emails = patterns.slice(0, 3).map((email) => ({
            email,
            confidence: 30,
            prenom: d.prenom,
            nom: d.nom,
            poste: d.qualite,
          }))
        }
      }
    }
  }

  return result
}

// Re-exports
export { geocoder, reverseGeocode, GeocodageError } from './geocodage'
export {
  rechercherEntreprise,
  fetchSirene,
  enrichirEntreprise,
  InseeError,
  type EntrepriseEnrichie,
  type Dirigeant,
} from './insee'
export {
  rechercherEmails,
  trouverEmail,
  verifierEmail,
  genererPatternsEmail,
  HunterError,
  type HunterEmail,
  type HunterDomainResult,
} from './hunter'
