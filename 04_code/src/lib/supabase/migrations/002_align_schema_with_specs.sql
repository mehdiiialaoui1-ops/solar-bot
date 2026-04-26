-- =============================================================================
-- ERE SOLAR BOT — Migration 002
-- Alignement du schéma Supabase avec 01_specs/schema_db_prospects.md
-- =============================================================================
-- Version  : 002
-- Date     : 2026-04-24
-- Auteur   : Youssef (Tech & Infra)
-- Branche  : feature/supabase-schema
-- Sprint   : MVP v1 — Point sync ⚡ J2
-- Spec     : 01_specs/schema_db_prospects.md (commit f0c8aab de Mehdi)
-- Cible    : projet Supabase solar-bot-prod (hltcwkcmrwnyehsbrwdx, eu-west-2)
-- Rollback : voir 002_rollback_align_schema_with_specs.sql (à produire si besoin)
-- =============================================================================
-- Pré-requis : migration 001_schema_initial.sql déjà appliquée en prod.
-- Vérifié le 2026-04-24 via list_tables : les 6 tables sont présentes et
-- conformes à 001. Toutes les tables sont vides (0 rows) au moment de
-- l'écriture — aucun risque de perte de données.
-- =============================================================================
-- Choix techniques divergents de la spec (à valider par Mehdi en review) :
--
--   D1) obligation_aper, obligation_dec_tert, surface_parking_m2 : conservés
--       dans prospects (et non déplacés dans calculs_solaires comme la spec
--       le prévoit). Raison : ces flags dépendent du bâtiment, pas du calcul
--       solaire. Ils doivent être disponibles dès l'état 'new' pour le
--       scoring (cf. barème de score dans la spec, qui inclut ces obligations
--       comme critères). Les placer dans calculs_solaires bloquerait le
--       scoring tant que le calcul n'a pas été fait, ce qui est l'inverse du
--       besoin (scorer pour décider quels prospects déclencher en Solar API).
--
--   D2) Enum statut de prospects : union des valeurs spec + migration 001.
--       Valeurs retenues (13) :
--         new, enriched, solar_calculated, microsite_ready, outreach_sent,
--         opened, replied, meeting_booked, qualified, client, lost, refused,
--         unsubscribed
--       Ajouts vs migration 001 : opened, qualified, lost (venant de la spec).
--       Conservés de la migration 001 : microsite_ready, refused (absents de
--       la spec mais pertinents : microsite_ready matérialise l'étape J8,
--       refused distingue un refus initial d'un deal lost après négociation).
--
--   D3) outreach_campagnes n'est pas renommée en campagnes. Raison : la
--       migration 001 a déjà posé outreach_campagnes avec ses FK et index,
--       et des codes de référence côté front peuvent déjà s'appuyer dessus.
--       Pas de renommage tant que Mehdi ne tranche pas explicitement.
--
--   D4) microsites : on garde les colonnes pré-existantes (nb_vues,
--       nb_clics_rdv, titre, sous_titre, echeance_aper, echeance_dec_tert,
--       video_url) ET on ajoute celles de la spec (visits, first_visit_at,
--       last_visit_at, cta_clicked, cta_clicked_at). Il y a un doublon
--       logique nb_vues/visits que Mehdi devra trancher à la review. On
--       n'en supprime aucune pour ne rien casser.
-- =============================================================================

BEGIN;

-- =============================================================================
-- TABLE : prospects
-- =============================================================================

-- Ajouts de colonnes
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS code_insee text;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS nb_etages integer;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS siret_proprietaire text;
ALTER TABLE prospects ADD COLUMN IF NOT EXISTS score integer
  CHECK (score IS NULL OR (score >= 0 AND score <= 100));

COMMENT ON COLUMN prospects.code_insee        IS 'Code INSEE commune (5 chiffres) — utilisé pour requêter IGN et BDNB';
COMMENT ON COLUMN prospects.nb_etages         IS 'Nombre d''étages du bâtiment si disponible BDNB';
COMMENT ON COLUMN prospects.siret_proprietaire IS 'SIRET du propriétaire (14 chiffres)';
COMMENT ON COLUMN prospects.score             IS 'Score de priorité 0-100 (cf. barème dans schema_db_prospects.md §score)';

-- Renommage pour aligner la nomenclature sur la spec
ALTER TABLE prospects RENAME COLUMN source_donnee TO source;

