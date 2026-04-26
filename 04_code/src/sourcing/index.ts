/**
 * =============================================================================
 * ERE SOLAR BOT - Orchestrateur sourcing IGN + BDNB
 * =============================================================================
 * Chaine la recuperation des donnees IGN cadastre et BDNB pour produire
 * une liste de ProspectCandidat prets a etre inseres dans la table
 * `prospects` de Supabase.
 *
 * Strategie :
 * 1. Appel BDNB (filtrage tertiaire >= 500 m2 delegue a l'API)
 * 2. Optionnel : enrichissement IGN pour valider les surfaces / parcelles
 * 3. Deduplication par siret + adresse
 *
 * NB : la couche d'insertion Supabase n'est PAS implementee ici tant que
 * la PR J2 n'est pas mergee. L'orchestrateur retourne les candidats ;
 * l'insertion sera ajoutee au moment du merge.
 * =============================================================================
 */

import { fetchBatiments, bdnbVersProspectCandidat } from './bdnb'
import {
  fetchParcelles,
  filtrerParcellesParSurface,
  centroideParcelle,
} from './cadastre-ign'
import type { ProspectCandidat } from './types'

export interface SourceProspectsOptions {
  /** Code INSEE de la commune cible */
  codeInsee: string
  /** Nom lisible de la commune (utilise comme fallback) */
  commune?: string
  /** Inclure aussi les parcelles IGN (sans BDNB) en candidats orphelins */
  inclureParcellesIgn?: boolean
  /** Surface minimale (m2). Defaut : 500 (APER) */
  surfaceMinM2?: number
  /** Surcharge fetch (tests) */
  fetchImpl?: typeof fetch
}

export interface SourceProspectsResult {
  candidats: ProspectCandidat[]
  /** Statistiques pour monitoring / logs */
  stats: {
    bdnbBatimentsRecus: number
    bdnbCandidatsExploitables: number
    ignParcellesRecues: number
    ignParcellesEligibles: number
    candidatsAvantDedup: number
    candidatsApresDedup: number
  }
}

/**
 * Cle de deduplication. On considere doublons les candidats qui ont :
 * - le meme SIRET non vide, OU
 * - la meme adresse normalisee (trim/lower/strip espaces multiples)
 */
function cleDedup(p: ProspectCandidat): string {
  if (p.siret_proprietaire) return `siret:${p.siret_proprietaire}`
  const adresseNorm = p.adresse
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
  return `addr:${adresseNorm}|${p.code_insee}`
}

export function dedupCandidats(list: ProspectCandidat[]): ProspectCandidat[] {
  const seen = new Set<string>()
  const out: ProspectCandidat[] = []
  for (const c of list) {
    const k = cleDedup(c)
    if (seen.has(k)) continue
    seen.add(k)
    out.push(c)
  }
  return out
}

/**
 * Sourcing principal pour une commune.
 *
 * @returns la liste de candidats prospects + des stats d'execution.
 */
export async function sourceProspects(
  opts: SourceProspectsOptions,
): Promise<SourceProspectsResult> {
  const surfaceMin = opts.surfaceMinM2 ?? 500

  // 1. BDNB - source principale de candidats
  const batiments = await fetchBatiments({
    codeInsee: opts.codeInsee,
    surfaceMinM2: surfaceMin,
    fetchImpl: opts.fetchImpl,
  })
  const bdnbCandidats = batiments
    .map((b) => bdnbVersProspectCandidat(b, opts.commune))
    .filter((c): c is ProspectCandidat => c !== null)

  // 2. IGN - optionnel, pour parcelles non-couvertes par BDNB
  let ignCandidats: ProspectCandidat[] = []
  let ignParcellesRecues = 0
  let ignParcellesEligibles = 0
  if (opts.inclureParcellesIgn) {
    const fc = await fetchParcelles({
      codeInsee: opts.codeInsee,
      fetchImpl: opts.fetchImpl,
    })
    ignParcellesRecues = fc.features.length
    const eligibles = filtrerParcellesParSurface(fc.features, surfaceMin)
    ignParcellesEligibles = eligibles.length

    ignCandidats = eligibles
      .map((f) => {
        const c = centroideParcelle(f)
        if (!c) return null
        const candidat: ProspectCandidat = {
          adresse: `Parcelle ${f.properties.id ?? '?'}`,
          code_postal: '',
          commune: opts.commune ?? '',
          code_insee: opts.codeInsee,
          lat: c.lat,
          lng: c.lng,
          surface_m2: f.properties.contenance ?? 0,
          usage: 'tertiaire',
          nb_etages: null,
          annee_construction: null,
          siret_proprietaire: null,
          parcelle_id: f.properties.id ?? null,
          source: 'ign_cadastre',
        }
        return candidat
      })
      .filter((c): c is ProspectCandidat => c !== null)
  }

  const fusion = [...bdnbCandidats, ...ignCandidats]
  const dedupes = dedupCandidats(fusion)

  return {
    candidats: dedupes,
    stats: {
      bdnbBatimentsRecus: batiments.length,
      bdnbCandidatsExploitables: bdnbCandidats.length,
      ignParcellesRecues,
      ignParcellesEligibles,
      candidatsAvantDedup: fusion.length,
      candidatsApresDedup: dedupes.length,
    },
  }
}

// Re-exports pratiques pour les consommateurs en aval
export type { ProspectCandidat } from './types'
export { SourcingError } from './types'
