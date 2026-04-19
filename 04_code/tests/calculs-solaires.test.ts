/**
 * Tests unitaires — Fonctions de calcul solaire
 * ERE SOLAR BOT — Vitest
 */

import { describe, it, expect } from 'vitest'
import {
  calculerNbPanneaux,
  calculerPuissanceKwc,
  calculerProductionAnnuelle,
  calculerEconomieAnnuelle,
  calculerROI,
  estimerCoutInstallation,
  calculerPrimeAutoconsommation,
  calculerSuramortissement,
  gpsVersPixel,
  PUISSANCE_PANNEAU_KWC,
  SURFACE_PANNEAU_M2,
  RATIO_SURFACE_UTILE,
} from '../src/lib/calculs-solaires'

// =============================================
// Dimensionnement
// =============================================

describe('calculerNbPanneaux', () => {
  it('calcule correctement le nombre de panneaux pour 1000 m²', () => {
    const surface = 1000
    const surface_utile = surface * RATIO_SURFACE_UTILE
    const nb_attendu = Math.floor(surface_utile / SURFACE_PANNEAU_M2)
    expect(calculerNbPanneaux(surface)).toBe(nb_attendu)
  })

  it('retourne 0 pour une surface trop petite pour un panneau', () => {
    expect(calculerNbPanneaux(1)).toBe(0)
  })

  it('lève une erreur pour une surface négative ou nulle', () => {
    expect(() => calculerNbPanneaux(-100)).toThrow()
    expect(() => calculerNbPanneaux(0)).toThrow()
  })

  it('calcule correctement pour un entrepôt type de 5000 m²', () => {
    const nb = calculerNbPanneaux(5000)
    expect(nb).toBeGreaterThan(0)
    expect(nb).toBeLessThan(5000) // sanity check
  })
})

describe('calculerPuissanceKwc', () => {
  it('calcule la puissance pour 100 panneaux', () => {
    expect(calculerPuissanceKwc(100)).toBe(100 * PUISSANCE_PANNEAU_KWC)
  })

  it('retourne 0 pour 0 panneaux', () => {
    expect(calculerPuissanceKwc(0)).toBe(0)
  })

  it('lève une erreur pour un nombre négatif', () => {
    expect(() => calculerPuissanceKwc(-1)).toThrow()
  })
})

describe('calculerProductionAnnuelle', () => {
  it('calcule correctement avec les paramètres typiques IDF', () => {
    // 100 kWc à Paris (irradiation ~1100 kWh/m²/an), PR 0.75
    const production = calculerProductionAnnuelle(100, 1100, 0.75)
    expect(production).toBe(82500) // 100 × 1100 × 0.75
  })

  it('calcule correctement avec les paramètres PACA', () => {
    // 100 kWc en PACA (irradiation ~1600 kWh/m²/an)
    const production = calculerProductionAnnuelle(100, 1600, 0.75)
    expect(production).toBe(120000)
  })

  it('lève une erreur pour une puissance négative', () => {
    expect(() => calculerProductionAnnuelle(-1, 1100)).toThrow()
  })

  it('lève une erreur pour une irradiation nulle', () => {
    expect(() => calculerProductionAnnuelle(100, 0)).toThrow()
  })

  it('lève une erreur pour un ratio de performance invalide', () => {
    expect(() => calculerProductionAnnuelle(100, 1100, 1.5)).toThrow()
    expect(() => calculerProductionAnnuelle(100, 1100, 0)).toThrow()
  })
})

// =============================================
// Économies et ROI
// =============================================

describe('calculerEconomieAnnuelle', () => {
  it('calcule l\'économie avec les paramètres par défaut', () => {
    // 100 000 kWh produits, 70% autoconso à 0.22€, 30% revendu à 0.13€
    const economie = calculerEconomieAnnuelle(100000)
    const attendu = 70000 * 0.22 + 30000 * 0.13
    expect(economie).toBeCloseTo(attendu, 2)
  })

  it('calcule correctement en autoconsommation totale (100%)', () => {
    const economie = calculerEconomieAnnuelle(50000, 1.0, 0.22, 0.13)
    expect(economie).toBeCloseTo(50000 * 0.22, 2)
  })

  it('calcule correctement en revente totale (0% autoconso)', () => {
    const economie = calculerEconomieAnnuelle(50000, 0, 0.22, 0.13)
    expect(economie).toBeCloseTo(50000 * 0.13, 2)
  })

  it('lève une erreur pour un taux d\'autoconsommation > 1', () => {
    expect(() => calculerEconomieAnnuelle(50000, 1.5)).toThrow()
  })
})