-- Refonte du CHECK sur statut (union spec + migration 001 — cf. D2)
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_statut_check;
ALTER TABLE prospects ADD CONSTRAINT prospects_statut_check CHECK (
  statut IN (
    'new',
    'enriched',
    'solar_calculated',
    'microsite_ready',
    'outreach_sent',
    'opened',
    'replied',
    'meeting_booked',
    'qualified',
    'client',
    'lost',
    'refused',
    'unsubscribed'
  )
);

-- Index additionnels (cf. schema_db_prospects.md §Relations et contraintes)
CREATE INDEX IF NOT EXISTS idx_prospects_code_insee
  ON prospects(code_insee);
CREATE INDEX IF NOT EXISTS idx_prospects_statut_score
  ON prospects(statut, score DESC);
CREATE INDEX IF NOT EXISTS idx_prospects_siren_notnull
  ON prospects(siren_proprietaire)
  WHERE siren_proprietaire IS NOT NULL;

-- =============================================================================
-- TABLE : calculs_solaires
-- =============================================================================

-- Ajouts de colonnes
ALTER TABLE calculs_solaires ADD COLUMN IF NOT EXISTS nb_panneaux_retenus integer
  CHECK (nb_panneaux_retenus IS NULL OR nb_panneaux_retenus >= 0);
ALTER TABLE calculs_solaires ADD COLUMN IF NOT EXISTS cout_kwc_eur numeric(8,0);
ALTER TABLE calculs_solaires ADD COLUMN IF NOT EXISTS economie_20ans_eur numeric(12,0);
ALTER TABLE calculs_solaires ADD COLUMN IF NOT EXISTS tarif_oa_surplus_eur_kwh numeric(6,4);
ALTER TABLE calculs_solaires ADD COLUMN IF NOT EXISTS revenu_surplus_an_eur numeric(10,0);
ALTER TABLE calculs_solaires ADD COLUMN IF NOT EXISTS co2_evite_tonnes_an numeric(6,2);

COMMENT ON COLUMN calculs_solaires.nb_panneaux_retenus     IS 'Nb de panneaux après filtre 70% best yearlyEnergyDcKwh (cf. guide §6.3)';
COMMENT ON COLUMN calculs_solaires.cout_kwc_eur            IS 'Coût au kWc utilisé pour l''estimation';
COMMENT ON COLUMN calculs_solaires.economie_20ans_eur      IS 'Économie cumulée 20 ans (autoconsommation + surplus)';
COMMENT ON COLUMN calculs_solaires.tarif_oa_surplus_eur_kwh IS 'Tarif EDF OA applicable au surplus (grille CSV tarifs_OA_2026)';
COMMENT ON COLUMN calculs_solaires.revenu_surplus_an_eur   IS 'Revenu annuel estimé sur le surplus revendu';
COMMENT ON COLUMN calculs_solaires.co2_evite_tonnes_an     IS 'Tonnes CO2 évitées par an (indicateur RSE)';

-- Renommages pour aligner sur la spec
ALTER TABLE calculs_solaires RENAME COLUMN production_annuelle_kwh TO production_kwh_an;
ALTER TABLE calculs_solaires RENAME COLUMN image_satellite_url   TO satellite_image_url;
ALTER TABLE calculs_solaires RENAME COLUMN image_overlay_url     TO overlay_svg_url;

-- =============================================================================
-- TABLE : outreach_contacts
-- =============================================================================

-- Ajouts critiques pour la cascade de ciblage (J6)
ALTER TABLE outreach_contacts ADD COLUMN IF NOT EXISTS rang_ciblage integer
  NOT NULL DEFAULT 1
  CHECK (rang_ciblage BETWEEN 1 AND 5);
ALTER TABLE outreach_contacts ADD COLUMN IF NOT EXISTS actif boolean
  NOT NULL DEFAULT true;

COMMENT ON COLUMN outreach_contacts.rang_ciblage IS '1=propriétaire-dirigeant, 2=dir.immo, 3=DAF, 4=RSE, 5=DG';
COMMENT ON COLUMN outreach_contacts.actif        IS 'Contact sélectionné pour l''outreach';

-- Unicité de l'email pro (spec L111 : "email_pro est UNIQUE")
-- Les NULL ne sont pas uniqués par Postgres (SQL standard), ok.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'outreach_contacts_email_pro_key'
  ) THEN
    ALTER TABLE outreach_contacts ADD CONSTRAINT outreach_contacts_email_pro_key
      UNIQUE (email_pro);
  END IF;
END $$;

