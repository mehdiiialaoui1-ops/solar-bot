# Schéma DB — ERE SOLAR BOT

> Schéma conceptuel de la base de données Supabase (PostgreSQL)
> Ce document sert de référence pour Youssef → migration SQL Supabase
> Point ⚡ SYNC J2 : Mehdi valide ce schéma vs. l'implémentation

---

## Architecture générale

```
prospects (bâtiment)
  ├── calculs_solaires (1:1 — un calcul par prospect)
  ├── outreach_contacts (1:N — plusieurs décideurs possibles)
  ├── outreach_emails (1:N — séquence de 3 emails)
  └── microsites (1:1 — un micro-site par prospect)
```

---

## Table `prospects` — Bâtiment identifié

Colonne centrale du pipeline. Chaque ligne = un bâtiment tertiaire/industriel.

| Colonne | Type | Nullable | Default | Index | Description |
|---------|------|----------|---------|-------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK | Identifiant unique |
| `adresse` | text | NOT NULL | — | — | Adresse complète du bâtiment |
| `code_postal` | text | NOT NULL | — | idx | Code postal (5 chiffres) |
| `commune` | text | NOT NULL | — | — | Nom de la commune |
| `code_insee` | text | NULL | — | idx | Code INSEE commune (5 chiffres) |
| `lat` | double precision | NOT NULL | — | — | Latitude GPS |
| `lng` | double precision | NOT NULL | — | — | Longitude GPS |
| `parcelle_id` | text | NULL | — | UNIQUE | Identifiant cadastral (ex: 13055000AB0123) |
| `surface_m2` | numeric | NOT NULL | — | — | Surface au sol en m² |
| `usage` | text | NOT NULL | — | idx | Usage principal : tertiaire, industriel, commercial, logistique |
| `annee_construction` | integer | NULL | — | — | Année de construction (si disponible BDNB) |
| `nb_etages` | integer | NULL | — | — | Nombre d'étages (si disponible) |
| `siren_proprietaire` | text | NULL | — | idx | SIREN du propriétaire (9 chiffres) |
| `siret_proprietaire` | text | NULL | — | — | SIRET du propriétaire (14 chiffres) |
| `raison_sociale` | text | NULL | — | — | Nom de l'entreprise propriétaire |
| `statut` | text | NOT NULL | `'new'` | idx | Statut pipeline (voir enum ci-dessous) |
| `score` | integer | NULL | — | idx | Score de priorité (0-100, calculé) |
| `source` | text | NOT NULL | `'bdnb'` | — | Source de la donnée : bdnb, cadastre_ign, manuel |
| `created_at` | timestamptz | NOT NULL | `now()` | — | Date de création |
| `updated_at` | timestamptz | NULL | — | — | Dernière modification |

### Valeurs de `statut`
```
new → enriched → solar_calculated → outreach_sent → opened → replied → meeting_booked → qualified → client
                                                                                                    → lost
                                                                                        → unsubscribed
```

### Calcul du `score` (0-100)
| Critère | Points |
|---------|--------|
| Surface > 2 000 m² | +20 |
| Surface > 5 000 m² | +30 |
| Année construction < 2000 | +15 |
| Obligation APER (parking > 1 500 m²) | +25 |
| Décret tertiaire (surface > 1 000 m²) | +20 |
| Dirigeant email vérifié | +10 |
| SIREN trouvé | +5 |

---

## Table `calculs_solaires` — Résultats analyse solaire

Un calcul par prospect. Stocke les résultats Google Solar API + calculs économiques.

