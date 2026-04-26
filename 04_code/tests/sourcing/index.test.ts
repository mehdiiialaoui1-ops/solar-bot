/**
 * Tests unitaires - Orchestrateur sourcing (dedup + flux)
 * ERE SOLAR BOT - Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { dedupCandidats, sourceProspects } from '../../src/sourcing'
import type { ProspectCandidat } from '../../src/sourcing/types'

const bdnbFixture = JSON.parse(
  readFileSync(
    resolve(__dirname, '../fixtures/bdnb-batiment-sample.json'),
    'utf8',
  ),
)

const ignFixture = JSON.parse(
  readFileSync(
    resolve(__dirname, '../fixtures/ign-parcelle-sample.json'),
    'utf8',
  ),
)

// =============================================
// dedupCandidats
// =============================================

describe('dedupCandidats', () => {
  const base: ProspectCandidat = {
    adresse: '12 rue de Rivoli',
    code_postal: '75001',
    commune: 'Paris',
    code_insee: '75101',
    lat: 48.8566,
    lng: 2.3522,
    surface_m2: 1500,
    usage: 'tertiaire',
    nb_etages: 4,
    annee_construction: 1990,
    siret_proprietaire: '12345678900001',
    parcelle_id: 'A1',
    source: 'bdnb',
  }

  it('dedup par siret identique', () => {
    const list = [base, { ...base, adresse: 'autre adresse', parcelle_id: 'A2' }]
    expect(dedupCandidats(list)).toHaveLength(1)
  })

  it("dedup par adresse normalisee quand siret absent", () => {
    const list: ProspectCandidat[] = [
      { ...base, siret_proprietaire: null },
      { ...base, siret_proprietaire: null, adresse: '12   Rue de Rivoli  ' },
    ]
    expect(dedupCandidats(list)).toHaveLength(1)
  })

  it('garde les candidats avec siret different', () => {
    const list = [
      base,
      { ...base, siret_proprietaire: '99999999900099', parcelle_id: 'B1' },
    ]
    expect(dedupCandidats(list)).toHaveLength(2)
  })
})

// =============================================
// sourceProspects (mock BDNB seul)
// =============================================

describe('sourceProspects', () => {
  it('renvoie les candidats BDNB exploitables et leur stats', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => bdnbFixture,
    } as Response)

    const result = await sourceProspects({
      codeInsee: '75101',
      commune: 'Paris',
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })

    // Fixture BDNB : 4 batiments dont 1 sous le seuil (320m2)
    // -> 3 exploitables, tous avec siret distinct -> 3 candidats finaux
    expect(result.stats.bdnbBatimentsRecus).toBe(4)
    expect(result.stats.bdnbCandidatsExploitables).toBe(3)
    expect(result.stats.candidatsApresDedup).toBe(3)
    expect(result.candidats).toHaveLength(3)
  })

  it("inclut les parcelles IGN quand inclureParcellesIgn=true", async () => {
    const fakeFetch = vi
      .fn()
      // 1er appel = BDNB (orchestrateur appelle BDNB en premier)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => bdnbFixture,
      } as Response)
      // 2eme appel = IGN
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ignFixture,
      } as Response)

    const result = await sourceProspects({
      codeInsee: '75101',
      commune: 'Paris',
      inclureParcellesIgn: true,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })

    expect(result.stats.ignParcellesRecues).toBe(3)
    // Fixture IGN : 1250 / 320 / 5400 -> 2 eligibles >= 500
    expect(result.stats.ignParcellesEligibles).toBe(2)
    expect(result.candidats.length).toBeGreaterThanOrEqual(3)
  })
})
