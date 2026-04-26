/**
 * =============================================================================
 * ERE SOLAR BOT - Donnees de test pour le microsite (J6)
 * =============================================================================
 * Donnees mockees pour developper le rendu du microsite avant
 * d'avoir le vrai pipeline de bout en bout (sourcing -> solar -> outreach).
 *
 * Le microsite final consommera des donnees issues des tables
 * `prospects` + `calculs_solaires` + `microsites` via Supabase.
 * =============================================================================
 */

export interface MicrositeData {
  slug: string
  prospect: {
    raison_sociale: string
    adresse: string
    code_postal: string
    commune: string
    surface_m2: number
    usage: string
    annee_construction?: number
  }
  decideur: {
    prenom: string
    nom: string
    titre: string
  }
  calcul_solaire: {
    nb_panneaux: number
    puissance_kwc: number
    production_kwh_an: number
    surface_toiture_utile_m2: number
    azimut_deg: number
    inclinaison_deg: number
    economie_annuelle_eur: number
    cout_installation_eur: number
    retour_investissement_ans: number
    co2_evite_tonnes_an: number
    satellite_image_url: string
    overlay_svg_url?: string
  }
  aides: {
    prime_autoconsommation_eur: number
    suramortissement_eur: number
    cee_eur: number
    rachat_surplus_eur_par_an: number
  }
  obligations: {
    aper: boolean
    decret_tertiaire: boolean
  }
  cta: {
    rdv_url: string
  }
}

export const MOCK_MICROSITE: MicrositeData = {
  slug: 'demo-paris-1er',
  prospect: {
    raison_sociale: 'Immobilière Rivoli SAS',
    adresse: '12 rue de Rivoli',
    code_postal: '75001',
    commune: 'Paris',
    surface_m2: 2150,
    usage: 'Tertiaire',
    annee_construction: 1995,
  },
  decideur: {
    prenom: 'Marie',
    nom: 'Lefebvre',
    titre: 'Directrice immobilière',
  },
  calcul_solaire: {
    nb_panneaux: 248,
    puissance_kwc: 99.2,
    production_kwh_an: 88560,
    surface_toiture_utile_m2: 487.3,
    azimut_deg: 178,
    inclinaison_deg: 22,
    economie_annuelle_eur: 13284,
    cout_installation_eur: 99200,
    retour_investissement_ans: 7.5,
    co2_evite_tonnes_an: 2.35,
    satellite_image_url:
      'https://images.unsplash.com/photo-1559302504-64aae6ca6b6d?w=800&h=600&fit=crop',
  },
  aides: {
    prime_autoconsommation_eur: 0,
    suramortissement_eur: 24800,
    cee_eur: 8500,
    rachat_surplus_eur_par_an: 2100,
  },
  obligations: {
    aper: true,
    decret_tertiaire: true,
  },
  cta: {
    rdv_url: 'https://cal.com/ere-experts/etude-solaire',
  },
}

/**
 * Au-dela du squelette : recuperer les donnees du microsite par slug
 * depuis la table `microsites` + jointures. Sera implemente une fois
 * J2 mergee.
 */
export async function getMicrositeData(slug: string): Promise<MicrositeData | null> {
  // TODO : remplacer par un fetch Supabase
  if (slug === MOCK_MICROSITE.slug) return MOCK_MICROSITE
  return null
}
