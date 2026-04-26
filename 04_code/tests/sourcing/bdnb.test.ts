/**
 * Tests unitaires - Client API BDNB + helpers
 * ERE SOLAR BOT - Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildBdnbUrl,
  fetchBatiments,
  parseWktPoint,
  bdnbVersProspectCandidat,
  BDNB_ENDPOINT,
  SURFACE_APER_M2,
} from '../../src/sourcing/bdnb'
import { SourcingError } from '../../src/sourcing/types'
import type { BdnbReponse, BdnbBatiment } from '../../src/sourcing/types'

const fixture: BdnbReponse = JSON.parse(
  readFileSync(
    resolve(__dirname, '../fixtures/bdnb-batiment-sample.json'),
    'utf8',
  ),
)

// =============================================
// buildBdnbUrl
// =============================================

describe('buildBdnbUrl', () => {
  it("construit l'URL avec defauts (tertiaire, surface 500)", () => {
    const url = buildBdnbUrl({ codeInsee: '75101' })
    expect(url).toContain(BDNB_ENDPOINT)
    expect(url).toContain('code_insee=75101')
    expect(url).toContain('usage_principal_bdnb_open=tertiaire')
    expect(url).toContain('surface_activite_min=500')
  })

  it('respecte une surface minimale custom', () => {
    const url = buildBdnbUrl({ codeInsee: '75101', surfaceMinM2: 1000 })
    expect(url).toContain('surface_activite_min=1000')
  })

  it('rejette un code INSEE invalide', () => {
    expect(() => buildBdnbUrl({ codeInsee: 'BAD' })).toThrow(SourcingError)
  })
})

// =============================================
// fetchBatiments - pagination + erreurs
// =============================================

describe('fetchBatiments', () => {
  it('agrege les resultats sur une seule page', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => fixture,
    } as Response)

    const batiments = await fetchBatiments({
      codeInsee: '75101',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(batiments).toHaveLength(4)
    expect(fakeFetch).toHaveBeenCalledOnce()
  })

  it('suit la pagination via "next"', async () => {
    const page1: BdnbReponse = {
      results: fixture.results.slice(0, 2),
      next: 'https://bdnb.io/api/v1/donnees/batiment_groupe?page=2',
      previous: null,
    }
    const page2: BdnbReponse = {
      results: fixture.results.slice(2),
      next: null,
      previous: null,
    }
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => page1,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => page2,
      } as Response)

    const batiments = await fetchBatiments({
      codeInsee: '75101',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(batiments).toHaveLength(4)
    expect(fakeFetch).toHaveBeenCalledTimes(2)
  })

  it('respecte maxPages pour eviter une boucle infinie', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        results: [fixture.results[0]],
        next: 'https://bdnb.io/loop',
      }),
    } as Response)

    await fetchBatiments({
      codeInsee: '75101',
      fetchImpl: fakeFetch as unknown as typeof fetch,
      maxPages: 3,
    })
    expect(fakeFetch).toHaveBeenCalledTimes(3)
  })

  it('lève SourcingError sur HTTP 503', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      statusText: 'Unavailable',
      json: async () => ({}),
    } as Response)
    await expect(
      fetchBatiments({
        codeInsee: '75101',
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(SourcingError)
  })
})

// =============================================
// parseWktPoint
// =============================================

describe('parseWktPoint', () => {
  it('parse un POINT WKT standard', () => {
    expect(parseWktPoint('POINT(2.3522 48.8566)')).toEqual({
      lng: 2.3522,
      lat: 48.8566,
    })
  })

  it('tolère espaces multiples et casse', () => {
    expect(parseWktPoint('point( 2.3522   48.8566 )')).toEqual({
      lng: 2.3522,
      lat: 48.8566,
    })
  })

  it('retourne null sur format invalide', () => {
    expect(parseWktPoint('FOO')).toBeNull()
    expect(parseWktPoint(undefined)).toBeNull()
    expect(parseWktPoint('POINT(abc def)')).toBeNull()
  })
})

// =============================================
// bdnbVersProspectCandidat
// =============================================

describe('bdnbVersProspectCandidat', () => {
  it('convertit un batiment >= 500 m2 avec WKT', () => {
    const c = bdnbVersProspectCandidat(fixture.results[0], 'Paris')
    expect(c).not.toBeNull()
    expect(c!.surface_m2).toBe(2150)
    expect(c!.code_insee).toBe('75101')
    expect(c!.commune).toBe('Paris')
    expect(c!.lat).toBeCloseTo(48.8566, 4)
    expect(c!.lng).toBeCloseTo(2.3522, 4)
    expect(c!.source).toBe('bdnb')
    expect(c!.siret_proprietaire).toBe('12345678900001')
  })

  it('rejette un batiment sous le seuil APER', () => {
    const c = bdnbVersProspectCandidat(fixture.results[2]) // 320 m2
    expect(c).toBeNull()
  })

  it('utilise lat/lng explicites quand WKT absent', () => {
    const c = bdnbVersProspectCandidat(fixture.results[3]) // entrepot
    expect(c).not.toBeNull()
    expect(c!.lat).toBe(48.87)
    expect(c!.lng).toBe(2.35)
    expect(c!.usage).toBe('industriel')
  })

  it('rejette si aucune coordonnee disponible', () => {
    const bat: BdnbBatiment = {
      batiment_groupe_id: 'X',
      code_insee: '75101',
      surface_activite: 1000,
    }
    expect(bdnbVersProspectCandidat(bat)).toBeNull()
  })

  it('confirme le seuil SURFACE_APER_M2 = 500', () => {
    expect(SURFACE_APER_M2).toBe(500)
  })
})
