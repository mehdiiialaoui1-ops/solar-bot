/**
 * ERE SOLAR BOT — Dashboard prospects
 * Page Server Component : lit les données directement depuis Supabase.
 */

import { createServerClient } from '@/lib/supabase/client'
import { DashboardClient } from './DashboardClient'

export const dynamic = 'force-dynamic' // toujours frais, pas de cache

interface ProspectRow {
  id: string
  adresse: string
  commune: string
  code_postal: string
  surface_m2: number
  usage: string
  score: number | null
  statut: string
  obligation_aper: boolean
  annee_construction: number | null
  siret_proprietaire: string | null
  created_at: string
}

interface CalculRow {
  id: string
  prospect_id: string
  puissance_kwc: number
  production_kwh_an: number
  economie_annuelle_eur: number
  retour_investissement_ans: number | null
  cout_installation_eur: number | null
  prime_autoconsommation_eur: number
  suramortissement_eur: number
  total_aides_eur: number | null
}

export interface ProspectAvecCalcul extends ProspectRow {
  calcul: CalculRow | null
  microsite_slug: string | null
}

async function fetchProspects(): Promise<ProspectAvecCalcul[]> {
  const supabase = createServerClient()

  // Récupérer tous les prospects
  const { data: prospects, error: pErr } = await supabase
    .from('prospects')
    .select('*')
    .order('score', { ascending: false })

  if (pErr) throw new Error(`Erreur prospects: ${pErr.message}`)

  // Récupérer les calculs solaires (le plus récent par prospect)
  const { data: calculs, error: cErr } = await supabase
    .from('calculs_solaires')
    .select('*')
    .order('created_at', { ascending: false })

  if (cErr) throw new Error(`Erreur calculs: ${cErr.message}`)

  // Récupérer les microsites (slug par prospect)
  const { data: microsites } = await supabase
    .from('microsites')
    .select('*')

  // Indexer les calculs par prospect_id (le plus récent)
  const calculParProspect = new Map<string, CalculRow>()
  for (const c of calculs ?? []) {
    if (!calculParProspect.has(c.prospect_id)) {
      calculParProspect.set(c.prospect_id, c)
    }
  }

  // Indexer les slugs microsites
  const slugParProspect = new Map<string, string>()
  for (const m of microsites ?? []) {
    slugParProspect.set(m.prospect_id, m.slug)
  }

  // Fusionner
  return (prospects ?? []).map((p) => ({
    ...p,
    calcul: calculParProspect.get(p.id) ?? null,
    microsite_slug: slugParProspect.get(p.id) ?? null,
  }))
}

export default async function DashboardPage() {
  let prospects: ProspectAvecCalcul[] = []
  let erreur: string | null = null

  try {
    prospects = await fetchProspects()
  } catch (err) {
    erreur = (err as Error).message
  }

  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif', maxWidth: 1400, margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', margin: 0, color: '#1a1a2e' }}>
          ERE Solar Bot — Dashboard
        </h1>
        <p style={{ color: '#666', margin: '0.25rem 0 0' }}>
          Pipeline de prospection solarisation tertiaire
        </p>
      </header>

      {erreur ? (
        <div style={{ padding: '1rem', background: '#fee', border: '1px solid #fcc', borderRadius: 8 }}>
          <strong>Erreur :</strong> {erreur}
        </div>
      ) : (
        <DashboardClient prospects={prospects} />
      )}
    </main>
  )
}