-- Index composite pour la requête fréquente "contacts d'un prospect triés par rang"
CREATE INDEX IF NOT EXISTS idx_contacts_prospect_rang
  ON outreach_contacts(prospect_id, rang_ciblage);

-- =============================================================================
-- TABLE : outreach_emails
-- =============================================================================

-- Ajout de la colonne sequence_step (spec L131 : étapes 0, 3, 5)
ALTER TABLE outreach_emails ADD COLUMN IF NOT EXISTS sequence_step integer
  CHECK (sequence_step IS NULL OR sequence_step IN (0, 3, 5));
ALTER TABLE outreach_emails ADD COLUMN IF NOT EXISTS bounced boolean
  NOT NULL DEFAULT false;
ALTER TABLE outreach_emails ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

COMMENT ON COLUMN outreach_emails.sequence_step    IS 'Étape de la séquence email : 0=initial, 3=relance J+3, 5=relance J+5';
COMMENT ON COLUMN outreach_emails.bounced          IS 'Email rejeté par le serveur destinataire';
COMMENT ON COLUMN outreach_emails.unsubscribed_at  IS 'Date de désinscription via lien unsubscribe';

-- Renommages pour aligner sur la spec
ALTER TABLE outreach_emails RENAME COLUMN envoye_at  TO sent_at;
ALTER TABLE outreach_emails RENAME COLUMN ouvert_at  TO opened_at;
ALTER TABLE outreach_emails RENAME COLUMN clique_at  TO clicked_at;
ALTER TABLE outreach_emails RENAME COLUMN repondu_at TO replied_at;

-- Index composite pour la requête "emails d'un prospect par étape de séquence"
CREATE INDEX IF NOT EXISTS idx_emails_prospect_step
  ON outreach_emails(prospect_id, sequence_step);

-- =============================================================================
-- TABLE : outreach_campagnes
-- =============================================================================

-- D3 : on NE renomme pas en 'campagnes' (cf. en-tête du fichier).
ALTER TABLE outreach_campagnes ADD COLUMN IF NOT EXISTS region_pilote text;
COMMENT ON COLUMN outreach_campagnes.region_pilote IS 'Région pilote ciblée pour la campagne (cf. 01_specs/region_pilote.md à venir J3)';

-- =============================================================================
-- TABLE : microsites
-- =============================================================================

-- Ajouts de colonnes de la spec (doublon partiel avec nb_vues / nb_clics_rdv — cf. D4)
ALTER TABLE microsites ADD COLUMN IF NOT EXISTS visits integer
  NOT NULL DEFAULT 0;
ALTER TABLE microsites ADD COLUMN IF NOT EXISTS first_visit_at timestamptz;
ALTER TABLE microsites ADD COLUMN IF NOT EXISTS last_visit_at timestamptz;
ALTER TABLE microsites ADD COLUMN IF NOT EXISTS cta_clicked boolean
  NOT NULL DEFAULT false;
ALTER TABLE microsites ADD COLUMN IF NOT EXISTS cta_clicked_at timestamptz;

COMMENT ON COLUMN microsites.visits          IS 'Compteur de visites (doublon à trancher avec nb_vues — review J2)';
COMMENT ON COLUMN microsites.first_visit_at  IS 'Horodatage de la première visite';
COMMENT ON COLUMN microsites.last_visit_at   IS 'Horodatage de la dernière visite';
COMMENT ON COLUMN microsites.cta_clicked     IS 'True si le CTA Cal.com a été cliqué au moins une fois';
COMMENT ON COLUMN microsites.cta_clicked_at  IS 'Horodatage du premier clic sur le CTA Cal.com';

COMMIT;

-- =============================================================================
-- FIN DE MIGRATION 002
-- =============================================================================
-- Vérifications post-application à lancer manuellement dans Supabase SQL Editor :
--
--   -- Colonnes ajoutées à prospects
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'prospects' AND column_name IN
--     ('code_insee','nb_etages','siret_proprietaire','score','source');
--
--   -- Nouvelle contrainte statut
--   SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint WHERE conname = 'prospects_statut_check';
--
--   -- Index composite prospects
--   SELECT indexname FROM pg_indexes
--   WHERE tablename = 'prospects' AND indexname = 'idx_prospects_statut_score';
--
-- Ensuite regénérer les types TypeScript :
--   npx supabase gen types typescript --project-id hltcwkcmrwnyehsbrwdx
--     > 04_code/src/types/database.ts
-- =============================================================================
