-- =============================================================================
-- ERE SOLAR BOT — Setup complet base de données
-- Combine migration 001 + 002 en une seule exécution
-- Projet : solar-bot-prod (ERE Experts)
-- Date : 27 avril 2026
-- =============================================================================

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLE : prospects
-- =============================================

CREATE TABLE prospects (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adresse               text NOT NULL,
  code_postal           text NOT NULL,
  commune               text NOT NULL,
  lat                   double precision NOT NULL,
  lng                   double precision NOT NULL,
  parcelle_id           text UNIQUE,
  surface_m2            numeric NOT NULL CHECK (surface_m2 > 0),
  usage                 text NOT NULL,
  annee_construction    integer,
  siren_proprietaire    text,
  raison_sociale        text,
  code_insee            text,
  nb_etages             integer,
  siret_proprietaire    text,
  score                 integer CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  statut                text NOT NULL DEFAULT 'new'
                         CHECK (statut IN (
                           'new', 'enriched', 'solar_calculated',
                           'microsite_ready', 'outreach_sent',
                           'opened', 'replied', 'meeting_booked',
                           'qualified', 'client', 'lost', 'refused', 'unsubscribed'
                         )),
  obligation_aper       boolean DEFAULT false,
  obligation_dec_tert   boolean DEFAULT false,
  surface_parking_m2    numeric DEFAULT 0,
  source                text DEFAULT 'bdnb',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prospects_statut ON prospects(statut);
CREATE INDEX idx_prospects_commune ON prospects(commune);
CREATE INDEX idx_prospects_code_postal ON prospects(code_postal);
CREATE INDEX idx_prospects_siren ON prospects(siren_proprietaire);
CREATE INDEX idx_prospects_coords ON prospects(lat, lng);
CREATE INDEX idx_prospects_code_insee ON prospects(code_insee);
CREATE INDEX idx_prospects_statut_score ON prospects(statut, score DESC);
CREATE INDEX idx_prospects_siren_notnull ON prospects(siren_proprietaire) WHERE siren_proprietaire IS NOT NULL;

-- =============================================
-- TABLE : calculs_solaires
-- =============================================

CREATE TABLE calculs_solaires (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id               uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  nb_panneaux_max           integer NOT NULL CHECK (nb_panneaux_max >= 0),
  puissance_kwc             numeric NOT NULL CHECK (puissance_kwc >= 0),
  production_kwh_an         numeric NOT NULL CHECK (production_kwh_an >= 0),
  surface_toiture_utile_m2  numeric,
  azimut_deg                numeric,
  inclinaison_deg           numeric,
  economie_annuelle_eur     numeric NOT NULL,
  retour_investissement_ans numeric,
  cout_installation_eur     numeric,
  prime_autoconsommation_eur numeric DEFAULT 0,
  suramortissement_eur       numeric DEFAULT 0,
  cee_eur                    numeric DEFAULT 0,
  total_aides_eur            numeric GENERATED ALWAYS AS (
                               COALESCE(prime_autoconsommation_eur, 0) +
                               COALESCE(suramortissement_eur, 0) +
                               COALESCE(cee_eur, 0)
                             ) STORED,
  source_api                text NOT NULL DEFAULT 'pvgis'
                             CHECK (source_api IN ('google_solar', 'pvgis', 'manuel')),
  satellite_image_url        text,
  overlay_svg_url            text,
  nb_panneaux_retenus        integer CHECK (nb_panneaux_retenus IS NULL OR nb_panneaux_retenus >= 0),
  cout_kwc_eur               numeric(8,0),
  economie_20ans_eur         numeric(12,0),
  tarif_oa_surplus_eur_kwh   numeric(6,4),
  revenu_surplus_an_eur      numeric(10,0),
  co2_evite_tonnes_an        numeric(6,2),
  created_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calculs_prospect ON calculs_solaires(prospect_id);

-- =============================================
-- TABLE : outreach_contacts
-- =============================================

CREATE TABLE outreach_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  prenom          text NOT NULL,
  nom             text NOT NULL,
  titre           text,
  email_pro       text UNIQUE,
  telephone_pro   text,
  linkedin_url    text,
  source          text NOT NULL DEFAULT 'sirene'
                  CHECK (source IN ('pappers', 'sirene', 'linkedin', 'manuel', 'insee', 'annuaire_entreprises', 'hunter')),
  email_verifie   boolean DEFAULT false,
  desabonne       boolean DEFAULT false,
  rang_ciblage    integer NOT NULL DEFAULT 1 CHECK (rang_ciblage BETWEEN 1 AND 5),
  actif           boolean NOT NULL DEFAULT true,
  base_legale     text DEFAULT 'interet_legitime_b2b',
  date_opt_out    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_prospect ON outreach_contacts(prospect_id);
CREATE INDEX idx_contacts_email ON outreach_contacts(email_pro);
CREATE INDEX idx_contacts_prospect_rang ON outreach_contacts(prospect_id, rang_ciblage);

-- =============================================
-- TABLE : outreach_campagnes
-- =============================================

CREATE TABLE outreach_campagnes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             text NOT NULL,
  statut          text NOT NULL DEFAULT 'draft'
                  CHECK (statut IN ('draft', 'active', 'paused', 'completed')),
  nb_prospects    integer DEFAULT 0,
  nb_envoyes      integer DEFAULT 0,
  nb_ouverts      integer DEFAULT 0,
  nb_cliques      integer DEFAULT 0,
  nb_reponses     integer DEFAULT 0,
  nb_rdv          integer DEFAULT 0,
  region_pilote   text,
  lemlist_campaign_id  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- =============================================
-- TABLE : outreach_emails
-- =============================================

CREATE TABLE outreach_emails (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campagne_id     uuid NOT NULL REFERENCES outreach_campagnes(id) ON DELETE CASCADE,
  contact_id      uuid NOT NULL REFERENCES outreach_contacts(id) ON DELETE CASCADE,
  prospect_id     uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  objet           text,
  corps_html      text,
  statut          text NOT NULL DEFAULT 'scheduled'
                  CHECK (statut IN (
                    'scheduled', 'sent', 'delivered',
                    'opened', 'clicked', 'replied', 'bounced', 'unsubscribed'
                  )),
  sequence_step   integer CHECK (sequence_step IS NULL OR sequence_step IN (0, 3, 5)),
  bounced         boolean NOT NULL DEFAULT false,
  reponse_texte        text,
  reponse_categorie    text
                       CHECK (reponse_categorie IN (
                         'INTERESSE', 'REFUS_DEFINITIF', 'REFUS_TEMPORAIRE',
                         'MAUVAIS_CONTACT', 'DEMANDE_INFO', 'HORS_SUJET'
                       )),
  reponse_confiance    numeric,
  sent_at         timestamptz,
  opened_at       timestamptz,
  clicked_at      timestamptz,
  replied_at      timestamptz,
  unsubscribed_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_emails_campagne ON outreach_emails(campagne_id);
CREATE INDEX idx_emails_contact ON outreach_emails(contact_id);
CREATE INDEX idx_emails_statut ON outreach_emails(statut);
CREATE INDEX idx_emails_prospect_step ON outreach_emails(prospect_id, sequence_step);

-- =============================================
-- TABLE : microsites
-- =============================================

CREATE TABLE microsites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  slug            text UNIQUE NOT NULL,
  url_publique    text,
  titre           text,
  sous_titre      text,
  image_satellite_url  text,
  image_overlay_url    text,
  video_url            text,
  echeance_aper        date,
  echeance_dec_tert    date,
  nb_vues         integer DEFAULT 0,
  nb_clics_rdv    integer DEFAULT 0,
  visits          integer NOT NULL DEFAULT 0,
  first_visit_at  timestamptz,
  last_visit_at   timestamptz,
  cta_clicked     boolean NOT NULL DEFAULT false,
  cta_clicked_at  timestamptz,
  statut          text NOT NULL DEFAULT 'draft'
                  CHECK (statut IN ('draft', 'published', 'expired')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_microsites_slug ON microsites(slug);
CREATE INDEX idx_microsites_prospect ON microsites(prospect_id);

-- =============================================
-- Trigger updated_at automatique
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_prospects_updated_at
  BEFORE UPDATE ON prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON outreach_contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campagnes_updated_at
  BEFORE UPDATE ON outreach_campagnes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_microsites_updated_at
  BEFORE UPDATE ON microsites
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Row Level Security (RLS)
-- =============================================

ALTER TABLE prospects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculs_solaires   ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_contacts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_campagnes ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_emails    ENABLE ROW LEVEL SECURITY;
ALTER TABLE microsites         ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access prospects"
  ON prospects FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access calculs"
  ON calculs_solaires FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access contacts"
  ON outreach_contacts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access campagnes"
  ON outreach_campagnes FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access emails"
  ON outreach_emails FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Public read published microsites"
  ON microsites FOR SELECT
  USING (statut = 'published');

CREATE POLICY "Service role full access microsites"
  ON microsites FOR ALL
  USING (auth.role() = 'service_role');
