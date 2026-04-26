/**
 * Tests unitaires - Orchestrateur cascade enrichissement
 * ERE SOLAR BOT - Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { enrichProspect, selectionnerContactActif } from '../../src/enrichment/cascade'
import type { ContactEnrichi } from '../../src/enrichment/types'

const pappersFixture = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/pappers-sample.json'), 'utf8'),
)
const dropFixture = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/dropcontact-sample.json'), 'utf8'),
)

const FAKE_PAPPERS = 'pappers_token_test_1234567890'
const FAKE_DROPC = 'dropcontact_token_test_1234567890'

// =============================================
// selectionnerContactActif
// =============================================

describe('selectionnerContactActif', () => {
  const base: ContactEnrichi = {
    prospect_id: 'p-1',
    prenom: 'Marie',
    nom: 'Lefebvre',
    titre: 'Présidente',
    rang_ciblage: 1,
    source_enrichment: 'pappers_representant',
    email_pro: null,
    telephone_pro: null,
    linkedin_url: null,
    email_verifie: false,
    source_email: null,
    actif: false,
  }

  it('renvoie null si liste vide', () => {
    expect(selectionnerContactActif([])).toBeNull()
  })

  it('priorise un email vérifié sur un email non vérifié', () => {
    const c1 = { ...base, rang_ciblage: 2 as const, email_pro: 'jean@a.fr', email_verifie: true }
    const c2 = { ...base, rang_ciblage: 1 as const, email_pro: 'marie@a.fr', email_verifie: false }
    const actif = selectionnerContactActif([c1, c2])
    expect(actif?.email_pro).toBe('jean@a.fr')
  })

  it('parmi emails vérifiés, prend le rang le plus bas', () => {
    const c1 = { ...base, rang_ciblage: 1 as const, email_pro: 'a@a.fr', email_verifie: true }
    const c2 = { ...base, rang_ciblage: 2 as const, email_pro: 'b@a.fr', email_verifie: true }
    expect(selectionnerContactActif([c2, c1])?.rang_ciblage).toBe(1)
  })

  it('renvoie null si aucun contact n a d email', () => {
    expect(selectionnerContactActif([base])).toBeNull()
  })
})

// =============================================
// enrichProspect (intégration mocked)
// =============================================

describe('enrichProspect', () => {
  it('cascade Pappers + Dropcontact + selection actif', async () => {
    const fakeFetch = vi
      .fn()
      // 1er appel = Pappers (GET)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => pappersFixture,
      } as Response)
      // 2ème appel = Dropcontact (POST)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => dropFixture,
      } as Response)

    const resolver = {
      resolveMx: vi.fn().mockResolvedValue([{ exchange: 'mx.acme.fr', priority: 10 }]),
    }

    const result = await enrichProspect({
      prospectId: 'prospect-test-1',
      siren: '552032534',
      raisonSociale: 'ACME LOGISTIQUE SAS',
      pappersToken: FAKE_PAPPERS,
      dropcontactToken: FAKE_DROPC,
      mxResolver: resolver,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })

    expect(result.prospect_id).toBe('prospect-test-1')
    expect(result.contacts).toHaveLength(3)
    expect(result.statut).toBe('enriched')
    // Marie Lefebvre = rang 1, email valid pro → contact actif attendu
    expect(result.contact_actif?.nom).toBe('Lefebvre')
    expect(result.contact_actif?.email_pro).toBe('marie.lefebvre@acme-logistique.fr')
    expect(result.contact_actif?.email_verifie).toBe(true)
    expect(result.contact_actif?.actif).toBe(true)
  })

  it('renvoie enrichment_failed si SIREN 404', async () => {
    const fakeFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({}),
    } as Response)

    const result = await enrichProspect({
      prospectId: 'p-2',
      siren: '999999999',
      raisonSociale: 'INCONNU',
      pappersToken: FAKE_PAPPERS,
      dropcontactToken: FAKE_DROPC,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result.statut).toBe('enrichment_failed')
    expect(result.contacts).toHaveLength(0)
    expect(result.contact_actif).toBeNull()
  })

  it('fallback pattern si Dropcontact ne renvoie aucun email', async () => {
    const dropVide = { request_id: 'r', data: [{ first_name: 'Marie', last_name: 'Lefebvre', email: [] }] }
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ ...pappersFixture, representants: pappersFixture.representants.slice(0, 1) }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => dropVide,
      } as Response)

    const resolver = {
      resolveMx: vi.fn().mockResolvedValue([{ exchange: 'mx.acme.fr', priority: 10 }]),
    }

    const result = await enrichProspect({
      prospectId: 'p-3',
      siren: '552032534',
      raisonSociale: 'ACME',
      pappersToken: FAKE_PAPPERS,
      dropcontactToken: FAKE_DROPC,
      mxResolver: resolver,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })

    expect(result.contacts).toHaveLength(1)
    expect(result.contacts[0].source_email).toBe('pattern')
    expect(result.contacts[0].email_pro).toBe('marie.lefebvre@acme-logistique.fr')
    expect(result.contacts[0].email_verifie).toBe(false)
  })
})
