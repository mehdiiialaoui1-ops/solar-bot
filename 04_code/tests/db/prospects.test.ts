/**
 * Tests unitaires — Service insertion Supabase (scoring + mapping)
 * ERE SOLAR BOT — Vitest
 *
 * NB : on ne teste PAS l'insertion réelle Supabase ici (pas de service_role
 * en CI). On teste la logique de scoring et le mapping des données.
 */

import { describe, it, expect } from 'vitest'
import { calculerScore } from '../../src/db/prospects'
import type { ProspectCandidat } from '../../src/sourcing/types'

// --- Helpers ---

function makeCandidat(overrides: Partial<ProspectCandidat> = {}): ProspectCandidat {
  return {
    adresse: '10 Rue de Test, 69003 Lyon',
    code_postal: '69003',
    commune: 'Lyon',
    code_insee: '69123',
    lat: 45.76,
    lng: 4.85,
    surface_m2: 800,
    usage: 'Tertiaire',
    nb_etages: 3,
    annee_construction: 1985,
    siret_proprietaire: '12345678900001',
    parcelle_id: 'bdnb-bg-TEST',
    source: 'bdnb',
    ...overrides,
  }
}

// =============================================
// calculerScore
// =============================================

describe('calculerScore', () => {
  it('donne le score max pour un candidat ideal (tertiaire, >1000m², ancien, SIRET)', () => {
    const c = makeCandidat({ surface_m2: 1500 })
    const score = calculerScore(c)
    // 30 (>1000m²) + 15 (APER) + 10 (SIRET) + 10 (avant 2000) + 15 (tertiaire) = 80
    expect(score).toBe(80)
  })

  it('donne un score moyen pour un tertiaire 600m² sans SIRET', () => {
    const c = makeCandidat({
      surface_m2: 600,
      siret_proprietaire: null,
      annee_construction: 2010,
    })
    const score = calculerScore(c)
    // 20 (>=500m²) + 15 (APER) + 0 (pas de SIRET) + 0 (>=2000) + 15 (tertiaire) = 50
    expect(score).toBe(50)
  })

  it('donne un score faible pour un industriel petit, récent, sans SIRET', () => {
    const c = makeCandidat({
      surface_m2: 400,
      usage: 'industriel',
      siret_proprietaire: null,
      annee_construction: 2020,
    })
    const score = calculerScore(c)
    // 10 (<500m²) + 0 (pas APER) + 0 (pas de SIRET) + 0 (>=2000) + 0 (pas tertiaire) = 10
    expect(score).toBe(10)
  })

  it('ajoute +15 pour obligation APER (>= 500m²)', () => {
    const sans = makeCandidat({ surface_m2: 499, usage: 'industriel', siret_proprietaire: null, annee_construction: null })
    const avec = makeCandidat({ surface_m2: 500, usage: 'industriel', siret_proprietaire: null, annee_construction: null })
    expect(calculerScore(avec) - calculerScore(sans)).toBe(25) // 20-10 (surface) + 15 (APER)
  })

  it('ajoute +10 pour bâtiment construit avant 2000', () => {
    const recent = makeCandidat({ annee_construction: 2005 })
    const ancien = makeCandidat({ annee_construction: 1990 })
    expect(calculerScore(ancien) - calculerScore(recent)).toBe(10)
  })

  it('gère annee_construction null sans crash', () => {
    const c = makeCandidat({ annee_construction: null })
    expect(() => calculerScore(c)).not.toThrow()
  })

  it('ne dépasse jamais 100', () => {
    const c = makeCandidat({ surface_m2: 50000 })
    expect(calculerScore(c)).toBeLessThanOrEqual(100)
  })
})