| Colonne | Type | Nullable | Default | Index | Description |
|---------|------|----------|---------|-------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK | |
| `prospect_id` | uuid | NOT NULL | — | FK UNIQUE | Réf. vers `prospects.id` |
| `nb_panneaux_max` | integer | NOT NULL | — | — | Nb panneaux total Google Solar |
| `nb_panneaux_retenus` | integer | NOT NULL | — | — | Nb panneaux après filtre 70% |
| `puissance_kwc` | numeric(8,2) | NOT NULL | — | — | Puissance crête kWc |
| `production_kwh_an` | numeric(10,0) | NOT NULL | — | — | Production annuelle estimée kWh |
| `surface_toiture_utile_m2` | numeric(8,1) | NULL | — | — | Surface de toiture exploitable |
| `azimut_deg` | numeric(5,1) | NULL | — | — | Orientation principale (°) |
| `inclinaison_deg` | numeric(4,1) | NULL | — | — | Inclinaison du pan principal (°) |
| `cout_installation_eur` | numeric(10,0) | NOT NULL | — | — | Estimation coût total HT |
| `cout_kwc_eur` | numeric(6,0) | NOT NULL | — | — | Coût au kWc utilisé pour le calcul |
| `economie_annuelle_eur` | numeric(10,0) | NOT NULL | — | — | Économie annuelle (autoconsommation) |
| `economie_20ans_eur` | numeric(10,0) | NOT NULL | — | — | Économie cumulée 20 ans |
| `retour_investissement_ans` | numeric(4,1) | NOT NULL | — | — | ROI en années |
| `prime_autoconsommation_eur` | numeric(8,0) | NULL | — | — | Prime autoconso si < 100 kWc |
| `tarif_oa_surplus_eur_kwh` | numeric(6,4) | NULL | — | — | Tarif OA surplus applicable |
| `revenu_surplus_an_eur` | numeric(8,0) | NULL | — | — | Revenu surplus annuel estimé |
| `co2_evite_tonnes_an` | numeric(6,2) | NULL | — | — | Tonnes CO₂ évitées par an |
| `obligation_aper` | boolean | NOT NULL | `false` | — | Soumis à obligation APER |
| `obligation_decret_tertiaire` | boolean | NOT NULL | `false` | — | Soumis au décret tertiaire |
| `satellite_image_url` | text | NULL | — | — | URL Supabase Storage image satellite |
| `overlay_svg_url` | text | NULL | — | — | URL Supabase Storage overlay SVG |
| `source_api` | text | NOT NULL | `'google_solar'` | — | Source : google_solar, pvgis, manuel |
| `created_at` | timestamptz | NOT NULL | `now()` | — | |

---

## Table `outreach_contacts` — Décideurs identifiés

Plusieurs contacts possibles par prospect (cascade de ciblage).

| Colonne | Type | Nullable | Default | Index | Description |
|---------|------|----------|---------|-------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK | |
| `prospect_id` | uuid | NOT NULL | — | FK | Réf. vers `prospects.id` |
| `prenom` | text | NOT NULL | — | — | Prénom du contact |
| `nom` | text | NOT NULL | — | — | Nom du contact |
| `titre` | text | NULL | — | — | Titre/fonction (DG, DAF, Dir. Immobilier, etc.) |
| `email_pro` | text | NULL | — | UNIQUE | Email professionnel |
| `email_verifie` | boolean | NOT NULL | `false` | — | Email vérifié par Dropcontact |
| `telephone_pro` | text | NULL | — | — | Téléphone professionnel |
| `linkedin_url` | text | NULL | — | — | URL profil LinkedIn |
| `source` | text | NOT NULL | `'pappers'` | — | Source : pappers, dropcontact, sirene, manuel |
| `rang_ciblage` | integer | NOT NULL | `1` | — | 1=propriétaire-dirigeant, 2=dir.immo, 3=DAF, 4=RSE, 5=DG |
| `actif` | boolean | NOT NULL | `true` | — | Contact sélectionné pour l'outreach |
| `created_at` | timestamptz | NOT NULL | `now()` | — | |

---

## Table `outreach_emails` — Emails envoyés

Tracking de chaque email de la séquence (J0, J+3, J+5).

| Colonne | Type | Nullable | Default | Index | Description |
|---------|------|----------|---------|-------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK | |
| `prospect_id` | uuid | NOT NULL | — | FK | Réf. vers `prospects.id` |
| `contact_id` | uuid | NOT NULL | — | FK | Réf. vers `outreach_contacts.id` |
| `sequence_step` | integer | NOT NULL | — | — | Étape de la séquence : 0, 3, 5 |
| `sujet` | text | NOT NULL | — | — | Objet de l'email |
| `corps_html` | text | NOT NULL | — | — | Corps de l'email (HTML) |
| `lemlist_lead_id` | text | NULL | — | — | ID Lemlist pour tracking |
| `sent_at` | timestamptz | NULL | — | — | Date d'envoi |
| `opened_at` | timestamptz | NULL | — | — | Première ouverture |
| `clicked_at` | timestamptz | NULL | — | — | Premier clic (lien micro-site) |
| `replied_at` | timestamptz | NULL | — | — | Date de réponse |
| `bounced` | boolean | NOT NULL | `false` | — | Email en bounce |
| `unsubscribed_at` | timestamptz | NULL | — | — | Date de désinscription |
| `created_at` | timestamptz | NOT NULL | `now()` | — | |

---

## Table `microsites` — Pages personnalisées

Un micro-site par prospect.

