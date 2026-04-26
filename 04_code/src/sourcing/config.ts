/**
 * =============================================================================
 * ERE SOLAR BOT - Configuration région pilote (sourcing)
 * =============================================================================
 * Référence : 01_specs/region_pilote.md (Mehdi, 2026-04-26).
 * Métropole de Lyon retenue pour la phase pilote.
 *
 * Trois tiers de communes :
 *   - Tier 1 : 4 communes prioritaires, lancement J9 (sourcing immédiat)
 *   - Tier 2 : extension semaine 2-3 si volume insuffisant
 *   - Tier 3 : réserve (Vallée de la Chimie, profil industriel lourd différent)
 * =============================================================================
 */

export interface CommuneCible {
  nom: string
  codeInsee: string
  /** Justification métier de l'inclusion */
  justification: string
  /** Zones d'activités clés (info commerciale) */
  zonesActivites: string[]
}

// ----------------------------------------------------------------------------
// Tier 1 - Prioritaires (lancement J9)
// ----------------------------------------------------------------------------

export const TIER_1_COMMUNES: CommuneCible[] = [
  {
    nom: 'Lyon',
    codeInsee: '69123',
    justification: 'Capitale régionale, plus forte densité tertiaire',
    zonesActivites: ['La Mouche', 'Gerland', 'Part-Dieu', 'Confluence'],
  },
  {
    nom: 'Vénissieux',
    codeInsee: '69259',
    justification: 'Fort tissu industriel, grandes surfaces',
    zonesActivites: ['Lyon Sud-Est', 'Parilly'],
  },
  {
    nom: 'Saint-Priest',
    codeInsee: '69199',
    justification: 'Zones logistiques, entrepôts grandes surfaces',
    zonesActivites: ['Mi-Plaine', 'Lyon Sud-Est'],
  },
  {
    nom: 'Chassieu',
    codeInsee: '69044',
    justification: 'Concentration ZA pure, peu de résidentiel',
    zonesActivites: ['Mi-Plaine', 'Perica'],
  },
]

// ----------------------------------------------------------------------------
// Tier 2 - Extension rapide (semaine 2-3)
// ----------------------------------------------------------------------------

export const TIER_2_COMMUNES: CommuneCible[] = [
  {
    nom: 'Vaulx-en-Velin',
    codeInsee: '69256',
    justification: 'La Soie en développement, nouveaux bâtiments',
    zonesActivites: ['La Rize', 'La Soie'],
  },
  {
    nom: 'Décines-Charpieu',
    codeInsee: '69073',
    justification: 'Croissance tertiaire post-OL Vallée',
    zonesActivites: ['La Soie', 'OL Vallée'],
  },
  {
    nom: 'Corbas',
    codeInsee: '69069',
    justification: 'Logistique pure, grandes toitures plates',
    zonesActivites: ['Lyon Sud-Est'],
  },
  {
    nom: 'Meyzieu',
    codeInsee: '69381',
    justification: 'Zone logistique Meyzieu-Jonage',
    zonesActivites: ['Meyzieu-Jonage'],
  },
]

// ----------------------------------------------------------------------------
// Tier 3 - Réserve (à activer en dernier ressort)
// ----------------------------------------------------------------------------

export const TIER_3_COMMUNES: CommuneCible[] = [
  {
    nom: 'Villeurbanne',
    codeInsee: '69266',
    justification: 'Dense mais plus résidentiel, tertiaire de bureau',
    zonesActivites: [],
  },
  {
    nom: 'Bron',
    codeInsee: '69029',
    justification: 'Périphérie La Soie, volume moindre',
    zonesActivites: [],
  },
  {
    nom: 'Saint-Fons',
    codeInsee: '69199',
    justification: 'Vallée de la Chimie, industrie lourde (profil différent)',
    zonesActivites: ['Vallée de la Chimie'],
  },
]

// ----------------------------------------------------------------------------
// Export agrégé - REGION_PILOTE
// ----------------------------------------------------------------------------

export const REGION_PILOTE = {
  nom: 'Métropole de Lyon',
  /** Codes INSEE Tier 1 (lancement J9) */
  tier1: TIER_1_COMMUNES.map((c) => c.codeInsee),
  /** Codes INSEE Tier 2 (extension) */
  tier2: TIER_2_COMMUNES.map((c) => c.codeInsee),
  /** Codes INSEE Tier 3 (réserve) */
  tier3: TIER_3_COMMUNES.map((c) => c.codeInsee),
  /** Toutes les communes confondues (pour tests / reporting) */
  toutes: [...TIER_1_COMMUNES, ...TIER_2_COMMUNES, ...TIER_3_COMMUNES],
} as const

// ----------------------------------------------------------------------------
// Filtres de sourcing - paramètres métier
// ----------------------------------------------------------------------------

export const FILTRES_SOURCING = {
  /** Seuil de rentabilité installation solaire tertiaire (loi APER) */
  surfaceMinM2: 500,
  /** Usages cibles BDNB - exclut résidentiel et équipements publics */
  usages: ['tertiaire', 'industriel', 'commercial', 'logistique'],
  /** Bonus scoring si bâtiment construit avant cette année */
  anneeConstructionBonus: 2000,
} as const

// ----------------------------------------------------------------------------
// Paramètres calcul solaire spécifiques Lyon Métropole
// ----------------------------------------------------------------------------

export const PARAMS_SOLAIRES_LYON = {
  /** Irradiation globale horizontale annuelle (kWh/m²/an) */
  irradiationKwhM2An: 1300,
  /** Inclinaison optimale panneaux (degrés) */
  inclinaisonOptimaleDeg: 35,
  /** Performance Ratio (PR) standard installation tertiaire */
  performanceRatio: 0.8,
  /** Prix électricité tertiaire bleu pro - fourchette basse */
  prixKwhMin: 0.18,
  /** Prix électricité tertiaire bleu pro - fourchette haute */
  prixKwhMax: 0.22,
  /** Tarif OA surplus < 100 kWc - T2 2026 (€/kWh) */
  tarifOaSurplusKwh: 0.0536,
  /** Coût installation estimé tertiaire > 36 kWc (€/kWc) - fourchette basse */
  coutKwcMin: 900,
  /** Coût installation estimé tertiaire > 36 kWc (€/kWc) - fourchette haute */
  coutKwcMax: 1100,
} as const

// ----------------------------------------------------------------------------
// Estimation volumétrie - utile pour le monitoring de l'entonnoir
// ----------------------------------------------------------------------------

export const VOLUMETRIE_ATTENDUE = {
  batimentsTier1: { min: 800, max: 1200 },
  apresFiltreUsage: { min: 500, max: 800 },
  apresFiltreSiren: { min: 350, max: 600 },
  apresFiltreEmail: { min: 150, max: 300 },
  cibleCampagnePilote: 50,
} as const
