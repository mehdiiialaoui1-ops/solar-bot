/**
 * ERE SOLAR BOT — Fonctions de calcul solaire
 * Toutes ces fonctions sont testées via Vitest (obligatoire)
 */

// =============================================
// Constantes
// =============================================

/** Prix moyen de l'électricité en France tertiaire 2026 (€/kWh) */
export const PRIX_KWH_TERTIAIRE = 0.22

/** Puissance standard d'un panneau solaire tertiaire (kWc) */
export const PUISSANCE_PANNEAU_KWC = 0.4

/** Surface standard d'un panneau (m²) */
export const SURFACE_PANNEAU_M2 = 1.72

/** Ratio surface toiture utile vs surface totale toiture */
export const RATIO_SURFACE_UTILE = 0.7

/** Dégradation annuelle moyenne des panneaux (%/an) */
export const DEGRADATION_ANNUELLE = 0.005

/** Durée de vie garantie des panneaux (ans) */
export const DUREE_VIE_ANS = 25

// =============================================
// Dimensionnement
// =============================================

/**
 * Calcule le nombre de panneaux installables sur une toiture
 * @param surface_toiture_m2 - Surface totale de la toiture en m²
 * @returns Nombre de panneaux entiers installables
 */
export function calculerNbPanneaux(surface_toiture_m2: number): number {
  if (surface_toiture_m2 <= 0) {
    throw new Error('La surface de toiture doit être positive')
  }
  const surface_utile = surface_toiture_m2 * RATIO_SURFACE_UTILE
  return Math.floor(surface_utile / SURFACE_PANNEAU_M2)
}

/**
 * Calcule la puissance installée en kWc
 * @param nb_panneaux - Nombre de panneaux
 * @returns Puissance totale en kWc
 */
export function calculerPuissanceKwc(nb_panneaux: number): number {
  if (nb_panneaux < 0) {
    throw new Error('Le nombre de panneaux ne peut pas être négatif')
  }
  return nb_panneaux * PUISSANCE_PANNEAU_KWC
}

/**
 * Calcule la production annuelle estimée
 * @param puissance_kwc - Puissance installée en kWc
 * @param irradiation_kwh_m2_an - Irradiation solaire annuelle du site (kWh/m²/an)
 * @param performance_ratio - Ratio de performance (défaut 0.75)
 * @returns Production annuelle en kWh
 */
export function calculerProductionAnnuelle(
  puissance_kwc: number,
  irradiation_kwh_m2_an: number,
  performance_ratio = 0.75
): number {
  if (puissance_kwc < 0) throw new Error('La puissance doit être positive')
  if (irradiation_kwh_m2_an <= 0) throw new Error('L\'irradiation doit être positive')
  if (performance_ratio <= 0 || performance_ratio > 1) {
    throw new Error('Le ratio de performance doit être entre 0 et 1')
  }
  return puissance_kwc * irradiation_kwh_m2_an * performance_ratio
}

// =============================================
// Économies et ROI
// =============================================

/**
 * Calcule l'économie annuelle en euros
 * @param production_kwh - Production annuelle en kWh
 * @param taux_autoconsommation - Part auto-consommée (0 à 1, défaut 0.7)
 * @param prix_kwh - Prix de l'électricité en €/kWh
 * @param tarif_rachat_kwh - Tarif de rachat du surplus en €/kWh
 * @returns Économie annuelle en euros
 */
export function calculerEconomieAnnuelle(
  production_kwh: number,
  taux_autoconsommation = 0.7,
  prix_kwh = PRIX_KWH_TERTIAIRE,
  tarif_rachat_kwh = 0.13
): number {
  if (production_kwh < 0) throw new Error('La production doit être positive')
  if (taux_autoconsommation < 0 || taux_autoconsommation > 1) {
    throw new Error('Le taux d\'autoconsommation doit être entre 0 et 1')
  }

  const kwh_autoconsommes = production_kwh * taux_autoconsommation
  const kwh_revendus = production_kwh * (1 - taux_autoconsommation)

  const economie_autoconso = kwh_autoconsommes * prix_kwh
  const revenu_revente = kwh_revendus * tarif_rachat_kwh

  return economie_autoconso + revenu_revente
}

/**
 * Calcule le retour sur investissement en années
 * @param cout_installation_eur - Coût total de l'installation en €
 * @param economie_annuelle_eur - Économie annuelle en €
 * @param aides_totales_eur - Total des aides et subventions en €
 * @returns Nombre d'années pour le retour sur investissement
 */
export function calculerROI(
  cout_installation_eur: number,
  economie_annuelle_eur: number,
  aides_totales_eur = 0
): number {
  if (cout_installation_eur <= 0) {
    throw new Error('Le coût d\'installation doit être positif')
  }
  if (economie_annuelle_eur <= 0) {
    throw new Error('L\'économie annuelle doit être positive')
  }

  const investissement_net = cout_installation_eur - aides_totales_eur
  if (investissement_net <= 0) return 0

  return investissement_net / economie_annuelle_eur
}

