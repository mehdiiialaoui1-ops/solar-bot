/**
 * Tests unitaires - Client API Cadastre IGN
 * ERE SOLAR BOT - Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildIgnUrl,
  fetchParcelles,
  filtrerParcellesParSurface,
  centroideParcelle,
  IGN_CADASTRE_ENDPOINT,
} from '../../src/sourcing/cadastre-ign'
import { SourcingError } from '../../src/sourcing/types'
import type { IgnParcelleCollection } from '../../src/sourcing/types'

const fixture: IgnParcelleCollection = JSON.parse(
  readFileSync(
    resolve(__dirname, '../fixtures/ign-parcelle-sample.json'),
    'utf8',
  ),
)

// =============================================
// buildIgnUrl
// =============================================

describe('buildIgnUrl', () => {
  it("construit l'URL avec code_insee uniquement", () => {
    const url = buildIgnUrl({ codeInsee: '75101' })
    expect(url).toContain(IGN_CADASTRE_ENDPOINT)
    expect(url).toContain('code_insee=75101')
  })

  it('ajoute section et numero quand fournis', () => {
    const url = buildIgnUrl({ codeInsee: '75101', section: 'AB', numero: '0001' })
    expect(url).toContain('section=AB')
    expect(url).toContain('numero=0001')
  })

  it('rejette un code INSEE invalide', () => {
    expect(() => buildIgnUrl({ codeInsee: 'XYZ' })).toThrow(SourcingError)
    expect(() => buildIgnUrl({ codeInsee: '75' })).toThrow(SourcingError)
    expect(() => buildIgnUrl({ codeInsee: '751010' })).toThrow(SourcingError)
  })
})

// =============================================
// fetchParcelles - succes
// =============================================

describe('fetchParcelles', () => {
  it('renvoie la FeatureCollection IGN sur 200 OK', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => fixture,
    } as Response)

    const result = await fetchParcelles({
      codeInsee: '75101',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result.type).toBe('FeatureCollection')
    expect(result.features).toHaveLength(3)
    expect(fakeFetch).toHaveBeenCalledOnce()
  })

  it('lève SourcingError sur HTTP 500', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => ({}),
    } as Response)
    await expect(
      fetchParcelles({
        codeInsee: '75101',
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(SourcingError)
  })

  it('lève SourcingError sur reponse non-FeatureCollection', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ foo: 'bar' }),
    } as Response)
    await expect(
      fetchParcelles({
        codeInsee: '75101',
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/FeatureCollection/)
  })

  it('lève SourcingError sur JSON invalide', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => {
        throw new Error('bad json')
      },
    } as unknown as Response)
    await expect(
      fetchParcelles({
        codeInsee: '75101',
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/JSON parse/)
  })
})

// =============================================
// filtrerParcellesParSurface
// =============================================

describe('filtrerParcellesParSurface', () => {
  it('garde les parcelles >= 500 m2 par defaut', () => {
    const filtered = filtrerParcellesParSurface(fixture.features)
    // Fixture : 1250 / 320 / 5400 -> 2 retenues (1250 et 5400)
    expect(filtered).toHaveLength(2)
    expect(filtered.map((f) => f.properties.contenance)).toEqual([1250, 5400])
  })

  it('respecte une surface minimale custom', () => {
    const filtered = filtrerParcellesParSurface(fixture.features, 1000)
    expect(filtered).toHaveLength(2) // 1250 et 5400
  })

  it('rejette les parcelles sans contenance', () => {
    const sans = [
      {
        type: 'Feature' as const,
        geometry: { type: 'Polygon' as const, coordinates: [[]] },
        properties: { id: 'X' },
      },
    ]
    expect(filtrerParcellesParSurface(sans)).toHaveLength(0)
  })
})

// =============================================
// centroideParcelle
// =============================================

describe('centroideParcelle', () => {
  it('calcule un centroide raisonnable pour un Polygon', () => {
    const c = centroideParcelle(fixture.features[0])
    expect(c).not.toBeNull()
    expect(c!.lat).toBeGreaterThan(48.85)
    expect(c!.lat).toBeLessThan(48.86)
    expect(c!.lng).toBeGreaterThan(2.35)
    expect(c!.lng).toBeLessThan(2.36)
  })

  it('retourne null sur geometrie absente', () => {
    const f = {
      type: 'Feature' as const,
      // @ts-expect-error - geometrie volontairement absente
      geometry: null,
      properties: { id: 'X' },
    }
    expect(centroideParcelle(f)).toBeNull()
  })
})