| Colonne | Type | Nullable | Default | Index | Description |
|---------|------|----------|---------|-------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK | |
| `prospect_id` | uuid | NOT NULL | — | FK UNIQUE | Réf. vers `prospects.id` |
| `slug` | text | NOT NULL | — | UNIQUE | Slug URL unique (ex: `abc123def`) |
| `url` | text | NOT NULL | — | — | URL complète du micro-site |
| `visits` | integer | NOT NULL | `0` | — | Nombre de visites |
| `first_visit_at` | timestamptz | NULL | — | — | Première visite |
| `last_visit_at` | timestamptz | NULL | — | — | Dernière visite |
| `cta_clicked` | boolean | NOT NULL | `false` | — | CTA Cal.com cliqué |
| `cta_clicked_at` | timestamptz | NULL | — | — | Date du clic CTA |
| `created_at` | timestamptz | NOT NULL | `now()` | — | |

---

## Table `campagnes` — Campagnes d'outreach

Gestion des campagnes Lemlist.

| Colonne | Type | Nullable | Default | Index | Description |
|---------|------|----------|---------|-------|-------------|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK | |
| `nom` | text | NOT NULL | — | — | Nom de la campagne |
| `statut` | text | NOT NULL | `'draft'` | — | draft, active, paused, completed |
| `lemlist_campaign_id` | text | NULL | — | — | ID campagne Lemlist |
| `nb_prospects` | integer | NOT NULL | `0` | — | Total prospects dans la campagne |
| `nb_envoyes` | integer | NOT NULL | `0` | — | Emails envoyés |
| `nb_ouverts` | integer | NOT NULL | `0` | — | Emails ouverts |
| `nb_cliques` | integer | NOT NULL | `0` | — | Clics micro-site |
| `nb_reponses` | integer | NOT NULL | `0` | — | Réponses reçues |
| `nb_rdv` | integer | NOT NULL | `0` | — | RDV bookés |
| `region_pilote` | text | NULL | — | — | Région pilote ciblée |
| `created_at` | timestamptz | NOT NULL | `now()` | — | |

---

## Relations et contraintes

```sql
-- Foreign keys
ALTER TABLE calculs_solaires ADD CONSTRAINT fk_calculs_prospect
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE;

ALTER TABLE outreach_contacts ADD CONSTRAINT fk_contacts_prospect
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE;

ALTER TABLE outreach_emails ADD CONSTRAINT fk_emails_prospect
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE;

ALTER TABLE outreach_emails ADD CONSTRAINT fk_emails_contact
  FOREIGN KEY (contact_id) REFERENCES outreach_contacts(id) ON DELETE CASCADE;

ALTER TABLE microsites ADD CONSTRAINT fk_microsites_prospect
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE;

-- Index composites pour les requêtes fréquentes
CREATE INDEX idx_prospects_statut_score ON prospects(statut, score DESC);
CREATE INDEX idx_prospects_code_postal ON prospects(code_postal);
CREATE INDEX idx_prospects_siren ON prospects(siren_proprietaire) WHERE siren_proprietaire IS NOT NULL;
CREATE INDEX idx_contacts_prospect ON outreach_contacts(prospect_id, rang_ciblage);
CREATE INDEX idx_emails_prospect ON outreach_emails(prospect_id, sequence_step);
```

---

## Row Level Security (RLS)

```sql
-- En v1 (mono-tenant) : pas de RLS complexe
-- Accès via service_role uniquement (back-end)
-- En v2 (multi-tenant marque blanche) : RLS par installateur

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculs_solaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE microsites ENABLE ROW LEVEL SECURITY;

-- Policy v1 : service_role a accès à tout
CREATE POLICY "service_role_all" ON prospects FOR ALL
  USING (auth.role() = 'service_role');
-- Idem pour les autres tables
```

---

## Notes pour Youssef

1. **Toutes les colonnes `_eur` sont en euros HT** (pas de centimes, pas de TTC)
2. **`parcelle_id` est UNIQUE** — un même bâtiment ne peut pas être inséré deux fois
3. **`outreach_contacts.email_pro` est UNIQUE** — pas de doublon d'email dans la base
4. **ON DELETE CASCADE** partout — si on supprime un prospect, tout suit (RGPD)
5. **`microsites.slug`** : générer un slug aléatoire de 8 caractères (base62) — pas le nom de l'entreprise
6. **Supabase Storage** : créer un bucket `satellite-images` et un bucket `overlay-svgs`
7. **Les colonnes `_at`** sont toutes en UTC (timestamptz)

---

*Document rédigé le 20 avril 2026 — Sprint MVP v1 — Point ⚡ SYNC J2*
