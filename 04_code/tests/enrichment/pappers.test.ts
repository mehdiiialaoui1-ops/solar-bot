/**
 * Tests unitaires - Client Pappers + extraction dirigeants
 * ERE SOLAR BOT - Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildPappersUrl,
  fetchEntreprise,
  qualiteVersRang,
  extraireDirigeants,
  PAPPERS_ENDPOINT,
} from '../../src/enrichment/pappers'
import { EnrichmentError } from '../../src/enrichment/types'
import type { PappersEntreprise } from '../../src/enrichment/types'

const fixture: PappersEntreprise = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/pappers-sample.json'), 'utf8'),
)

const FAKE_TOKEN = 'pappers_test_token_1234567890'

// =============================================
// buildPappersUrl
// =============================================

describe('buildPappersUrl', () => {
  it("construit l'URL avec siren et token", () => {
    const url = buildPappersUrl({ siren: '552032534', apiToken: FAKE_TOKEN })
    expect(url).toContain(PAPPERS_ENDPOINT)
    expect(url).toContain('siren=552032534')
    expect(url).toContain(`api_token=${FAKE_TOKEN}`)
  })

  it('rejette un siren invalide (pas 9 chiffres)', () => {
    expect(() => buildPappersUrl({ siren: '12345', apiToken: FAKE_TOKEN })).toThrow(EnrichmentError)
    expect(() => buildPappersUrl({ siren: 'ABCDEFGHI', apiToken: FAKE_TOKEN })).toThrow(EnrichmentError)
  })

  it('rejette un token absent ou trop court', () => {
    expect(() => buildPappersUrl({ siren: '552032534', apiToken: '' })).toThrow(EnrichmentError)
    expect(() => buildPappersUrl({ siren: '552032534', apiToken: 'abc' })).toThrow(EnrichmentError)
  })
})

// =============================================
// fetchEntreprise
// =============================================

describe('fetchEntreprise', () => {
  it('renvoie le JSON quand 200 OK', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => fixture,
    } as Response)

    const ent = await fetchEntreprise({
      siren: '552032534',
      apiToken: FAKE_TOKEN,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(ent.siren).toBe('552032534')
    expect(ent.representants).toHaveLength(4)
  })

  it('lève SIREN_NOT_FOUND sur HTTP 404', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({}),
    } as Response)
    await expect(
      fetchEntreprise({
        siren: '999999999',
        apiToken: FAKE_TOKEN,
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/introuvable/)
  })

  it('lève RATE_LIMITED sur HTTP 429', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many',
      json: async () => ({}),
    } as Response)
    await expect(
      fetchEntreprise({
        siren: '552032534',
        apiToken: FAKE_TOKEN,
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/rate limit/)
  })

  it('lève PARSE_ERROR si siren manquant', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ foo: 'bar' }),
    } as Response)
    await expect(
      fetchEntreprise({
        siren: '552032534',
        apiToken: FAKE_TOKEN,
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/siren manquant/)
  })
})

// =============================================
// qualiteVersRang
// =============================================

describe('qualiteVersRang', () => {
  it.each([
    ['Présidente', 1],
    ['Président', 1],
    ['Gérant', 1],
    ['gerant', 1],
    ['Directeur Général', 2],
    ['Directeur general', 2],
    ['DG', 2],
    ['Directeur Administratif et Financier', 3],
    ['DAF', 3],
    ['Directeur Immobilier', 4],
    ['Responsable Patrimoine', 4],
    ['Directeur RSE', 5],
    ['Directeur développement durable', 5],
    ['Délégué', 6],
    ['', 6],
    [undefined, 6],
  ] as const)('mappe "%s" → rang %i', (qualite, rangAttendu) => {
    expect(qualiteVersRang(qualite as string | undefined)).toBe(rangAttendu)
  })
})

// =============================================
// extraireDirigeants
// =============================================

describe('extraireDirigeants', () => {
  it('extrait les 3 dirigeants actifs triés par rang', () => {
    const dirigeants = extraireDirigeants(fixture, 3)
    expect(dirigeants).toHaveLength(3)
    expect(dirigeants[0].rang_ciblage).toBe(1) // Présidente
    expect(dirigeants[0].nom).toBe('Lefebvre')
    expect(dirigeants[1].rang_ciblage).toBe(2) // DG
    expect(dirigeants[2].rang_ciblage).toBe(3) // DAF
  })

  it('exclut les représentants avec date_fin_poste', () => {
    const dirigeants = extraireDirigeants(fixture, 10)
    const noms = dirigeants.map((d) => d.nom)
    expect(noms).not.toContain('Ancien') // Robert Ancien a une date_fin_poste
  })

  it('respecte le topN', () => {
    expect(extraireDirigeants(fixture, 1)).toHaveLength(1)
    expect(extraireDirigeants(fixture, 2)).toHaveLength(2)
  })

  it('fallback sur bénéficiaire effectif si aucun représentant actif', () => {
    const fauxFixture: PappersEntreprise = {
      siren: '111222333',
      representants: [],
      beneficiaires_effectifs: [{ nom: 'Solo', prenom: 'Han', pourcentage_parts: 100 }],
    }
    const dirigeants = extraireDirigeants(fauxFixture)
    expect(dirigeants).toHaveLength(1)
    expect(dirigeants[0].source_enrichment).toBe('pappers_beneficiaire')
    expect(dirigeants[0].rang_ciblage).toBe(1)
  })

  it('renvoie [] si aucun représentant et aucun bénéficiaire', () => {
    expect(extraireDirigeants({ siren: '000', representants: [] })).toHaveLength(0)
  })
})
