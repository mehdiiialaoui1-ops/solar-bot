/**
 * Tests unitaires - Orchestrateur outreach (Claude → Lemlist)
 * ERE SOLAR BOT - Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runOutreach } from '../../src/outreach/cascade'
import type {
  AnthropicResponse,
  PromptVariables,
} from '../../src/outreach/types'

const claudeFixture: AnthropicResponse = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/claude-email-sample.json'), 'utf8'),
)

const promptTpl = readFileSync(
  resolve(__dirname, '../../../02_prompts/v1_email_copy.txt'),
  'utf8',
)

const VARS_TEST: PromptVariables = {
  prenom: 'Marie',
  nom: 'Lefebvre',
  raison_sociale: 'ACME LOGISTIQUE SAS',
  adresse: '12 rue de Rivoli',
  code_postal: '69100',
  commune: 'Vénissieux',
  surface_m2: 2150,
  puissance_kwc: 99.2,
  production_annuelle_kwh: 88560,
  economie_annuelle_eur: 13284,
  obligations_list: 'loi APER, décret tertiaire',
  microsite_url: 'https://solar.ere-experts.fr/m/lefebvre-acme',
}

const FAKE_ANT = 'sk-ant-api03-test-key-1234567890ABCD'
const FAKE_LEM = 'lem_api_test_key_1234567890ABCDEF'

describe('runOutreach', () => {
  it('cascade Claude OK → Lemlist OK → statut sent', async () => {
    const fakeFetch = vi
      .fn()
      // 1. Claude
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => claudeFixture,
      } as Response)
      // 2. Lemlist add lead
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ _id: 'lead_abc', email: 'marie@acme.fr' }),
      } as Response)

    const result = await runOutreach({
      prospectId: 'prospect-1',
      contactId: 'contact-1',
      variables: VARS_TEST,
      campagneLemlistId: 'cmp_pilote_lyon',
      destinataireEmail: 'marie.lefebvre@acme-logistique.fr',
      promptTemplate: promptTpl,
      anthropicApiKey: FAKE_ANT,
      lemlistApiKey: FAKE_LEM,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })

    expect(result.statut).toBe('sent')
    expect(result.lemlistLeadId).toBe('lead_abc')
    expect(result.email.objet).toContain('Solarisation toiture')
    expect(result.email.motsCount).toBeLessThanOrEqual(150)
  })

  it("renvoie statut='duplicate' si Lemlist 409", async () => {
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => claudeFixture,
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
      } as Response)

    const result = await runOutreach({
      prospectId: 'prospect-2',
      contactId: 'contact-2',
      variables: VARS_TEST,
      campagneLemlistId: 'cmp_pilote_lyon',
      destinataireEmail: 'doublon@acme.fr',
      promptTemplate: promptTpl,
      anthropicApiKey: FAKE_ANT,
      lemlistApiKey: FAKE_LEM,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result.statut).toBe('duplicate')
    expect(result.lemlistLeadId).toBeNull()
  })

  it("renvoie statut='failed' si Claude depasse 150 mots", async () => {
    const longText = 'Objet : Test\n\n' + 'mot '.repeat(200)
    const fakeFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          ...claudeFixture,
          content: [{ type: 'text', text: longText }],
        }),
      } as Response)

    const result = await runOutreach({
      prospectId: 'prospect-3',
      contactId: 'contact-3',
      variables: VARS_TEST,
      campagneLemlistId: 'cmp_pilote_lyon',
      destinataireEmail: 'a@b.fr',
      promptTemplate: promptTpl,
      anthropicApiKey: FAKE_ANT,
      lemlistApiKey: FAKE_LEM,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result.statut).toBe('failed')
    expect(result.lemlistLeadId).toBeNull()
  })
})
