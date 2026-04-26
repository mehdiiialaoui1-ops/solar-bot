/**
 * Tests unitaires - Client Google Maps Static + projection pixel
 * ERE SOLAR BOT - Vitest
 */

import { describe, it, expect } from 'vitest'
import {
  buildStaticMapUrl,
  gpsVersPixelImage,
  GOOGLE_MAPS_STATIC_ENDPOINT,
} from '../../src/solar/google-maps-static'
import { SolarApiError } from '../../src/solar/types'

const FAKE_KEY = 'AIzaSyTestKeyForUnitTesting1234567890'

// =============================================
// buildStaticMapUrl
// =============================================

describe('buildStaticMapUrl', () => {
  it("construit l'URL avec defauts (zoom 20, satellite, scale 2)", () => {
    const url = buildStaticMapUrl({ lat: 48.8566, lng: 2.3522, apiKey: FAKE_KEY })
    expect(url).toContain(GOOGLE_MAPS_STATIC_ENDPOINT)
    expect(url).toContain('center=48.8566%2C2.3522')
    expect(url).toContain('zoom=20')
    expect(url).toContain('size=600x400')
    expect(url).toContain('maptype=satellite')
    expect(url).toContain('scale=2')
    expect(url).toContain(`key=${FAKE_KEY}`)
  })

  it('respecte zoom et taille personnalises', () => {
    const url = buildStaticMapUrl({
      lat: 48.8566,
      lng: 2.3522,
      apiKey: FAKE_KEY,
      zoom: 18,
      width: 1024,
      height: 768,
    })
    expect(url).toContain('zoom=18')
    expect(url).toContain('size=1024x768')
  })

  it('rejette zoom hors bornes', () => {
    expect(() =>
      buildStaticMapUrl({ lat: 0, lng: 0, apiKey: FAKE_KEY, zoom: 22 }),
    ).toThrow(SolarApiError)
    expect(() =>
      buildStaticMapUrl({ lat: 0, lng: 0, apiKey: FAKE_KEY, zoom: -1 }),
    ).toThrow(SolarApiError)
  })

  it('rejette des coordonnees non finies', () => {
    expect(() =>
      buildStaticMapUrl({ lat: NaN, lng: 0, apiKey: FAKE_KEY }),
    ).toThrow(SolarApiError)
  })
})

// =============================================
// gpsVersPixelImage
// =============================================

describe('gpsVersPixelImage', () => {
  const baseOpts = {
    centerLat: 48.8566,
    centerLng: 2.3522,
    zoom: 20,
    width: 600,
    height: 400,
  }

  it('renvoie le centre exact pour le centre de la carte', () => {
    const p = gpsVersPixelImage({
      lat: baseOpts.centerLat,
      lng: baseOpts.centerLng,
      ...baseOpts,
    })
    expect(p.x).toBe(300)
    expect(p.y).toBe(200)
  })

  it('place un point a l est du centre a x > 300', () => {
    const p = gpsVersPixelImage({
      lat: baseOpts.centerLat,
      lng: baseOpts.centerLng + 0.0001,
      ...baseOpts,
    })
    expect(p.x).toBeGreaterThan(300)
  })

  it('place un point au nord du centre a y < 200 (axe inverse)', () => {
    const p = gpsVersPixelImage({
      lat: baseOpts.centerLat + 0.0001,
      lng: baseOpts.centerLng,
      ...baseOpts,
    })
    expect(p.y).toBeLessThan(200)
  })

  it('renvoie des entiers', () => {
    const p = gpsVersPixelImage({
      lat: 48.85695,
      lng: 2.35275,
      ...baseOpts,
    })
    expect(Number.isInteger(p.x)).toBe(true)
    expect(Number.isInteger(p.y)).toBe(true)
  })
})
