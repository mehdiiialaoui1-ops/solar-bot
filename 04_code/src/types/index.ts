// =============================================
// ERE SOLAR BOT — Types TypeScript centraux
// =============================================

// --- Prospect / Bâtiment ---

export type StatutProspect =
  | 'new'
  | 'enriched'
  | 'solar_calculated'
  | 'microsite_ready'
  | 'outreach_sent'
  | 'replied'
  | 'meeting_booked'
  | 'client'
  | 'refused'
  | 'unsubscribed'

export interface Prospect {
  id: string
  adresse: string
  code_postal: string
  commune: string
  lat: number
  lng: number
  parcelle_id?: string
  surface_m2: number
  usage: string
  annee_construction?: number
  siren_proprietaire?: string
  raison_sociale?: string
  statut: StatutProspect
  created_at: string
  updated_at?: string
}

// --- Calcul solaire ---

export interface CalculSolaire {
  id: string
  prospect_id: string
  // Données Google Solar API
  nb_panneaux_max: number
  puissance_kwc: number
  production_annuelle_kwh: number
  surface_toiture_utile_m2: number
  azimut_deg: number
  inclinaison_deg: number
  // Calculs financiers
  economie_annuelle_eur: number
  retour_investissement_ans: number
  cout_installation_eur: number
  // Aides applicables
  prime_autoconsommation_eur: number
  suramortissement_eur: number
  cee_eur: number
  // Obligations réglementaires
  obligation_aper: boolean
  obligation_decret_tertiaire: boolean
  // Métadonnées
  source_api: 'google_solar' | 'pvgis' | 'manuel'
  created_at: string
}

// --- Contact / Décideur ---

export interface OutreachContact {
  id: string
  prospect_id: string
  prenom: string
  nom: string
  titre?: string
  email_pro?: string
  telephone_pro?: string
  linkedin_url?: string
  source: 'pappers' | 'sirene' | 'linkedin' | 'manuel'
  email_verifie: boolean
  created_at: string
}

// --- Campagne outreach ---

export type StatutCampagne = 'draft' | 'active' | 'paused' | 'completed'

export interface OutreachCampagne {
  id: string
  nom: string
  statut: StatutCampagne
  nb_prospects: number
  nb_envoyes: number
  nb_ouverts: number
  nb_cliques: number
  nb_reponses: number
  nb_rdv: number
  created_at: string
}

// --- Aides financières ---

export interface AideFinanciere {
  type: 'prime_autoconsommation' | 'suramortissement' | 'cee' | 'rachat_surplus'
  montant_eur: number
  conditions: string
  applicable: boolean
  raison_inapplicabilite?: string
}

// --- Résultat calcul aides ---

export interface ResultatAides {
  prospect_id: string
  puissance_kwc: number
  aides: AideFinanciere[]
  total_aides_eur: number
  economie_annuelle_kwh: number
  economie_annuelle_eur: number
  retour_investissement_ans: number
}
