/**
 * Tests unitaires - Client Google Solar API (Building Insights)
 * ERE SOLAR BOT - Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSolarUrl,
  fetchBuildingInsights,
  selectionnerConfigMax,
  selectionnerConfigCible,
  buildingInsightsVersCalcul,
  GOOGLE_SOLAR_ENDPOINT,
} from '../../src/solar/google-solar'
import { SolarApiError } from '../../src/solar/types'
import type { BuildingInsightsResponse } from '../../src/solar/types'

const fixture: BuildingInsightsResponse = JSON.parse(
  readFileSync(
    resolve(__dirname, '../fixtures/google-solar-sample.json'),
    'utf8',
  ),
)

const FAKE_KEY = 'AIzaSyTestKeyForUnitTesting1234567890'

// =============================================
// buildSolarUrl
// =============================================

describe('buildSolarUrl', () => {
  it("construit l'URL avec lat/lng/key", () => {
    const url = buildSolarUrl({ lat: 48.8566, lng: 2.3522, apiKey: FAKE_KEY })
    expect(url).toContain(GOOGLE_SOLAR_ENDPOINT)
    expect(url).toContain('location.latitude=48.8566')
    expect(url).toContain('location.longitude=2.3522')
    expect(url).toContain('requiredQuality=HIGH')
    expect(url).toContain(`key=${FAKE_KEY}`)
  })

  it('rejette des coordonnees non finies', () => {
    expect(() => buildSolarUrl({ lat: NaN, lng: 0, apiKey: FAKE_KEY })).toThrow(SolarApiError)
  })

  it('rejette une cle API absente ou trop courte', () => {
    expect(() => buildSolarUrl({ lat: 48.8, lng: 2.3, apiKey: '' })).toThrow(SolarApiError)
    expect(() => buildSolarUrl({ lat: 48.8, lng: 2.3, apiKey: 'short' })).toThrow(SolarApiError)
  })
})

// =============================================
// fetchBuildingInsights
// =============================================

describe('fetchBuildingInsights', () => {
  it('renvoie le JSON quand 200 OK', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => fixture,
    } as Response)

    const result = await fetchBuildingInsights({
      lat: 48.8566,
      lng: 2.3522,
      apiKey: FAKE_KEY,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result.center.latitude).toBe(48.8566)
    expect(result.solarPotential?.maxArrayPanelsCount).toBe(248)
  })

  it('lève NO_BUILDING_FOUND sur HTTP 404', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({}),
    } as Response)

    await expect(
      fetchBuildingInsights({
        lat: 48.8566,
        lng: 2.3522,
        apiKey: FAKE_KEY,
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/Aucun batiment/)
  })

  it('lève HTTP_ERROR sur 500', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({}),
    } as Response)

    await expect(
      fetchBuildingInsights({
        lat: 48.8566,
        lng: 2.3522,
        apiKey: FAKE_KEY,
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(SolarApiError)
  })

  it('lève PARSE_ERROR si "center" manquant', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ name: 'foo' }),
    } as Response)

    await expect(
      fetchBuildingInsights({
        lat: 48.8566,
        lng: 2.3522,
        apiKey: FAKE_KEY,
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/center/)
  })
})

// =============================================
// Selecteurs de configuration
// =============================================

describe('selectionnerConfigMax', () => {
  it('renvoie la config avec le plus de panneaux', () => {
    const c = selectionnerConfigMax(fixture.solarPotential!.solarPanelConfigs)
    expect(c?.panelsCount).toBe(248)
    expect(c?.yearlyEnergyDcKwh).toBe(88560)
  })

  it('renvoie null sur liste vide ou undefined', () => {
    expect(selectionnerConfigMax(undefined)).toBeNull()
    expect(selectionnerConfigMax([])).toBeNull()
  })
})

describe('selectionnerConfigCible', () => {
  it('renvoie la config la plus proche d une cible', () => {
    const c = selectionnerConfigCible(
      fixture.solarPotential!.solarPanelConfigs,
      90,
    )
    expect(c?.panelsCount).toBe(100)
  })

  it('renvoie la borne haute si cible > max', () => {
    const c = selectionnerConfigCible(
      fixture.solarPotential!.solarPanelConfigs,
      500,
    )
    expect(c?.panelsCount).toBe(248)
  })
})

// =============================================
// Conversion vers CalculSolaireResult
// =============================================

describe('buildingInsightsVersCalcul', () => {
  it('convertit la fixture en calcul normalise', () => {
    const calcul = buildingInsightsVersCalcul(fixture, 'prospect-123')
    expect(calcul).not.toBeNull()
    expect(calcul!.prospect_id).toBe('prospect-123')
    expect(calcul!.nb_panneaux_max).toBe(248)
    // 248 panneaux * 400W = 99.2 kWc
    expect(calcul!.puissance_kwc).toBeCloseTo(99.2, 1)
    expect(calcul!.production_kwh_an).toBe(88560)
    expect(calcul!.surface_toiture_utile_m2).toBe(487.3)
    // segment dominant = celui avec plus de panneaux (152 sur azimuth 178)
    expect(calcul!.azimut_deg).toBe(178)
    expect(calcul!.inclinaison_deg).toBe(22)
    expect(calcul!.imagery_date).toBe('2024-06-15')
    expect(calcul!.source_api).toBe('pvgis')
  })

  it('renvoie null si solarPotential absent', () => {
    const fakeRes: BuildingInsightsResponse = {
      name: 'X',
      center: { latitude: 0, longitude: 0 },
    }
    expect(buildingInsightsVersCalcul(fakeRes)).toBeNull()
  })
})
