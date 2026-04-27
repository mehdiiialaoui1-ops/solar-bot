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
  parseGeoJsonCentroid,
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
  it("construit l'URL avec defauts PostgREST (Tertiaire, limit 100)", () => {
    const url = buildBdnbUrl({ codeInsee: '75101' })
    expect(url).toContain(BDNB_ENDPOINT)
    expect(url).toContain('code_commune_insee=eq.75101')
    expect(url).toContain('usage_principal_bdnb_open=eq.Tertiaire')
    expect(url).toContain('limit=100')
  })

  it('supporte le champ commune_parente pour les arrondissements', () => {
    const url = buildBdnbUrl({ codeInsee: '69123', communeField: 'commune_parente' })
    expect(url).toContain('commune_parente=eq.69123')
    expect(url).not.toContain('code_commune_insee')
  })

  it('supporte un offset pour la pagination', () => {
    const url = buildBdnbUrl({ codeInsee: '75101', offset: 500 })
    expect(url).toContain('offset=500')
  })

  it('n ajoute pas offset=0', () => {
    const url = buildBdnbUrl({ codeInsee: '75101' })
    expect(url).not.toContain('offset=')
  })

  it('rejette un code INSEE invalide', () => {
    expect(() => buildBdnbUrl({ codeInsee: 'BAD' })).toThrow(SourcingError)
  })
})

// =============================================
// fetchBatiments - pagination + erreurs
// =============================================

describe('fetchBatiments', () => {
  // La fixture est au format ancien {results: [...]}. On extrait les
  // batiments en tableau pour simuler le nouveau format PostgREST.
  const batimentsArray = fixture.results

  it('retourne les batiments >= 500 m2 (filtre client)', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => batimentsArray,
    } as Response)

    const batiments = await fetchBatiments({
      codeInsee: '75101',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    // 4 batiments dans la fixture, mais 1 fait 320 m2 -> filtre cote client
    expect(batiments).toHaveLength(3)
    expect(fakeFetch).toHaveBeenCalledOnce()
  })

  it('pagine via offset quand la page est pleine', async () => {
    // Simule 2 pages de taille 2
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => batimentsArray.slice(0, 2), // page pleine (2 = pageSize)
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => batimentsArray.slice(2), // page partielle (2 < pageSize) -> fin
      } as Response)

    const batiments = await fetchBatiments({
      codeInsee: '75101',
      fetchImpl: fakeFetch as unknown as typeof fetch,
      pageSize: 2,
    })
    // 4 batiments - 1 sous le seuil = 3
    expect(batiments).toHaveLength(3)
    expect(fakeFetch).toHaveBeenCalledTimes(2)
  })

  it('respecte maxPages pour eviter une boucle infinie', async () => {
    // Simule des pages toujours pleines (pageSize = 1)
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => [batimentsArray[0]], // 1 resultat = pageSize -> continue
    } as Response)

    await fetchBatiments({
      codeInsee: '75101',
      fetchImpl: fakeFetch as unknown as typeof fetch,
      pageSize: 1,
      maxPages: 3,
    })
    // 3 pages + 1 derniere verif (page 4 retourne aussi 1 = pageSize)
    // maxPages=3 -> stoppe apres 3 iterations de la boucle
    expect(fakeFetch).toHaveBeenCalledTimes(3)
  })

  it('supporte le format ancien {results: [...]} en retro-compat', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => fixture, // ancien format avec results/next
    } as Response)

    const batiments = await fetchBatiments({
      codeInsee: '75101',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(batiments).toHaveLength(3) // 4 - 1 sous seuil
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
// parseGeoJsonCentroid
// =============================================

describe('parseGeoJsonCentroid', () => {
  it('calcule le centroide d un Polygon GeoJSON', () => {
    const geom = {
      type: 'Polygon',
      coordinates: [[[2.0, 48.0], [2.1, 48.0], [2.1, 48.1], [2.0, 48.1], [2.0, 48.0]]],
    }
    const result = parseGeoJsonCentroid(geom)
    expect(result).not.toBeNull()
    expect(result!.lng).toBeCloseTo(2.05, 2)
    expect(result!.lat).toBeCloseTo(48.05, 2)
  })

  it('calcule le centroide d un MultiPolygon GeoJSON', () => {
    const geom = {
      type: 'MultiPolygon',
      coordinates: [[[[2.0, 48.0], [2.1, 48.0], [2.1, 48.1], [2.0, 48.1], [2.0, 48.0]]]],
    }
    const result = parseGeoJsonCentroid(geom)
    expect(result).not.toBeNull()
    expect(result!.lng).toBeCloseTo(2.05, 2)
  })

  it('retourne null si undefined', () => {
    expect(parseGeoJsonCentroid(undefined)).toBeNull()
  })

  it('parse une string GeoJSON', () => {
    const geomStr = JSON.stringify({
      type: 'Polygon',
      coordinates: [[[2.35, 48.85], [2.36, 48.85], [2.36, 48.86], [2.35, 48.86], [2.35, 48.85]]],
    })
    const result = parseGeoJsonCentroid(geomStr)
    expect(result).not.toBeNull()
    expect(result!.lat).toBeCloseTo(48.855, 2)
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
