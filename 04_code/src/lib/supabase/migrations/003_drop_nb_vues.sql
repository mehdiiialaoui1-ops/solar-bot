-- =============================================================================
-- ERE SOLAR BOT - Migration 003 : DROP COLUMN nb_vues sur microsites
-- =============================================================================
-- Suite a la review PR #1 (Mehdi 2026-04-26), decision D4 :
--   Le doublon nb_vues / visits dans la table microsites doit etre nettoye.
--   La colonne `visits` (NOT NULL DEFAULT 0) ajoutee en migration 002 remplace
--   la colonne `nb_vues` (NULLABLE DEFAULT 0) heritee de la migration 001.
--
-- Decision : on supprime `nb_vues` definitivement. Les fonctions analytics
-- consommeront uniquement `visits` desormais.
--
-- NB : la colonne `nb_clics_rdv` est CONSERVEE (elle compte les clics RDV,
-- ce n'est pas un doublon de cta_clicked qui est un booleen).
--
-- Risque : 0 - la table microsites est vide en prod au moment de l'ALTER.
-- Aucune dependance (FK, trigger, rule, vue materialisee) sur nb_vues.
-- =============================================================================

ALTER TABLE public.microsites DROP COLUMN IF EXISTS nb_vues;

COMMENT ON COLUMN public.microsites.visits IS
  'Compteur de visites du microsite. Remplace l''ancienne colonne nb_vues (DROP en migration 003).';
