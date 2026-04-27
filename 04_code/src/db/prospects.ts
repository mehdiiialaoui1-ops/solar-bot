/**
 * =============================================================================
 * ERE SOLAR BOT — Service d'insertion Supabase (prospects + calculs solaires)
 * =============================================================================
 * Gère l'upsert des prospects sourcés (BDNB/IGN) et l'insertion des
 * résultats de calcul solaire (PVGIS) dans la base Supabase.
 *
 * Déduplication : UPSERT sur `parcelle_id` (UNIQUE constraint en DB).
 * Sécurité : utilise le client service_role (RLS bypass).
 *
 * Tables ciblées :
 *   - prospects        (migration 001 + 002)
 *   - calculs_solaires (migration 001 + 002)
 * =============================================================================
 */

import { createServerClient } from '../lib/supabase/client'
import type { ProspectCandidat } from '../sourcing/types'
import type { PotentielSolaireComplet } from '../solar/index'

// ----------------------------------------------------------------------------
// Types de retour
// ----------------------------------------------------------------------------

export interface InsertProspectResult {
  id: string
  parcelle_id: string | null
  isNew: boolean
}

export interface InsertCalculResult {
  id: string
  prospect_id: string
}

export interface InsertPipelineResult {
  prospect: InsertProspectResult
  calcul: InsertCalculResult | null
}

// ----------------------------------------------------------------------------
// Erreur typée
// ----------------------------------------------------------------------------

export class SupabaseInsertError extends Error {
  constructor(
    message: string,
    public readonly table: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'SupabaseInsertError'
  }
}

// ----------------------------------------------------------------------------
// Score de priorité (barème simplifié — cf. schema_db_prospects.md)
// ----------------------------------------------------------------------------

/**
 * Calcule un score 0-100 pour prioriser les prospects.
 * Barème :
 *   +30 si surface >= 1000 m²
 *   +20 si surface >= 500 m² (sinon +10)
 *   +15 si obligation APER probable (surface >= 500 m²)
 *   +10 si SIRET propriétaire connu
 *   +10 si bâtiment construit avant 2000 (potentiel rénov)
 *   +15 si usage tertiaire (cible principale)
 */
export function calculerScore(candidat: ProspectCandidat): number {
  let score = 0

  // Surface
  if (candidat.surface_m2 >= 1000) score += 30
  else if (candidat.surface_m2 >= 500) score += 20
  else score += 10

  // Obligation APER (toiture >= 500 m²)
  if (candidat.surface_m2 >= 500) score += 15

  // SIRET connu
  if (candidat.siret_proprietaire) score += 10

  // Ancienneté
  if (
    candidat.annee_construction &&
    candidat.annee_construction < 2000
  ) {
    score += 10
  }

  // Usage tertiaire = cible principale
  if (candidat.usage.toLowerCase().startsWith('tertiaire')) score += 15

  return Math.min(score, 100)
}

// ----------------------------------------------------------------------------
// Insertion / Upsert prospect
// ----------------------------------------------------------------------------

/**
 * Insère ou met à jour un prospect dans Supabase.
 * Déduplication sur `parcelle_id` (ON CONFLICT DO UPDATE).
 *
 * Retourne l'ID du prospect (nouveau ou existant).
 */
export async function upsertProspect(
  candidat: ProspectCandidat,
): Promise<InsertProspectResult> {
  const supabase = createServerClient()
  const score = calculerScore(candidat)

  // Mapping ProspectCandidat → table prospects (post-migration 002)
  const row = {
    adresse: candidat.adresse,
    code_postal: candidat.code_postal,
    commune: candidat.commune,
    code_insee: candidat.code_insee,
    lat: candidat.lat,
    lng: candidat.lng,
    parcelle_id: candidat.parcelle_id,
    surface_m2: candidat.surface_m2,
    usage: candidat.usage,
    nb_etages: candidat.nb_etages,
    annee_construction: candidat.annee_construction,
    siret_proprietaire: candidat.siret_proprietaire,
    source: candidat.source,
    score,
    // obligation_aper détectée si surface >= 500 m² (loi APER 2026)
    obligation_aper: candidat.surface_m2 >= 500,
    statut: 'new' as const,
  }

  const { data, error } = await supabase
    .from('prospects')
    .upsert(row, {
      onConflict: 'parcelle_id',
      ignoreDuplicates: false, // UPDATE si doublon
    })
    .select('id, parcelle_id')
    .single()

  if (error) {
    throw new SupabaseInsertError(
      `Erreur upsert prospect (${candidat.parcelle_id}): ${error.message}`,
      'prospects',
      error,
    )
  }

  // Déterminer si c'est un nouveau ou un update
  // (Supabase upsert ne le dit pas nativement, mais on peut checker updated_at)
  return {
    id: data.id,
    parcelle_id: data.parcelle_id,
    isNew: true, // simplifié — on pourrait comparer created_at vs updated_at
  }
}