describe('calculerROI', () => {
  it('calcule le ROI sans aides', () => {
    const roi = calculerROI(200000, 20000, 0)
    expect(roi).toBe(10) // 200k / 20k = 10 ans
  })

  it('calcule le ROI avec aides', () => {
    const roi = calculerROI(200000, 20000, 40000)
    expect(roi).toBe(8) // (200k - 40k) / 20k = 8 ans
  })

  it('retourne 0 si les aides couvrent tout l\'investissement', () => {
    const roi = calculerROI(100000, 10000, 100000)
    expect(roi).toBe(0)
  })

  it('lève une erreur pour un coût nul', () => {
    expect(() => calculerROI(0, 10000)).toThrow()
  })

  it('lève une erreur pour une économie nulle', () => {
    expect(() => calculerROI(100000, 0)).toThrow()
  })
})

describe('estimerCoutInstallation', () => {
  it('applique le bon tarif pour une petite installation (< 36 kWc)', () => {
    expect(estimerCoutInstallation(20)).toBe(20 * 1800)
  })

  it('applique le bon tarif pour une installation moyenne (36-100 kWc)', () => {
    expect(estimerCoutInstallation(80)).toBe(80 * 1400)
  })

  it('applique le bon tarif pour une grande installation (100-500 kWc)', () => {
    expect(estimerCoutInstallation(300)).toBe(300 * 1100)
  })

  it('applique le bon tarif pour une très grande installation (> 500 kWc)', () => {
    expect(estimerCoutInstallation(1000)).toBe(1000 * 900)
  })

  it('lève une erreur pour une puissance nulle', () => {
    expect(() => estimerCoutInstallation(0)).toThrow()
  })
})

// =============================================
// Aides financières
// =============================================

describe('calculerPrimeAutoconsommation', () => {
  it('retourne 0 pour une installation > 100 kWc', () => {
    expect(calculerPrimeAutoconsommation(150)).toBe(0)
    expect(calculerPrimeAutoconsommation(100.1)).toBe(0)
  })

  it('calcule correctement pour une petite installation (≤ 3 kWc)', () => {
    expect(calculerPrimeAutoconsommation(3)).toBe(3 * 330)
  })

  it('calcule correctement pour 9 kWc', () => {
    expect(calculerPrimeAutoconsommation(9)).toBe(9 * 230)
  })

  it('calcule correctement pour 36 kWc', () => {
    expect(calculerPrimeAutoconsommation(36)).toBe(36 * 200)
  })

  it('calcule correctement pour 100 kWc', () => {
    expect(calculerPrimeAutoconsommation(100)).toBe(100 * 100)
  })

  it('lève une erreur pour une puissance nulle', () => {
    expect(() => calculerPrimeAutoconsommation(0)).toThrow()
  })
})

describe('calculerSuramortissement', () => {
  it('calcule l\'économie fiscale à 25% IS', () => {
    // 200 000 € × 40% × 25% = 20 000 €
    expect(calculerSuramortissement(200000, 0.25)).toBe(20000)
  })

  it('calcule l\'économie fiscale à 15% IS (PME)', () => {
    expect(calculerSuramortissement(100000, 0.15)).toBe(6000)
  })

  it('lève une erreur pour un coût nul', () => {
    expect(() => calculerSuramortissement(0)).toThrow()
  })

  it('lève une erreur pour un taux IS invalide', () => {
    expect(() => calculerSuramortissement(100000, 0)).toThrow()
    expect(() => calculerSuramortissement(100000, 1.5)).toThrow()
  })
})

// =============================================
// Projection pixel
// =============================================

describe('gpsVersPixel', () => {
  it('retourne le centre exact pour un point identique au centre', () => {
    const lat = 48.8566
    const lng = 2.3522
    const result = gpsVersPixel(lat, lng, lat, lng, 18, 1280, 720)
    expect(result.x).toBe(640) // 1280 / 2
    expect(result.y).toBe(360) // 720 / 2
  })

  it('retourne des coordonnées à l\'est du centre pour un point plus à l\'est', () => {
    const result_est = gpsVersPixel(48.8566, 2.3600, 48.8566, 2.3522, 18, 1280, 720)
    expect(result_est.x).toBeGreaterThan(640) // Plus à droite (est)
  })

  it('retourne des coordonnées au nord du centre (y plus petit) pour un point plus au nord', () => {
    const result_nord = gpsVersPixel(48.8600, 2.3522, 48.8566, 2.3522, 18, 1280, 720)
    expect(result_nord.y).toBeLessThan(360) // Plus haut (nord = y décroissant)
  })

  it('retourne des entiers (pas de sous-pixels)', () => {
    const result = gpsVersPixel(48.8570, 2.3525, 48.8566, 2.3522, 18, 1280, 720)
    expect(Number.isInteger(result.x)).toBe(true)
    expect(Number.isInteger(result.y)).toBe(true)
  })
})
