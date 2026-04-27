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
 * - BDNB CSTB    : https://api.bdnb.io/v1/bdnb/donnees/batiment_groupe_complet (JSON)
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
 *
 * Nouvelle API (api-open.bdnb.io) : certains noms de colonnes ont change
 * par rapport a l'ancienne API (bdnb.io/api). On garde les deux pour
 * la retro-compatibilite des fixtures de test.
 */
export interface BdnbBatiment {
  /** Identifiant unique du batiment groupe (ex: "bdnb-bg-0123ABCD") */
  batiment_groupe_id: string
  /** Nouvelle API : code_commune_insee. Ancienne : code_insee */
  code_commune_insee?: string
  /** Retro-compat ancienne API */
  code_insee?: string
  code_departement_insee?: string
  /** Commune parente (Paris/Lyon/Marseille : code commune global) */
  commune_parente?: string
  code_postal?: string
  /** Adresse libre normalisee si disponible */
  libelle_adr_principale_ban?: string
  /** Nouvelle API : geometrie GeoJSON (objet) ou WKT (string) du groupe */
  geom_groupe?: string | Record<string, unknown>
  /** Ancienne API : centroide WKT */
  geom_centroide?: string
  /** Nouvelle API : surface geometrique du groupe (m2) */
  s_geom_groupe?: number
  /** Ancienne API : surface d'activite (m2) */
  surface_activite?: number
  /** Usage principal (tertiaire, residentiel, industriel...) */
  usage_principal_bdnb_open?: string
  annee_construction?: number
  /** Ancienne API : nb_niveau */
  nb_niveau?: number
  /** Nouvelle API : nb_log (nombre de logements) */
  nb_log?: number
  /** SIRET du proprietaire si renseigne */
  siret_proprietaire?: string
  /** Nouvelle API : liste de SIREN associes */
  l_siren?: string[]
  /** Latitude calculee */
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
