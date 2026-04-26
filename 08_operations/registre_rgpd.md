# Registre RGPD — ERE SOLAR BOT

> Conformément à l'article 30 du RGPD (Règlement UE 2016/679)
> Responsable de traitement : ERE Experts — Mehdi Alaoui
> DPO : rgpd@ere-experts.fr
> Dernière mise à jour : 26 avril 2026

---

## 1. Traitement T-01 — Sourcing de bâtiments tertiaires/industriels

**Finalité :** Constituer une base de bâtiments tertiaires et industriels > 500 m² concernés par les obligations de solarisation (loi APER, décret tertiaire).

**Base légale :** Intérêt légitime (article 6.1.f RGPD) — les données collectées sont exclusivement publiques (cadastre, registre du commerce).

**Catégories de données :**

- Données du bâtiment : adresse, code postal, commune, code INSEE, coordonnées GPS, parcelle cadastrale, surface au sol, usage, année de construction — *source : Cadastre IGN, BDNB CSTB*
- Données du propriétaire : SIREN, SIRET, raison sociale — *source : registre SIRENE (données publiques)*

**Note :** Ce traitement ne collecte aucune donnée personnelle au sens strict. Les données SIREN/SIRET sont des identifiants d'entreprise, pas de personne physique. Les coordonnées GPS et surfaces sont des données cadastrales publiques.

**Durée de conservation :** Tant que le bâtiment existe dans la base active. Suppression des prospects inactifs (statut `new` sans traitement) après 12 mois.

---

## 2. Traitement T-02 — Enrichissement des décideurs

**Finalité :** Identifier les dirigeants et responsables immobiliers des entreprises propriétaires pour les contacter dans le cadre d'une prospection B2B.

**Base légale :** Intérêt légitime (article 6.1.f RGPD) — prospection B2B auprès de professionnels dans le cadre de leur fonction, conformément à la doctrine CNIL sur la prospection B2B.

**Catégories de données :**

- Identité professionnelle : nom, prénom, titre/fonction — *source : Pappers (extrait K-bis public)*
- Contact professionnel : email professionnel, téléphone professionnel — *source : Dropcontact (enrichissement conforme RGPD)*
- Profil LinkedIn : URL profil public — *source : Dropcontact*

**Conditions de conformité :**