/**
 * Estime le coût d'installation au kWc (marché tertiaire FR 2026)
 * @param puissance_kwc - Puissance en kWc
 * @returns Coût estimé en euros HT
 */
export function estimerCoutInstallation(puissance_kwc: number): number {
  if (puissance_kwc <= 0) throw new Error('La puissance doit être positive')

  // Dégression du prix au kWc selon la puissance (données marché FR 2026)
  let prix_kwc: number
  if (puissance_kwc <= 36) {
    prix_kwc = 1800 // Petites installations
  } else if (puissance_kwc <= 100) {
    prix_kwc = 1400 // Installations moyennes
  } else if (puissance_kwc <= 500) {
    prix_kwc = 1100 // Grandes installations tertiaires
  } else {
    prix_kwc = 900  // Très grandes installations industrielles
  }

  return puissance_kwc * prix_kwc
}

// =============================================
// Aides financières
// =============================================

/**
 * Calcule la prime à l'autoconsommation (< 100 kWc uniquement)
 * Source : arrêtés tarifaires CRE 2026
 * @param puissance_kwc - Puissance installée en kWc
 * @returns Montant de la prime en euros (0 si > 100 kWc)
 */
export function calculerPrimeAutoconsommation(puissance_kwc: number): number {
  if (puissance_kwc <= 0) throw new Error('La puissance doit être positive')
  if (puissance_kwc > 100) return 0 // Non applicable au-dessus de 100 kWc

  let prime_par_kwc: number

  if (puissance_kwc <= 3) {
    prime_par_kwc = 330
  } else if (puissance_kwc <= 9) {
    prime_par_kwc = 230
  } else if (puissance_kwc <= 36) {
    prime_par_kwc = 200
  } else {
    prime_par_kwc = 100 // 36 à 100 kWc
  }

  return puissance_kwc * prime_par_kwc
}

/**
 * Calcule l'économie fiscale du suramortissement article 39 decies B
 * @param cout_installation_eur - Coût de l'installation en € HT
 * @param taux_is - Taux d'IS de l'entreprise (défaut 25%)
 * @returns Économie fiscale en euros
 */
export function calculerSuramortissement(
  cout_installation_eur: number,
  taux_is = 0.25
): number {
  if (cout_installation_eur <= 0) throw new Error('Le coût doit être positif')
  if (taux_is <= 0 || taux_is > 1) throw new Error('Le taux IS doit être entre 0 et 1')

  const TAUX_DEDUCTION = 0.4 // 40% selon article 39 decies B
  const deduction_supplementaire = cout_installation_eur * TAUX_DEDUCTION
  return deduction_supplementaire * taux_is
}

// =============================================
// Projection pixel (Google Solar → Image)
// =============================================

/**
 * Convertit des coordonnées GPS en pixels sur une image satellite
 * Utile pour l'overlay des panneaux sur l'image statique Google Maps
 *
 * @param lat_panneau - Latitude du panneau
 * @param lng_panneau - Longitude du panneau
 * @param lat_centre - Latitude du centre de l'image
 * @param lng_centre - Longitude du centre de l'image
 * @param zoom - Niveau de zoom Google Maps (typiquement 18-19)
 * @param image_width_px - Largeur de l'image en pixels
 * @param image_height_px - Hauteur de l'image en pixels
 * @returns Coordonnées {x, y} en pixels
 */
export function gpsVersPixel(
  lat_panneau: number,
  lng_panneau: number,
  lat_centre: number,
  lng_centre: number,
  zoom: number,
  image_width_px: number,
  image_height_px: number
): { x: number; y: number } {
  // Échelle de la Mercator projection au niveau de zoom donné
  const TILE_SIZE = 256
  const echelle = TILE_SIZE * Math.pow(2, zoom)

  // Conversion GPS → coordonnées monde Mercator
  const mondeVersPixelX = (lng: number) => ((lng + 180) / 360) * echelle
  const mondeVersPixelY = (lat: number) => {
    const sin_lat = Math.sin((lat * Math.PI) / 180)
    return ((0.5 - Math.log((1 + sin_lat) / (1 - sin_lat)) / (4 * Math.PI)) * echelle)
  }

  const centre_x = mondeVersPixelX(lng_centre)
  const centre_y = mondeVersPixelY(lat_centre)

  const panneau_x = mondeVersPixelX(lng_panneau)
  const panneau_y = mondeVersPixelY(lat_panneau)

  // Offset par rapport au centre de l'image
  const offset_x = panneau_x - centre_x
  const offset_y = panneau_y - centre_y

  return {
    x: Math.round(image_width_px / 2 + offset_x),
    y: Math.round(image_height_px / 2 + offset_y),
  }
}
