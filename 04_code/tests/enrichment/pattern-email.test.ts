/**
 * Tests unitaires - Génération email par pattern + MX check
 * ERE SOLAR BOT - Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import {
  normaliser,
  genererEmail,
  genererTousPatterns,
  extraireDomaineDepuisUrl,
  aMxRecord,
  tenterPatterns,
  EMAIL_PATTERNS,
} from '../../src/enrichment/pattern-email'

// =============================================
// normaliser
// =============================================

describe('normaliser', () => {
  it.each([
    ['Jean', 'jean'],
    ['Marie-Hélène', 'mariehelene'],
    ["O'Connor", 'oconnor'],
    ['Élise', 'elise'],
    ['François', 'francois'],
    ['Renée', 'renee'],
    ['  Jean  Pierre ', 'jeanpierre'],
  ] as const)('"%s" → "%s"', (input, attendu) => {
    expect(normaliser(input)).toBe(attendu)
  })
})

// =============================================
// genererEmail
// =============================================

describe('genererEmail', () => {
  it('genere un email simple', () => {
    expect(genererEmail('{prenom}.{nom}@{domaine}', 'Marie', 'Lefebvre', 'acme.fr')).toBe(
      'marie.lefebvre@acme.fr',
    )
  })

  it("supporte l'initiale {p}", () => {
    expect(genererEmail('{p}.{nom}@{domaine}', 'Jean-Pierre', 'Dupont', 'solar-bot.fr')).toBe(
      'j.dupont@solar-bot.fr',
    )
  })

  it('rejette quand le domaine manque', () => {
    expect(genererEmail('{prenom}.{nom}@{domaine}', 'Jean', 'Dupont', '')).toBeNull()
  })

  it('rejette quand le nom manque', () => {
    expect(genererEmail('{prenom}.{nom}@{domaine}', 'Jean', '', 'acme.fr')).toBeNull()
  })
})

// =============================================
// genererTousPatterns
// =============================================

describe('genererTousPatterns', () => {
  it('genere les 6 patterns sans doublon', () => {
    const out = genererTousPatterns('Marie', 'Lefebvre', 'acme.fr')
    expect(out.length).toBeGreaterThanOrEqual(5)
    expect(out).toContain('marie.lefebvre@acme.fr')
    expect(out).toContain('m.lefebvre@acme.fr')
    expect(out).toContain('marielefebvre@acme.fr')
    expect(out).toContain('lefebvre.marie@acme.fr')
  })

  it('respecte le nombre max de patterns', () => {
    const out = genererTousPatterns('Jean', 'Dupont', 'a.fr')
    expect(out.length).toBeLessThanOrEqual(EMAIL_PATTERNS.length)
  })
})

// =============================================
// extraireDomaineDepuisUrl
// =============================================

describe('extraireDomaineDepuisUrl', () => {
  it.each([
    ['https://www.acme.fr', 'acme.fr'],
    ['http://acme.fr/', 'acme.fr'],
    ['acme.fr', 'acme.fr'],
    ['https://www.acme-logistique.fr/contact', 'acme-logistique.fr'],
    [undefined, null],
    ['', null],
    ['pas une url', null],
  ] as const)('"%s" → "%s"', (url, attendu) => {
    expect(extraireDomaineDepuisUrl(url as string | undefined)).toBe(attendu)
  })
})

// =============================================
// aMxRecord (avec resolver mocké)
// =============================================

describe('aMxRecord', () => {
  it('renvoie true si le resolver trouve un MX', async () => {
    const resolver = {
      resolveMx: vi.fn().mockResolvedValue([{ exchange: 'mail.acme.fr', priority: 10 }]),
    }
    expect(await aMxRecord('acme.fr', resolver)).toBe(true)
  })

  it('renvoie false si le resolver renvoie []', async () => {
    const resolver = { resolveMx: vi.fn().mockResolvedValue([]) }
    expect(await aMxRecord('acme.fr', resolver)).toBe(false)
  })

  it('renvoie false si le resolver throw', async () => {
    const resolver = { resolveMx: vi.fn().mockRejectedValue(new Error('NXDOMAIN')) }
    expect(await aMxRecord('introuvable.invalid', resolver)).toBe(false)
  })

  it('refuse un domaine avec caractères invalides', async () => {
    const resolver = { resolveMx: vi.fn() }
    expect(await aMxRecord('mauvais domaine!', resolver)).toBe(false)
    expect(resolver.resolveMx).not.toHaveBeenCalled()
  })
})

// =============================================
// tenterPatterns (intégration)
// =============================================

describe('tenterPatterns', () => {
  it('renvoie le 1er candidat si MX OK', async () => {
    const resolver = {
      resolveMx: vi.fn().mockResolvedValue([{ exchange: 'mx.acme.fr', priority: 10 }]),
    }
    const out = await tenterPatterns({
      prenom: 'Marie',
      nom: 'Lefebvre',
      domaine: 'acme.fr',
      resolver,
    })
    expect(out.email).toBe('marie.lefebvre@acme.fr')
    expect(out.domaineValide).toBe(true)
    expect(out.candidats.length).toBeGreaterThan(0)
  })

  it("renvoie email=null si pas de MX", async () => {
    const resolver = { resolveMx: vi.fn().mockResolvedValue([]) }
    const out = await tenterPatterns({
      prenom: 'Marie',
      nom: 'Lefebvre',
      domaine: 'acme-fictive.invalid',
      resolver,
    })
    expect(out.email).toBeNull()
    expect(out.domaineValide).toBe(false)
  })
})
