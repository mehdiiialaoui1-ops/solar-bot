-- =============================================
-- ERE SOLAR BOT — Migration initiale
-- Version : 001 | Date : avril 2026
-- Région : EU Frankfurt (Supabase)
-- =============================================
-- Exécuter dans : Supabase Dashboard → SQL Editor
-- OU via : supabase db push

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- pour les géométries

-- =============================================
-- TABLE : prospects
-- Source : cadastre IGN + BDNB CSTB
-- =============================================

CREATE TABLE prospects (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Localisation
  adresse               text NOT NULL,
  code_postal           text NOT NULL,
  commune               text NOT NULL,
  lat                   double precision NOT NULL,
  lng                   double precision NOT NULL,
  parcelle_id           text UNIQUE,            -- ex: 75056A0001
  -- Caractéristiques bâtiment
  surface_m2            numeric NOT NULL CHECK (surface_m2 > 0),
  usage                 text NOT NULL,          -- tertiaire, industriel, mixte
  annee_construction    integer,
  -- Propriétaire
  siren_proprietaire    text,
  raison_sociale        text,
  -- Pipeline
  statut                text NOT NULL DEFAULT 'new'
                         CHECK (statut IN (
                           'new', 'enriched', 'solar_calculated',
                           'microsite_ready', 'outreach_sent', 'replied',
                           'meeting_booked', 'client', 'refused', 'unsubscribed'
                         )),
  -- Obligations réglementaires détectées
  obligation_aper       boolean DEFAULT false,
  obligation_dec_tert   boolean DEFAULT false,
  surface_parking_m2    numeric DEFAULT 0,
  -- Métadonnées
  source_donnee         text DEFAULT 'bdnb',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Index prospects
CREATE INDEX idx_prospects_statut ON prospects(statut);
CREATE INDEX idx_prospects_commune ON prospects(commune);
CREATE INDEX idx_prospects_code_postal ON prospects(code_postal);
CREATE INDEX idx_prospects_siren ON prospects(siren_proprietaire);
CREATE INDEX idx_prospects_coords ON prospects(lat, lng);

COMMENT ON TABLE prospects IS 'Bâtiments tertiaires/industriels sourcés depuis le cadastre IGN et BDNB CSTB';

-- =============================================
-- TABLE : calculs_solaires
-- Source : Google Solar API ou PVGIS
-- =============================================

CREATE TABLE calculs_solaires (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id               uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  -- Données Google Solar API
  nb_panneaux_max           integer NOT NULL CHECK (nb_panneaux_max >= 0),
  puissance_kwc             numeric NOT NULL CHECK (puissance_kwc >= 0),
  production_annuelle_kwh   numeric NOT NULL CHECK (production_annuelle_kwh >= 0),
  surface_toiture_utile_m2  numeric,
  azimut_deg                numeric,
  inclinaison_deg           numeric,
  -- Calculs financiers
  economie_annuelle_eur     numeric NOT NULL,
  retour_investissement_ans numeric,
  cout_installation_eur     numeric,
  -- Aides financières applicables
  prime_autoconsommation_eur numeric DEFAULT 0,
  suramortissement_eur       numeric DEFAULT 0,
  cee_eur                    numeric DEFAULT 0,
  total_aides_eur            numeric GENERATED ALWAYS AS (
                               COALESCE(prime_autoconsommation_eur, 0) +
                               COALESCE(suramortissement_eur, 0) +
                               COALESCE(cee_eur, 0)
                             ) STORED,
  -- Source de données
  source_api                text NOT NULL DEFAULT 'google_solar'
                             CHECK (source_api IN ('google_solar', 'pvgis', 'manuel')),
  -- Image satellite
  image_satellite_url        text,
  image_overlay_url          text,   -- Image avec panneaux superposés
  -- Métadonnées
  created_at                 timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_calculs_prospect ON calculs_solaires(prospect_id);
COMMENT ON TABLE calculs_solaires IS 'Résultats des calculs de potentiel solaire (Google Solar API ou PVGIS)';

-- =============================================
-- TABLE : outreach_contacts
-- Source : Pappers + Dropcontact
-- =============================================

CREATE TABLE outreach_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  -- Identité
  prenom          text NOT NULL,
  nom             text NOT NULL,
  titre           text,           -- ex: "Directeur Administratif et Financier"
  -- Contact
  email_pro       text,
  telephone_pro   text,
  linkedin_url    text,
  -- Qualification
  source          text NOT NULL DEFAULT 'pappers'
                  CHECK (source IN ('pappers', 'sirene', 'linkedin', 'manuel')),
  email_verifie   boolean DEFAULT false,
  desabonne       boolean DEFAULT false,
  -- Consentement RGPD
  base_legale     text DEFAULT 'interet_legittime_b2b',
  date_opt_out    timestamptz,
  -- Métadonnées
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_prospect ON outreach_contacts(prospect_id);
CREATE INDEX idx_contacts_email ON outreach_contacts(email_pro);
COMMENT ON TABLE outreach_contacts IS 'Décideurs identifiés pour chaque bâtiment (source : Pappers, SIRENE, Dropcontact)';

-- =============================================
-- TABLE : outreach_campagnes
-- =============================================

CREATE TABLE outreach_campagnes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             text NOT NULL,
  statut          text NOT NULL DEFAULT 'draft'
                  CHECK (statut IN ('draft', 'active', 'paused', 'completed')),
  -- Métriques
  nb_prospects    integer DEFAULT 0,
  nb_envoyes      integer DEFAULT 0,
  nb_ouverts      integer DEFAULT 0,
  nb_cliques      integer DEFAULT 0,
  nb_reponses     integer DEFAULT 0,
  nb_rdv          integer DEFAULT 0,
  -- Lemlist
  lemlist_campaign_id  text,
  -- Métadonnées
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE outreach_campagnes IS 'Campagnes de prospection email (intégration Lemlist)';

-- =============================================
-- TABLE : outreach_emails
-- Suivi individual des envois
-- =============================================

CREATE TABLE outreach_emails (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campagne_id     uuid NOT NULL REFERENCES outreach_campagnes(id) ON DELETE CASCADE,
  contact_id      uuid NOT NULL REFERENCES outreach_contacts(id) ON DELETE CASCADE,
  prospect_id     uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  -- Contenu
  objet           text,
  corps_html      text,
  -- Statut
  statut          text NOT NULL DEFAULT 'scheduled'
                  CHECK (statut IN (
                    'scheduled', 'sent', 'delivered',
                    'opened', 'clicked', 'replied', 'bounced', 'unsubscribed'
                  )),
  -- Réponse classifiée
  reponse_texte        text,
  reponse_categorie    text
                       CHECK (reponse_categorie IN (
                         'INTERESSE', 'REFUS_DEFINITIF', 'REFUS_TEMPORAIRE',
                         'MAUVAIS_CONTACT', 'DEMANDE_INFO', 'HORS_SUJET'
                       )),
  reponse_confiance    numeric,
  -- Timestamps
  envoye_at       timestamptz,
  ouvert_at       timestamptz,
  clique_at       timestamptz,
  repondu_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_emails_campagne ON outreach_emails(campagne_id);
CREATE INDEX idx_emails_contact ON outreach_emails(contact_id);
CREATE INDEX idx_emails_statut ON outreach_emails(statut);
COMMENT ON TABLE outreach_emails IS 'Suivi individuel de chaque email envoyé dans une campagne';

-- =============================================
-- TABLE : microsites
-- =============================================

CREATE TABLE microsites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id     uuid NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  -- URL
  slug            text UNIQUE NOT NULL,  -- ex: "entrepot-marseille-2024"
  url_publique    text,
  -- Contenu personnalisé
  titre           text,
  sous_titre      text,
  image_satellite_url  text,
  image_overlay_url    text,
  video_url            text,
  -- Compte à rebours réglementaire
  echeance_aper        date,
  echeance_dec_tert    date,
  -- Tracking
  nb_vues         integer DEFAULT 0,
  nb_clics_rdv    integer DEFAULT 0,
  -- Statut
  statut          text NOT NULL DEFAULT 'draft'
                  CHECK (statut IN ('draft', 'published', 'expired')),
  -- Métadonnées
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_microsites_slug ON microsites(slug);
CREATE INDEX idx_microsites_prospect ON microsites(prospect_id);
COMMENT ON TABLE microsites IS 'Micro-sites personnalisés par prospect avec overlay panneaux et compte à rebours';

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

-- Politique : accès complet via service role (backend)
-- Le front n'accède qu'aux microsites publics

CREATE POLICY "Service role accès complet prospects"
  ON prospects FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role accès complet calculs"
  ON calculs_solaires FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role accès complet contacts"
  ON outreach_contacts FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role accès complet campagnes"
  ON outreach_campagnes FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role accès complet emails"
  ON outreach_emails FOR ALL
  USING (auth.role() = 'service_role');

-- Microsites : lecture publique des sites publiés, écriture service role
CREATE POLICY "Lecture publique microsites publiés"
  ON microsites FOR SELECT
  USING (statut = 'published');

CREATE POLICY "Service role accès complet microsites"
  ON microsites FOR ALL
  USING (auth.role() = 'service_role');
