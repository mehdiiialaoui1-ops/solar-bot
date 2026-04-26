/**
 * Tests unitaires - Génération email via Claude API
 * ERE SOLAR BOT - Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  substituerVariables,
  parserEmail,
  compterMots,
  appelerClaudeApi,
  genererEmail,
  VARIABLES_REQUISES,
} from '../../src/outreach/claude-email'
import { OutreachError } from '../../src/outreach/types'
import type { PromptVariables, AnthropicResponse } from '../../src/outreach/types'

const fixture: AnthropicResponse = JSON.parse(
  readFileSync(resolve(__dirname, '../fixtures/claude-email-sample.json'), 'utf8'),
)

const FAKE_KEY = 'sk-ant-api03-test-key-1234567890ABCD'

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
  obligations_list: 'loi APER, décret tertiaire palier 2030',
  microsite_url: 'https://solar.ere-experts.fr/m/lefebvre-acme',
}

// =============================================
// substituerVariables
// =============================================

describe('substituerVariables', () => {
  it('substitue toutes les variables connues', () => {
    const tpl = 'Bonjour {prenom} {nom}, votre toiture de {surface_m2} m² peut produire {puissance_kwc} kWc.'
    const out = substituerVariables(tpl, VARS_TEST)
    expect(out).toContain('Bonjour Marie Lefebvre')
    expect(out).toContain('2150 m²')
    expect(out).toContain('99.2 kWc')
  })

  it("lève PROMPT_TEMPLATE_INVALID si placeholder inconnu reste", () => {
    const tpl = 'Bonjour {prenom}, voici votre {placeholder_inconnu}.'
    expect(() => substituerVariables(tpl, VARS_TEST)).toThrow(OutreachError)
  })

  it("liste 12 variables requises", () => {
    expect(VARIABLES_REQUISES).toHaveLength(12)
  })
})

// =============================================
// compterMots
// =============================================

describe('compterMots', () => {
  it.each([
    ['Bonjour le monde', 3],
    ['  Marie   Lefebvre  ', 2],
    ['', 0],
    ['un', 1],
    ['Une phrase de cinq mots.', 5],
  ] as const)('"%s" → %i mots', (texte, attendu) => {
    expect(compterMots(texte)).toBe(attendu)
  })
})

// =============================================
// parserEmail
// =============================================

describe('parserEmail', () => {
  it("extrait l'objet et le corps depuis la sortie Claude", () => {
    const text = fixture.content[0].text
    const email = parserEmail(text)
    expect(email.objet).toContain('Solarisation toiture Vénissieux')
    expect(email.corps).toContain('Marie,')
    expect(email.corps).toContain('Youssef')
    expect(email.motsCount).toBeGreaterThan(50)
    expect(email.motsCount).toBeLessThan(150)
  })

  it("supporte les variantes 'Subject:' / 'Sujet:'", () => {
    const e1 = parserEmail('Subject: Test\n\nCorps ici')
    expect(e1.objet).toBe('Test')
    expect(e1.corps).toBe('Corps ici')

    const e2 = parserEmail('Sujet : Mon objet\n\nLe corps')
    expect(e2.objet).toBe('Mon objet')
    expect(e2.corps).toBe('Le corps')
  })

  it("fallback : prend la 1re ligne courte comme objet", () => {
    const text = 'Court titre\n\nUn corps avec plusieurs phrases.'
    const email = parserEmail(text)
    expect(email.objet).toBe('Court titre')
  })
})

// =============================================
// appelerClaudeApi
// =============================================

describe('appelerClaudeApi', () => {
  const promptTpl = 'Hello {prenom}, you have {surface_m2}m² and {puissance_kwc} kWc.'

  it('renvoie le texte du content[0] sur 200 OK', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => fixture,
    } as Response)
    const text = await appelerClaudeApi({
      promptTemplate: promptTpl,
      variables: VARS_TEST,
      apiKey: FAKE_KEY,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(text).toContain('Solarisation toiture')
  })

  it('lève CLAUDE_OVER_LIMIT sur 429', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many',
    } as Response)
    await expect(
      appelerClaudeApi({
        promptTemplate: promptTpl,
        variables: VARS_TEST,
        apiKey: FAKE_KEY,
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/rate limit/)
  })

  it("lève CLAUDE_REFUSED si stop_reason='refusal'", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        ...fixture,
        stop_reason: 'refusal',
      }),
    } as Response)
    await expect(
      appelerClaudeApi({
        promptTemplate: promptTpl,
        variables: VARS_TEST,
        apiKey: FAKE_KEY,
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/refus/i)
  })

  it("lève INVALID_INPUT si clé API trop courte", async () => {
    await expect(
      appelerClaudeApi({
        promptTemplate: promptTpl,
        variables: VARS_TEST,
        apiKey: 'short',
      }),
    ).rejects.toThrow(/Cl/)
  })
})

// =============================================
// genererEmail (intégration)
// =============================================

describe('genererEmail', () => {
  const promptTpl = readFileSync(
    resolve(__dirname, '../../../02_prompts/v1_email_copy.txt'),
    'utf8',
  )

  it('renvoie EmailGenere conforme', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => fixture,
    } as Response)

    const email = await genererEmail({
      promptTemplate: promptTpl,
      variables: VARS_TEST,
      apiKey: FAKE_KEY,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(email.objet).toBeTruthy()
    expect(email.corps).toBeTruthy()
    expect(email.motsCount).toBeGreaterThan(0)
    expect(email.motsCount).toBeLessThanOrEqual(150)
  })

  it("lève si le corps depasse 150 mots", async () => {
    // Génère un texte > 150 mots
    const longText = 'Objet : Test\n\n' + 'mot '.repeat(200)
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        ...fixture,
        content: [{ type: 'text', text: longText }],
      }),
    } as Response)

    await expect(
      genererEmail({
        promptTemplate: promptTpl,
        variables: VARS_TEST,
        apiKey: FAKE_KEY,
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/trop long/i)
  })
})
