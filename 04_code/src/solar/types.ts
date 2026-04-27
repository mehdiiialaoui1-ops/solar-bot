/**
 * =============================================================================
 * ERE SOLAR BOT - Types Google Solar API + Maps Static
 * =============================================================================
 * Types pour l'integration Google Solar API (Building Insights) et
 * Google Maps Static API (image satellite pour overlay panneaux).
 *
 * Endpoints :
 * - Building Insights : https://solar.googleapis.com/v1/buildingInsights:findClosest
 * - Maps Static       : https://maps.googleapis.com/maps/api/staticmap
 * =============================================================================
 */

// ----------------------------------------------------------------------------
// Building Insights - reponse Google Solar API
// ----------------------------------------------------------------------------

export interface LatLng {
  latitude: number
  longitude: number
}

export interface DateImagery {
  year: number
  month: number
  day: number
}

/**
 * Statistiques d'un segment de toiture (orientation, pente, surface, irradiance).
 */
export interface RoofSegmentStats {
  pitchDegrees?: number
  azimuthDegrees?: number
  stats?: {
    areaMeters2?: number
    sunshineQuantiles?: number[]
    groundAreaMeters2?: number
  }
  center?: LatLng
  boundingBox?: {
    sw?: LatLng
    ne?: LatLng
  }
  planeHeightAtCenterMeters?: number
}

/**
 * Configuration possible d'un nombre de panneaux donne (avec
 * l'energie produite annuelle).
 */
export interface SolarPanelConfig {
  panelsCount: number
  yearlyEnergyDcKwh: number
  roofSegmentSummaries?: Array<{
    pitchDegrees?: number
    azimuthDegrees?: number
    panelsCount: number
    yearlyEnergyDcKwh: number
    segmentIndex?: number
  }>
}

/**
 * Resultat principal du calcul solaire pour un batiment donne.
 */
export interface SolarPotential {
  maxArrayPanelsCount?: number
  maxArrayAreaMeters2?: number
  maxSunshineHoursPerYear?: number
  carbonOffsetFactorKgPerMwh?: number
  panelCapacityWatts?: number
  panelHeightMeters?: number
  panelWidthMeters?: number
  panelLifetimeYears?: number
  wholeRoofStats?: {
    areaMeters2?: number
    sunshineQuantiles?: number[]
    groundAreaMeters2?: number
  }
  roofSegmentStats?: RoofSegmentStats[]
  solarPanelConfigs?: SolarPanelConfig[]
}

/**
 * Reponse complete Building Insights findClosest.
 */
export interface BuildingInsightsResponse {
  name: string
  center: LatLng
  imageryDate?: DateImagery
  imageryProcessedDate?: DateImagery
  postalCode?: string
  administrativeArea?: string
  statisticalArea?: string
  regionCode?: string
  imageryQuality?: 'HIGH' | 'MEDIUM' | 'LOW'
  solarPotential?: SolarPotential
}

// ----------------------------------------------------------------------------
// Sortie normalisee pour la table calculs_solaires
// ----------------------------------------------------------------------------

/**
 * Resultat normalise pour une insertion dans `calculs_solaires`.
 * Les champs suivent le schema post-migration 002.
 */
export interface CalculSolaireResult {
  prospect_id: string | null
  nb_panneaux_max: number
  puissance_kwc: number
  production_kwh_an: number
  surface_toiture_utile_m2: number
  azimut_deg: number | null
  inclinaison_deg: number | null
  imagery_date: string | null
  source_api: 'pvgis' | 'manuel'
}

// ----------------------------------------------------------------------------
// Erreurs typees
// ----------------------------------------------------------------------------

export class SolarApiError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'HTTP_ERROR'
      | 'TIMEOUT'
      | 'PARSE_ERROR'
      | 'INVALID_INPUT'
      | 'NO_BUILDING_FOUND',
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'SolarApiError'
  }
}