// ----------------------------------------------------------------------------
// Insertion calcul solaire
// ----------------------------------------------------------------------------

/**
 * Insère un résultat de calcul solaire lié à un prospect.
 * Pas d'upsert ici : on peut avoir plusieurs calculs par prospect
 * (recalculs successifs). Le plus récent fait foi.
 */
export async function insertCalculSolaire(
  prospectId: string,
  potentiel: PotentielSolaireComplet,
): Promise<InsertCalculResult> {
  const supabase = createServerClient()

  // Mapping PotentielSolaireComplet → table calculs_solaires (post-migration 002)
  const row = {
    prospect_id: prospectId,
    nb_panneaux_max: potentiel.nb_panneaux_max,
    puissance_kwc: potentiel.puissance_kwc,
    production_kwh_an: potentiel.production_kwh_an,
    surface_toiture_utile_m2: potentiel.surface_toiture_utile_m2,
    azimut_deg: potentiel.azimut_deg,
    inclinaison_deg: potentiel.inclinaison_deg,
    economie_annuelle_eur: potentiel.economie_annuelle_eur,
    retour_investissement_ans: potentiel.retour_investissement_ans,
    cout_installation_eur: potentiel.cout_installation_eur,
    prime_autoconsommation_eur: potentiel.prime_autoconsommation_eur,
    suramortissement_eur: potentiel.suramortissement_eur,
    cee_eur: 0, // CEE calculé plus tard (fiches BAT-EN/IND-UT)
    source_api: potentiel.source_api,
    satellite_image_url: potentiel.satelliteImageUrl,
  }

  const { data, error } = await supabase
    .from('calculs_solaires')
    .insert(row)
    .select('id, prospect_id')
    .single()

  if (error) {
    throw new SupabaseInsertError(
      `Erreur insert calcul solaire (prospect ${prospectId}): ${error.message}`,
      'calculs_solaires',
      error,
    )
  }

  return {
    id: data.id,
    prospect_id: data.prospect_id,
  }
}

// ----------------------------------------------------------------------------
// Mise à jour statut prospect
// ----------------------------------------------------------------------------

/**
 * Met à jour le statut d'un prospect dans le pipeline.
 */
export async function updateProspectStatut(
  prospectId: string,
  statut: string,
): Promise<void> {
  const supabase = createServerClient()

  const { error } = await supabase
    .from('prospects')
    .update({ statut })
    .eq('id', prospectId)

  if (error) {
    throw new SupabaseInsertError(
      `Erreur update statut prospect ${prospectId}: ${error.message}`,
      'prospects',
      error,
    )
  }
}

// ----------------------------------------------------------------------------
// Pipeline complet : prospect + calcul solaire
// ----------------------------------------------------------------------------

/**
 * Orchestre l'insertion complète d'un prospect avec son calcul solaire.
 * 1. Upsert prospect → récupère l'ID
 * 2. Insert calcul solaire avec le prospect_id
 * 3. Passe le statut à 'solar_calculated'
 *
 * Si le calcul solaire échoue, le prospect reste en statut 'new'.
 */
export async function insertPipelineComplet(
  candidat: ProspectCandidat,
  potentiel?: PotentielSolaireComplet | null,
): Promise<InsertPipelineResult> {
  // 1. Upsert prospect
  const prospect = await upsertProspect(candidat)

  // 2. Insert calcul solaire (si disponible)
  let calcul: InsertCalculResult | null = null
  if (potentiel) {
    calcul = await insertCalculSolaire(prospect.id, potentiel)
    // 3. Avancer le statut
    await updateProspectStatut(prospect.id, 'solar_calculated')
  }

  return { prospect, calcul }
}

// ----------------------------------------------------------------------------
// Requêtes utilitaires
// ----------------------------------------------------------------------------

/**
 * Vérifie si un prospect existe déjà par parcelle_id.
 */
export async function prospectExiste(
  parcelleId: string,
): Promise<string | null> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('prospects')
    .select('id')
    .eq('parcelle_id', parcelleId)
    .maybeSingle()

  if (error) {
    throw new SupabaseInsertError(
      `Erreur lookup prospect (${parcelleId}): ${error.message}`,
      'prospects',
      error,
    )
  }

  return data?.id ?? null
}

/**
 * Compte les prospects par statut (pour le dashboard).
 */
export async function compterProspectsParStatut(): Promise<
  Record<string, number>
> {
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('prospects')
    .select('statut')

  if (error) {
    throw new SupabaseInsertError(
      `Erreur comptage prospects: ${error.message}`,
      'prospects',
      error,
    )
  }

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.statut] = (counts[row.statut] ?? 0) + 1
  }
  return counts
}