- Seuls les emails professionnels sont collectés (jamais d'email personnel @gmail, @hotmail, etc.)
- L'enrichissement est réalisé par Dropcontact, prestataire français certifié conforme RGPD
- Les données proviennent exclusivement de sources publiques professionnelles
- Aucune collecte de données sensibles (santé, opinions, religion, etc.)

**Durée de conservation :**

| Statut prospect | Durée | Action |
|----------------|-------|--------|
| Jamais contacté | 6 mois après collecte | Suppression automatique |
| Contacté, sans réponse | 3 ans après dernier contact | Suppression automatique |
| Désabonné (unsubscribed) | Suppression sous 72h | Email conservé en liste noire (anti-recontact) |
| Refus explicite (refused) | Suppression sous 30 jours | Email conservé en liste noire |
| Client actif | Durée de la relation | Passage en T-04 |
| Ancien client | 5 ans après fin de contrat | Suppression |

---

## 3. Traitement T-03 — Prospection email automatisée

**Finalité :** Envoyer une séquence de 3 emails personnalisés (J0, J+3, J+5) présentant une étude solaire du bâtiment du prospect.

**Base légale :** Intérêt légitime (article 6.1.f RGPD) — prospection B2B. Le contenu est directement lié à l'activité professionnelle du destinataire (obligations réglementaires sur son bâtiment).

**Catégories de données traitées :**

- Données du traitement T-02 (identité + contact)
- Données du calcul solaire : nb panneaux, puissance kWc, économies estimées, prime autoconsommation
- Données de tracking email : date d'envoi, ouverture, clic, réponse, bounce, désinscription

**Sous-traitant :**

| Service | Rôle | Siège | Hébergement | DPA signé |
|---------|------|-------|-------------|-----------|
| Lemlist | Envoi email + tracking | France | UE | Oui (inclus CGU) |
| Claude API (Anthropic) | Génération du contenu email | USA | USA | Clauses contractuelles types |

**Garanties spécifiques :**

- Lien de désinscription obligatoire dans chaque email (footer)
- Traitement de la désinscription : automatique via webhook Lemlist → Supabase, délai < 1 heure
- Suppression effective des données sous 72h après désinscription
- Mention de la base légale et des droits dans chaque email (footer RGPD)
- Rotation des boîtes d'envoi : max 30 emails/jour/boîte
- Pas d'envoi le week-end ni en dehors des heures ouvrées

**Données transmises à Claude API (Anthropic) pour la génération email :**

- Variables pseudonymisées du prospect (prénom, nom entreprise, adresse bâtiment, chiffres solaires)
- Aucun numéro SIREN/SIRET transmis
- Aucun email ou téléphone transmis (seul le prénom est envoyé au LLM)
- Pas de stockage côté Anthropic (API stateless, opt-out training confirmé)

---

## 4. Traitement T-04 — Micro-sites personnalisés

**Finalité :** Héberger une page web personnalisée par prospect, présentant l'étude solaire de son bâtiment avec un CTA de prise de RDV.

**Base légale :** Intérêt légitime (article 6.1.f RGPD).

**Catégories de données affichées sur le micro-site :**

- Adresse du bâtiment, surface, année de construction
- Image satellite (Google Maps Static API)
- Données du calcul solaire (panneaux, kWc, économies, ROI)
- Prénom du contact (dans le lien Cal.com pré-rempli)

**Catégories de données collectées via le micro-site :**

- Données de navigation : visite (oui/non), date première/dernière visite, nombre de visites
- Clic CTA Cal.com : date du clic
- Aucun cookie tiers, aucun tracker publicitaire, aucun fingerprinting

**Mesures de protection :**

- URL non indexée (`noindex, nofollow`)
- Slug aléatoire de 8 caractères (pas de données identifiantes dans l'URL)
- Page accessible sans authentification (lien direct)
- Durée de vie : 30 jours après création, puis page désactivée
- Pas de formulaire de saisie sur le micro-site (le RDV se fait sur Cal.com)

---

## 5. Traitement T-05 — Prise de RDV Cal.com

**Finalité :** Permettre aux prospects intéressés de réserver un créneau d'échange avec ERE Experts.

**Base légale :** Mesures précontractuelles (article 6.1.b RGPD) — le prospect initie lui-même la démarche.

**Catégories de données :**

- Données pré-remplies via URL : prénom, nom, email (issus de T-02)
- Données saisies par le prospect : date/heure choisie, éventuellement message libre

**Sous-traitant :**

| Service | Rôle | Siège | DPA |
|---------|------|-------|-----|
| Cal.com | Gestion agenda | UE | Oui |

**Webhook Cal.com → Supabase :** à la confirmation du RDV, mise à jour automatique du statut prospect → `meeting_booked`.

---

## 6. Mesures de sécurité techniques et organisationnelles

### Infrastructure

| Composant | Fournisseur | Localisation | Chiffrement |
|-----------|-------------|-------------|-------------|
| Base de données | Supabase | UE (Frankfurt) | Au repos + en transit (TLS 1.2+) |
| Hébergement web | Vercel | Edge (CDN global) | TLS 1.2+ |
| Emails | Lemlist | France | TLS en transit |
| Images satellite | Supabase Storage | UE (Frankfurt) | Au repos |

### Contrôles d'accès

- Accès Supabase : token `service_role` côté back-end uniquement (jamais exposé côté client)
- Row Level Security (RLS) activé sur toutes les tables
- Pas d'accès direct à la base depuis le front-end en v1
- Accès admin : Mehdi + Youssef uniquement, authentification 2FA
- Logs d'accès conservés 12 mois

### Sécurité des emails

- DKIM + SPF + DMARC configurés sur ere-experts.fr
- Envoi via SMTP sécurisé (TLS)
- Rotation des domaines d'envoi pour la délivrabilité

---

## 7. Transferts hors UE

| Service | Pays | Données transférées | Garantie |
|---------|------|-------------------|----------|
| Supabase | UE (Frankfurt) | Toutes les données | Aucun transfert hors UE |
| Lemlist | France | Contacts + emails | Aucun transfert hors UE |
| Dropcontact | France | SIREN → enrichissement | Aucun transfert hors UE |
| Pappers | France | SIREN → dirigeants | Aucun transfert hors UE |
| Cal.com | UE | RDV + nom/email | Aucun transfert hors UE |
| Google Solar API | USA | Coordonnées GPS (pas de données perso) | Pas de données personnelles |
| Claude API (Anthropic) | USA | Prénom + données bâtiment (pseudonymisées) | Clauses contractuelles types |
| Vercel | CDN global | Pages web (données publiques affichées) | Clauses contractuelles types |

---

## 8. Droits des personnes — Procédures

### Canaux de demande

- Email : rgpd@ere-experts.fr
- Lien de désinscription dans chaque email
- Formulaire sur ere-experts.fr/rgpd (à créer)

### Procédure de traitement

| Demande | Délai | Action technique |
|---------|-------|-----------------|
| Accès (art. 15) | 30 jours | Export JSON des données du prospect depuis Supabase |
| Rectification (art. 16) | 30 jours | Mise à jour en base |
| Effacement (art. 17) | 72 heures | `DELETE FROM prospects WHERE id = ?` (cascade ON DELETE) |
| Opposition (art. 21) | 72 heures | Statut → `unsubscribed` + ajout en liste noire |
| Désinscription email | < 1 heure | Automatique via webhook Lemlist |
| Portabilité (art. 20) | 30 jours | Export CSV |

### Liste noire anti-recontact

Les emails des personnes ayant exercé leur droit d'opposition ou s'étant désinscrites sont conservés dans une table `blacklist_emails` (hash SHA-256 de l'email uniquement, pas l'email en clair) pour éviter tout recontact futur. Cette table n'est pas soumise à la suppression car elle sert à protéger les droits de la personne.

---

## 9. Analyse d'impact (AIPD) — Synthèse

Une AIPD complète n'est pas obligatoire pour ce traitement (pas de données sensibles, pas de profilage systématique, pas de surveillance à grande échelle). Néanmoins, les risques identifiés sont :

| Risque | Probabilité | Impact | Mesure |
|--------|------------|--------|--------|
| Fuite de la base prospects | Faible | Modéré | RLS + chiffrement + accès restreint |
| Recontact après opposition | Faible | Élevé | Liste noire hashée + webhook automatique |
| Email perçu comme spam | Modéré | Faible | Lien désinscription + base légale + contenu pertinent |
| Données obsolètes | Modéré | Faible | Purge automatique des prospects inactifs (12 mois) |
| Transfert USA (Claude API) | Faible | Faible | Données pseudonymisées, pas de stockage côté Anthropic |

---

## 10. Historique des modifications

| Date | Modification | Auteur |
|------|-------------|--------|
| 2026-04-13 | Création initiale (T-01, T-02) | ERE Experts |
| 2026-04-26 | Ajout traitements T-03 à T-05, procédures droits, AIPD, mesures de sécurité détaillées | ERE Experts |

---

*Ce registre est un document vivant. Il doit être mis à jour à chaque nouveau traitement de données personnelles ou changement de sous-traitant.*
