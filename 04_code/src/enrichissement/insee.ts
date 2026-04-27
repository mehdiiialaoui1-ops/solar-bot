/**
 * =============================================================================
 * ERE SOLAR BOT - Client API SIRENE (INSEE) + Annuaire des Entreprises
 * =============================================================================
 * Deux APIs complementaires pour enrichir les prospects :
 *
 * 1. API SIRENE v3.11 (INSEE) — données juridiques par SIREN/SIRET
 *    Endpoint : https://api.insee.fr/api-sirene/3.11/siren/{siren}
 *    Auth : API Key dans header X-INSEE-Api-Key-Integration
 *
 * 2. API Annuaire des Entreprises (data.gouv.fr) — dirigeants + NAF
 *    Endpoint : https://recherche-entreprises.api.gouv.fr/search?q={siren}
 *    Pas d'authentification requise.
 *
 * Strategie : on utilise l'Annuaire des Entreprises en priorite
 * (gratuit, inclut les dirigeants), et on tombe en fallback sur
 * l'API SIRENE pour les recherches par SIRET specifique.
 * =============================================================================
 */

export const INSEE_API_URL = 'https://api.insee.fr/api-sirene/3.11'
export const ANNUAIRE_ENTREPRISES_URL =
  process.env.ANNUAIRE_ENTREPRISES_URL ?? 'https://recherche-entreprises.api.gouv.fr'

export const DEFAULT_TIMEOUT_MS = 15_000

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface Dirigeant {
  nom: string
  prenom: string
  qualite?: string // ex: "Président", "Directeur Général"
}

export interface EntrepriseEnrichie {
  siren: string
  siret_siege?: string
  raison_sociale: string
  adresse_siege?: string
  code_postal?: string
  commune?: string
  code_naf?: string
  libelle_naf?: string
  effectif?: string
  date_creation?: string
  dirigeants: Dirigeant[]
  /** Nom de domaine web (pour Hunter.io) */
  nom_domaine?: string
}

export class InseeError extends Error {
  constructor(
    message: string,
    public readonly code: 'HTTP_ERROR' | 'TIMEOUT' | 'PARSE_ERROR' | 'NOT_FOUND' | 'AUTH_ERROR',
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'InseeError'
  }
}

// ----------------------------------------------------------------------------
// API Annuaire des Entreprises (source principale — gratuite)
// ----------------------------------------------------------------------------

