/**
 * Tests unitaires - Génération overlay SVG (SOL-14)
 * ERE SOLAR BOT - Vitest
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  metresParPixel,
  panneauVersSvgRect,
  genererOverlaySvg,
  COULEUR_PANNEAU,
  COULEUR_BORDURE,
} from '../../src/solar/overlay-svg'
import type { BuildingInsightsResponse } from '../../src/solar/types'

const fixture: BuildingInsightsResponse = JSON.parse(
  readFileSync(
    resolve(__dirname, '../fixtures/google-solar-with-panels.json'),
    'utf8',
  ),
)

// =============================================
// metresParPixel
// =============================================

describe('metresParPixel', () => {
  it('renvoie ~0.075 m/px au zoom 20 à Lyon (lat 45.7°)', () => {
    const mpp = metresParPixel(45.7485, 20)
    expect(mpp).toBeGreaterThan(0.07)
    expect(mpp).toBeLessThan(0.12)
  })

  it("decroit avec un zoom plus eleve", () => {
    const mpp19 = metresParPixel(48.85, 19)
    const mpp20 = metresParPixel(48.85, 20)
    const mpp21 = metresParPixel(48.85, 21)
    expect(mpp19).toBeGreaterThan(mpp20)
    expect(mpp20).toBeGreaterThan(mpp21)
  })

  it("decroit aux poles (lat eleve)", () => {
    const mppEquator = metresParPixel(0, 20)
    const mppPole = metresParPixel(80, 20)
    expect(mppEquator).toBeGreaterThan(mppPole)
  })
})

// =============================================
// panneauVersSvgRect
// =============================================

describe('panneauVersSvgRect', () => {
  it("genere un rect SVG avec les bons attributs et couleurs", () => {
    const svg = panneauVersSvgRect({
      panneau: {
        center: { latitude: 45.7485, longitude: 4.8467 },
        orientation: 'PORTRAIT',
      },
      panelHeightMeters: 1.879,
      panelWidthMeters: 1.045,
      imageWidth: 800,
      imageHeight: 600,
      centerLat: 45.7485,
      centerLng: 4.8467,
      zoom: 20,
      azimuthDeg: 178,
      index: 0,
    })
    expect(svg).toContain('<rect')
    expect(svg).toContain(`fill="${COULEUR_PANNEAU}"`)
    expect(svg).toContain(`stroke="${COULEUR_BORDURE}"`)
    expect(svg).toContain('data-panel-index="0"')
    expect(svg).toContain('rotate(178')
  })

  it("rect plus haut que large pour orientation PORTRAIT", () => {
    const svg = panneauVersSvgRect({
      panneau: {
        center: { latitude: 45.7485, longitude: 4.8467 },
        orientation: 'PORTRAIT',
      },
      panelHeightMeters: 1.879,
      panelWidthMeters: 1.045,
      imageWidth: 800,
      imageHeight: 600,
      centerLat: 45.7485,
      centerLng: 4.8467,
      zoom: 20,
      index: 0,
    })
    const w = Number(svg.match(/ width="([\d.]+)"/)?.[1] ?? '0')
    const h = Number(svg.match(/ height="([\d.]+)"/)?.[1] ?? '0')
    expect(h).toBeGreaterThan(w)
  })

  it("rect plus large que haut pour orientation LANDSCAPE", () => {
    const svg = panneauVersSvgRect({
      panneau: {
        center: { latitude: 45.7485, longitude: 4.8467 },
        orientation: 'LANDSCAPE',
      },
      panelHeightMeters: 1.879,
      panelWidthMeters: 1.045,
      imageWidth: 800,
      imageHeight: 600,
      centerLat: 45.7485,
      centerLng: 4.8467,
      zoom: 20,
      index: 0,
    })
    const w = Number(svg.match(/ width="([\d.]+)"/)?.[1] ?? '0')
    const h = Number(svg.match(/ height="([\d.]+)"/)?.[1] ?? '0')
    expect(w).toBeGreaterThan(h)
  })
})

// =============================================
// genererOverlaySvg
// =============================================

describe('genererOverlaySvg', () => {
  it("genere un SVG conforme avec 8 rects pour la fixture", () => {
    const svg = genererOverlaySvg({
      insights: fixture,
      imageWidth: 800,
      imageHeight: 600,
      zoom: 20,
    })
    expect(svg).toMatch(/^<svg /)
    expect(svg).toContain('viewBox="0 0 800 600"')
    expect(svg).toContain('width="800"')
    expect(svg).toContain('height="600"')
    expect(svg.match(/<rect /g)?.length).toBe(8)
    expect(svg).toContain('</svg>')
  })

  it('inclut un titre lisible', () => {
    const svg = genererOverlaySvg({
      insights: fixture,
      imageWidth: 800,
      imageHeight: 600,
      zoom: 20,
    })
    expect(svg).toContain('<title>')
    expect(svg).toContain('8 panneaux')
  })

  it('renvoie un SVG vide si solarPotential absent', () => {
    const sansPotential: BuildingInsightsResponse = {
      name: 'X',
      center: { latitude: 0, longitude: 0 },
    }
    const svg = genererOverlaySvg({
      insights: sansPotential,
      imageWidth: 100,
      imageHeight: 100,
    })
    expect(svg).toContain('<svg ')
    expect(svg).not.toContain('<rect')
  })

  it('renvoie un SVG sans rect si solarPanels absent', () => {
    const sansPanels: BuildingInsightsResponse = {
      name: 'X',
      center: { latitude: 0, longitude: 0 },
      solarPotential: { maxArrayPanelsCount: 10 },
    }
    const svg = genererOverlaySvg({
      insights: sansPanels,
      imageWidth: 100,
      imageHeight: 100,
    })
    expect(svg).not.toContain('<rect')
  })

  it('rotation azimut differente entre segments 0 et 1', () => {
    const svg = genererOverlaySvg({
      insights: fixture,
      imageWidth: 800,
      imageHeight: 600,
      zoom: 20,
    })
    // Segment 0 azimut 178, segment 1 azimut 358
    expect(svg).toContain('rotate(178.00')
    expect(svg).toContain('rotate(358.00')
  })
})
