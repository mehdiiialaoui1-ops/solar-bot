/**
 * Tests unitaires - Client PVGIS (Commission europeenne)
 * ERE SOLAR BOT - Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildPvgisUrl,
  fetchPvgis,
  parserReponsePvgis,
  estimerInstallation,
  PVGIS_ENDPOINT,
  DEFAULT_INCLINAISON_DEG,
  DEFAULT_AZIMUT_DEG,
  DEFAULT_PERTES_PCT,
  SURFACE_PANNEAU_M2,
  PUISSANCE_PANNEAU_WC,
  TAUX_COUVERTURE,
} from '../../src/solar/pvgis'
import { SolarApiError } from '../../src/solar/types'

const fixture = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/pvgis-sample.json'), 'utf8'),
)

// =============================================
// buildPvgisUrl
// =============================================

describe('buildPvgisUrl', () => {
  it("construit l'URL avec les defauts (toit plat sud, 14% pertes, 30°)", () => {
    const url = buildPvgisUrl({
      lat: 45.7485,
      lon: 4.8467,
      puissanceKwc: 99.2,
    })
    expect(url).toContain(PVGIS_ENDPOINT)
    expect(url).toContain('lat=45.7485')
    expect(url).toContain('lon=4.8467')
    expect(url).toContain('peakpower=99.2')
    expect(url).toContain('loss=14')
    expect(url).toContain('angle=30')
    expect(url).toContain('aspect=0')
    expect(url).toContain('outputformat=json')
    expect(url).toContain('raddatabase=PVGIS-SARAH2')
  })

  it('respecte inclinaison/azimut/pertes custom', () => {
    const url = buildPvgisUrl({
      lat: 45.7485,
      lon: 4.8467,
      puissanceKwc: 50,
      inclinaisonDeg: 45,
      azimutDeg: -90, // est
      pertesPct: 10,
    })
    expect(url).toContain('angle=45')
    expect(url).toContain('aspect=-90')
    expect(url).toContain('loss=10')
  })

  it('rejette des coordonnees non finies', () => {
    expect(() =>
      buildPvgisUrl({ lat: NaN, lon: 0, puissanceKwc: 10 }),
    ).toThrow(SolarApiError)
  })

  it('rejette une latitude hors bornes', () => {
    expect(() =>
      buildPvgisUrl({ lat: 95, lon: 0, puissanceKwc: 10 }),
    ).toThrow(SolarApiError)
  })

  it('rejette une longitude hors bornes', () => {
    expect(() =>
      buildPvgisUrl({ lat: 0, lon: 200, puissanceKwc: 10 }),
    ).toThrow(SolarApiError)
  })

  it('rejette une puissance crete <= 0', () => {
    expect(() =>
      buildPvgisUrl({ lat: 45, lon: 4, puissanceKwc: 0 }),
    ).toThrow(SolarApiError)
    expect(() =>
      buildPvgisUrl({ lat: 45, lon: 4, puissanceKwc: -5 }),
    ).toThrow(SolarApiError)
  })

  it('rejette une inclinaison hors bornes', () => {
    expect(() =>
      buildPvgisUrl({
        lat: 45,
        lon: 4,
        puissanceKwc: 10,
        inclinaisonDeg: 95,
      }),
    ).toThrow(SolarApiError)
  })

  it("permet de surcharger raddatabase pour autres regions", () => {
    const url = buildPvgisUrl({
      lat: 45.7485,
      lon: 4.8467,
      puissanceKwc: 99.2,
      radDatabase: 'PVGIS-ERA5',
    })
    expect(url).toContain('raddatabase=PVGIS-ERA5')
  })
})

// =============================================
// parserReponsePvgis
// =============================================

describe('parserReponsePvgis', () => {
  const fallback = {
    inclinaisonDeg: 30,
    azimutDeg: 0,
    pertesPct: 14,
    puissanceKwc: 99.2,
  }

  it('parse une reponse PVGIS valide', () => {
    const result = parserReponsePvgis(fixture, fallback)
    expect(result.productionAnnuelleKwh).toBe(108_900)
    expect(result.productionMensuelle).toHaveLength(12)
    expect(result.productionMensuelle[0]).toEqual({ mois: 1, kwh: 4823 })
    expect(result.productionMensuelle[5]).toEqual({ mois: 6, kwh: 12502 })
    expect(result.irradiationAnnuelleKwhM2).toBe(1492)
    expect(result.puissanceKwc).toBe(99.2)
    expect(result.perteSysteme).toBe(14)
  })

  it('lève PARSE_ERROR si totals.fixed.E_y manquant', () => {
    expect(() =>
      parserReponsePvgis({ outputs: { monthly: { fixed: [] } } }, fallback),
    ).toThrow(/E_y manquant/)
  })

  it('lève PARSE_ERROR si monthly n a pas 12 entrees', () => {
    const tronque = {
      outputs: {
        monthly: { fixed: fixture.outputs.monthly.fixed.slice(0, 6) },
        totals: { fixed: { E_y: 50000, 'H(i)_y': 1200 } },
      },
    }
    expect(() => parserReponsePvgis(tronque, fallback)).toThrow(/12 entrees/)
  })

  it('lève PARSE_ERROR si reponse vide ou non-objet', () => {
    expect(() => parserReponsePvgis(null, fallback)).toThrow(SolarApiError)
    expect(() => parserReponsePvgis('not an object', fallback)).toThrow(SolarApiError)
  })
})

// =============================================
// fetchPvgis
// =============================================

describe('fetchPvgis', () => {
  it('renvoie PvgisResult sur 200 OK', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => fixture,
    } as Response)

    const result = await fetchPvgis({
      lat: 45.7485,
      lon: 4.8467,
      puissanceKwc: 99.2,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result.productionAnnuelleKwh).toBe(108_900)
    expect(fakeFetch).toHaveBeenCalledOnce()
  })

  it('lève HTTP_ERROR sur 500', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({}),
    } as Response)

    await expect(
      fetchPvgis({
        lat: 45.7485,
        lon: 4.8467,
        puissanceKwc: 99.2,
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(SolarApiError)
  })
})

// =============================================
// estimerInstallation
// =============================================

describe('estimerInstallation', () => {
  it('estime correctement pour une grande toiture', () => {
    // 2150 m² * 0.7 = 1505 m² utile
    // 1505 / 1.7 ≈ 885 panneaux
    // 885 * 400 / 1000 ≈ 354 kWc
    const r = estimerInstallation(2150)
    expect(r.surfaceUtile).toBeCloseTo(1505, 0)
    expect(r.nbPanneaux).toBeGreaterThan(800)
    expect(r.nbPanneaux).toBeLessThan(900)
    expect(r.puissanceKwc).toBeGreaterThan(320)
    expect(r.puissanceKwc).toBeLessThan(360)
  })

  it("rejette une surface <= 0", () => {
    expect(() => estimerInstallation(0)).toThrow(SolarApiError)
    expect(() => estimerInstallation(-50)).toThrow(SolarApiError)
  })

  it("expose les constantes panneau pour reutilisation", () => {
    expect(SURFACE_PANNEAU_M2).toBe(1.7)
    expect(PUISSANCE_PANNEAU_WC).toBe(400)
    expect(TAUX_COUVERTURE).toBe(0.7)
  })

  it("expose les valeurs par defaut PVGIS", () => {
    expect(DEFAULT_INCLINAISON_DEG).toBe(30)
    expect(DEFAULT_AZIMUT_DEG).toBe(0)
    expect(DEFAULT_PERTES_PCT).toBe(14)
  })
})
