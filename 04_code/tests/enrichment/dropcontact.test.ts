/**
 * Tests unitaires - Client Dropcontact + filtrage emails
 * ERE SOLAR BOT - Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  enrichBatch,
  estEmailPerso,
  selectionnerEmailPro,
  dirigeantVersInputDropcontact,
  BATCH_SIZE_MAX,
} from '../../src/enrichment/dropcontact'
import { EnrichmentError } from '../../src/enrichment/types'
import type { DropcontactBatchResponse, Dirigeant } from '../../src/enrichment/types'

const fixture: DropcontactBatchResponse = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/dropcontact-sample.json'), 'utf8'),
)

const FAKE_TOKEN = 'dropcontact_token_xyz_1234567890'

// =============================================
// estEmailPerso
// =============================================

describe('estEmailPerso', () => {
  it.each([
    ['jean@gmail.com', true],
    ['jean@hotmail.fr', true],
    ['jean@yahoo.com', true],
    ['jean@orange.fr', true],
    ['jean@free.fr', true],
    ['jean@acme.fr', false],
    ['jean@solar-bot.fr', false],
    ['notanemail', true],
  ] as const)('"%s" → perso=%s', (email, attendu) => {
    expect(estEmailPerso(email)).toBe(attendu)
  })
})

// =============================================
// selectionnerEmailPro
// =============================================

describe('selectionnerEmailPro', () => {
  it('garde le premier email valid + non perso', () => {
    const choix = selectionnerEmailPro(fixture.data[0])
    expect(choix).not.toBeNull()
    expect(choix!.email).toBe('marie.lefebvre@acme-logistique.fr')
    expect(choix!.verifie).toBe(true)
  })

  it('rejette gmail/hotmail même si valid, fallback risky pro', () => {
    const choix = selectionnerEmailPro(fixture.data[1])
    expect(choix).not.toBeNull()
    expect(choix!.email).toBe('jp.dupont@acme-logistique.fr') // risky mais pro
    expect(choix!.verifie).toBe(false)
  })

  it('renvoie null si aucun email exploitable', () => {
    expect(selectionnerEmailPro(fixture.data[2])).toBeNull()
  })
})

// =============================================
// enrichBatch
// =============================================

describe('enrichBatch', () => {
  it('renvoie le tableau data sur 200 OK', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => fixture,
    } as Response)
    const out = await enrichBatch({
      apiToken: FAKE_TOKEN,
      contacts: [{ first_name: 'Marie', last_name: 'Lefebvre' }],
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(out).toHaveLength(3)
  })

  it('renvoie [] si contacts vide (sans appel API)', async () => {
    const fakeFetch = vi.fn()
    const out = await enrichBatch({
      apiToken: FAKE_TOKEN,
      contacts: [],
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(out).toHaveLength(0)
    expect(fakeFetch).not.toHaveBeenCalled()
  })

  it('refuse un batch > 25 contacts', async () => {
    const big = Array.from({ length: BATCH_SIZE_MAX + 1 }, (_, i) => ({
      first_name: 'P' + i,
      last_name: 'N' + i,
    }))
    await expect(
      enrichBatch({ apiToken: FAKE_TOKEN, contacts: big }),
    ).rejects.toBeInstanceOf(EnrichmentError)
  })

  it('lève RATE_LIMITED sur 429', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many',
    } as Response)
    await expect(
      enrichBatch({
        apiToken: FAKE_TOKEN,
        contacts: [{ first_name: 'A', last_name: 'B' }],
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/rate limit/)
  })
})

// =============================================
// dirigeantVersInputDropcontact
// =============================================

describe('dirigeantVersInputDropcontact', () => {
  it('mappe Dirigeant → input Dropcontact', () => {
    const d: Dirigeant = {
      prenom: 'Marie',
      nom: 'Lefebvre',
      titre: 'Présidente',
      rang_ciblage: 1,
      source_enrichment: 'pappers_representant',
    }
    const input = dirigeantVersInputDropcontact(d, 'ACME LOGISTIQUE SAS', '552032534')
    expect(input.first_name).toBe('Marie')
    expect(input.last_name).toBe('Lefebvre')
    expect(input.company).toBe('ACME LOGISTIQUE SAS')
    expect(input.siren).toBe('552032534')
  })
})