export interface RechercheEntrepriseOptions {
  /** SIREN, SIRET ou nom d'entreprise */
  query: string
  /** Code postal pour affiner (optionnel) */
  codePostal?: string
  /** Code NAF pour filtrer par activite (optionnel) */
  codeNaf?: string
  /** Nombre de resultats. Defaut : 5 */
  limit?: number
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

/**
 * Recherche une entreprise via l'API Annuaire des Entreprises.
 * Retourne les dirigeants, NAF, adresse, etc.
 */
export async function rechercherEntreprise(
  opts: RechercheEntrepriseOptions,
): Promise<EntrepriseEnrichie[]> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const url = new URL(`${ANNUAIRE_ENTREPRISES_URL}/search`)
  url.searchParams.set('q', opts.query)
  if (opts.codePostal) url.searchParams.set('code_postal', opts.codePostal)
  if (opts.codeNaf) url.searchParams.set('activite_principale', opts.codeNaf)
  url.searchParams.set('per_page', String(opts.limit ?? 5))
  url.searchParams.set('page', '1')

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
      throw new InseeError(`Timeout Annuaire Entreprises apres ${timeoutMs}ms`, 'TIMEOUT', err)
    }
    throw new InseeError(
      `Erreur reseau Annuaire Entreprises : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    throw new InseeError(
      `Annuaire Entreprises HTTP ${res.status} ${res.statusText}`,
      'HTTP_ERROR',
    )
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    throw new InseeError('Reponse Annuaire Entreprises illisible', 'PARSE_ERROR', err)
  }

  const data = json as {
    results?: Array<{
      siren?: string
      siege?: {
        siret?: string
        adresse?: string
        code_postal?: string
        libelle_commune?: string
        activite_principale?: string
        libelle_activite_principale?: string
      }
      nom_complet?: string
      nom_raison_sociale?: string
      nombre_etablissements_ouverts?: number
      tranche_effectif_salarie?: string
      date_creation?: string
      dirigeants?: Array<{
        nom?: string
        prenoms?: string
        qualite?: string
      }>
    }>
  }

  if (!data.results || !Array.isArray(data.results)) {
    return []
  }

  return data.results.map((r) => ({
    siren: r.siren ?? '',
    siret_siege: r.siege?.siret,
    raison_sociale: r.nom_complet ?? r.nom_raison_sociale ?? '',
    adresse_siege: r.siege?.adresse,
    code_postal: r.siege?.code_postal,
    commune: r.siege?.libelle_commune,
    code_naf: r.siege?.activite_principale,
    libelle_naf: r.siege?.libelle_activite_principale,
    effectif: r.tranche_effectif_salarie,
    date_creation: r.date_creation,
    dirigeants: (r.dirigeants ?? []).map((d) => ({
      nom: d.nom ?? '',
      prenom: d.prenoms ?? '',
      qualite: d.qualite,
    })),
    nom_domaine: undefined, // sera enrichi par Hunter.io
  }))
}

// ----------------------------------------------------------------------------
// API SIRENE INSEE (fallback — necesssite API Key)
// ----------------------------------------------------------------------------

export interface FetchSireneOptions {
  /** SIREN (9 chiffres) ou SIRET (14 chiffres) */
  identifiant: string
  /** Cle API INSEE */
  apiKey: string
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

/**
 * Recupere les donnees SIRENE d'une entreprise par SIREN ou SIRET.
 * Necesssite une API Key INSEE.
 */
export async function fetchSirene(
  opts: FetchSireneOptions,
): Promise<EntrepriseEnrichie> {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  if (!opts.apiKey) {
    throw new InseeError('Cle API INSEE manquante', 'AUTH_ERROR')
  }

  const isSiret = opts.identifiant.length === 14
  const endpoint = isSiret
    ? `${INSEE_API_URL}/siret/${opts.identifiant}`
    : `${INSEE_API_URL}/siren/${opts.identifiant}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetchImpl(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'X-INSEE-Api-Key-Integration': opts.apiKey,
      },
      signal: controller.signal,
    })
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new InseeError(`Timeout INSEE apres ${timeoutMs}ms`, 'TIMEOUT', err)
    }
    throw new InseeError(
      `Erreur reseau INSEE : ${(err as Error)?.message ?? 'inconnue'}`,
      'HTTP_ERROR',
      err,
    )
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 404) {
    throw new InseeError(
      `Entreprise non trouvee : ${opts.identifiant}`,
      'NOT_FOUND',
    )
  }
  if (res.status === 401 || res.status === 403) {
    throw new InseeError(`Authentification INSEE refusee (${res.status})`, 'AUTH_ERROR')
  }
  if (!res.ok) {
    throw new InseeError(`INSEE HTTP ${res.status} ${res.statusText}`, 'HTTP_ERROR')
  }

  let json: unknown
  try {
    json = await res.json()
  } catch (err) {
    throw new InseeError('Reponse INSEE illisible', 'PARSE_ERROR', err)
  }

  // Extraction des donnees selon la structure SIRENE v3.11
  const data = json as {
    uniteLegale?: {
      siren?: string
      denominationUniteLegale?: string
      dateCreationUniteLegale?: string
      periodesUniteLegale?: Array<{
        activitePrincipaleUniteLegale?: string
        denominationUniteLegale?: string
        trancheEffectifsUniteLegale?: string
      }>
    }
    etablissement?: {
      siret?: string
      uniteLegale?: {
        siren?: string
        denominationUniteLegale?: string
      }
      adresseEtablissement?: {
        numeroVoieEtablissement?: string
        typeVoieEtablissement?: string
        libelleVoieEtablissement?: string
        codePostalEtablissement?: string
        libelleCommuneEtablissement?: string
      }
    }
  }

  if (isSiret && data.etablissement) {
    const etab = data.etablissement
    const adr = etab.adresseEtablissement
    const adresse = adr
      ? [adr.numeroVoieEtablissement, adr.typeVoieEtablissement, adr.libelleVoieEtablissement]
          .filter(Boolean)
          .join(' ')
      : undefined

    return {
      siren: etab.uniteLegale?.siren ?? opts.identifiant.substring(0, 9),
      siret_siege: etab.siret,
      raison_sociale: etab.uniteLegale?.denominationUniteLegale ?? '',
      adresse_siege: adresse,
      code_postal: adr?.codePostalEtablissement,
      commune: adr?.libelleCommuneEtablissement,
      dirigeants: [], // API SIRENE ne retourne pas les dirigeants
    }
  }

  if (data.uniteLegale) {
    const ul = data.uniteLegale
    const periode = ul.periodesUniteLegale?.[0]

    return {
      siren: ul.siren ?? opts.identifiant,
      raison_sociale:
        periode?.denominationUniteLegale ?? ul.denominationUniteLegale ?? '',
      code_naf: periode?.activitePrincipaleUniteLegale,
      effectif: periode?.trancheEffectifsUniteLegale,
      date_creation: ul.dateCreationUniteLegale,
      dirigeants: [], // API SIRENE ne retourne pas les dirigeants
    }
  }

  throw new InseeError('Reponse INSEE inattendue', 'PARSE_ERROR')
}

// ----------------------------------------------------------------------------
// Enrichissement combine : Annuaire d'abord, fallback SIRENE
// ----------------------------------------------------------------------------

/**
 * Enrichit un prospect a partir de son SIREN/SIRET.
 * Utilise l'Annuaire des Entreprises en priorite (gratuit + dirigeants),
 * tombe en fallback sur l'API SIRENE si besoin.
 */
export async function enrichirEntreprise(opts: {
  identifiant: string
  inseeApiKey?: string
  fetchImpl?: typeof fetch
}): Promise<EntrepriseEnrichie | null> {
  try {
    // Priorite : Annuaire des Entreprises (gratuit, avec dirigeants)
    const resultats = await rechercherEntreprise({
      query: opts.identifiant,
      limit: 1,
      fetchImpl: opts.fetchImpl,
    })
    if (resultats.length > 0) return resultats[0]
  } catch {
    // Fallback silencieux vers INSEE
  }

  // Fallback : API SIRENE (si cle disponible)
  if (opts.inseeApiKey) {
    try {
      return await fetchSirene({
        identifiant: opts.identifiant,
        apiKey: opts.inseeApiKey,
        fetchImpl: opts.fetchImpl,
      })
    } catch {
      return null
    }
  }

  return null
}
