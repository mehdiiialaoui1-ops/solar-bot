/**
 * =============================================================================
 * ERE SOLAR BOT - Types sourcing cadastre + BDNB
 * =============================================================================
 * Types partages entre les modules cadastre-ign.ts, bdnb.ts et index.ts.
 * Modelise les reponses des APIs externes (IGN, BDNB) et la sortie
 * normalisee (ProspectCandidat) prete a etre inseree dans la table
 * `prospects` de Supabase.
 *
 * Sources :
 * - IGN apicarto : https://apicarto.ign.fr/api/cadastre/parcelle (GeoJSON)
 * - BDNB CSTB    : https://bdnb.io/api/v1/donnees/batiment_groupe (JSON)
 * =============================================================================
 */

// ----------------------------------------------------------------------------
// IGN apicarto - Cadastre parcelle (reponse GeoJSON)
// ----------------------------------------------------------------------------

/**
 * Proprietes d'une parcelle cadastrale telles que retournees par
 * l'API apicarto IGN. La majorite des champs sont stables, mais on
 * reste tolerant : tous les champs sont optionnels sauf `id`.
 */
export interface IgnParcelleProperties {
  id: string
  numero?: string
  feuille?: number
  section?: string
  code_dep?: string
  code_com?: string
  code_insee?: string
  com_abs?: string
  echelle?: string
  edition?: number
  date_creation?: string
  /** Surface de la parcelle en m2 (cadastrale) */
  contenance?: number
}

/**
 * Geometrie d'une parcelle (GeoJSON Polygon ou MultiPolygon).
 * On garde un type permissif pour ne pas se battre avec les variations.
 */
export interface IgnParcelleGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: number[][][] | number[][][][]
}

export interface IgnParcelleFeature {
  type: 'Feature'
  geometry: IgnParcelleGeometry
  properties: IgnParcelleProperties
}

export interface IgnParcelleCollection {
  type: 'FeatureCollection'
  features: IgnParcelleFeature[]
  /** Champ optionnel ajoute par l'IGN sur certaines requetes */
  totalFeatures?: number
}

// ----------------------------------------------------------------------------
// BDNB CSTB - Batiment groupe (reponse JSON paginee)
// ----------------------------------------------------------------------------

/**
 * Une ligne batiment renvoyee par BDNB. La BDNB expose ~150 colonnes
 * mais on ne s'interesse ici qu'a celles utiles au sourcing tertiaire.
 */
export interface BdnbBatiment {
  /** Identifiant unique du batiment groupe (ex: "bdnb-bg-0123ABCD") */
  batiment_groupe_id: string
  code_insee?: string
  code_departement_insee?: string
  code_postal?: string
  /** Adresse libre normalisee si disponible */
  libelle_adr_principale_ban?: string
  /** Coordonnees centroides en WGS84 */
  geom_centroide?: string
  /** Surface d'activite (m2) - la cible loi APER >= 500 m2 */
  surface_activite?: number
  /** Usage principal (tertiaire, residentiel, industriel...) */
  usage_principal_bdnb_open?: string
  annee_construction?: number
  nb_niveau?: number
  /** SIRET du proprietaire si renseigne */
  siret_proprietaire?: string
  /** Latitude calculee (peut venir d'un autre champ selon l'API) */
  latitude?: number
  longitude?: number
}

/**
 * Reponse paginee BDNB. La pagination se fait via `next` (URL absolue
 * vers la page suivante) ou null si fin de liste.
 */
export interface BdnbReponse {
  results: BdnbBatiment[]
  count?: number
  next?: string | null
  previous?: string | null
}

// ----------------------------------------------------------------------------
// Sortie normalisee - ProspectCandidat
// ----------------------------------------------------------------------------

/**
 * Resultat de l'orchestrateur de sourcing : un candidat pret a etre
 * insere dans la table `prospects` de Supabase. La structure suit
 * exactement le schema post-migration 002.
 *
 * NB : on ne pose pas le statut ici (la couche d'insertion mettra
 * 'new' par defaut), ni le score (calcule plus tard dans le pipeline).
 */
export interface ProspectCandidat {
  /** Adresse postale lisible, reconstruite si necessaire */
  adresse: string
  code_postal: string
  commune: string
  code_insee: string
  lat: number
  lng: number
  surface_m2: number
  usage: string
  nb_etages: number | null
  annee_construction: number | null
  siret_proprietaire: string | null
  /** Identifiant cadastre/BDNB pour traçabilite */
  parcelle_id: string | null
  /** Source du candidat (utilise pour la colonne prospects.source) */
  source: 'ign_cadastre' | 'bdnb' | 'ign+bdnb'
}

// ----------------------------------------------------------------------------
// Erreurs typees pour faciliter le retry / monitoring
// ----------------------------------------------------------------------------

export class SourcingError extends Error {
  constructor(
    message: string,
    public readonly code: 'HTTP_ERROR' | 'TIMEOUT' | 'PARSE_ERROR' | 'INVALID_INPUT',
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'SourcingError'
  }
}
