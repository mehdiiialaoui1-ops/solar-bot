# Registre RGPD — ERE SOLAR BOT

> Conformément à l'article 30 du RGPD (Règlement UE 2016/679)  
> Responsable de traitement : ERE Experts  
> DPO : contact@ere-experts.fr  
> Dernière mise à jour : avril 2026

---

## Traitement 1 — Prospection commerciale B2B

**Finalité :** Identifier et contacter des propriétaires de bâtiments tertiaires/industriels concernés par les obligations de solarisation.

**Base légale :** Intérêt légitime (article 6.1.f RGPD) — prospection B2B vers des professionnels dans le cadre de leur activité.

**Catégories de données :**
- Données d'identification : nom, prénom, titre professionnel
- Données de contact professionnelles : email pro, téléphone pro
- Données sur l'entreprise : SIREN, raison sociale, adresse du siège
- Données sur le bâtiment : adresse, surface, coordonnées GPS (données publiques cadastre)

**Sources :**
- Registre du commerce (SIRENE, Pappers) — données publiques
- Cadastre IGN + BDNB CSTB — données publiques
- Dropcontact — enrichissement email professionnel (conforme RGPD)

**Destinataires :**
- Équipe commerciale ERE Experts
- Outil d'envoi email (Lemlist — hébergé UE)
- Supabase EU (Frankfurt) — stockage

**Durée de conservation :**
- Prospects "non répondants" : 3 ans après dernier contact
- Prospects "refus définitif" : suppression dans les 30 jours
- Prospects "clients" : 5 ans après fin de contrat

**Droits des personnes :**
Toute demande d'accès, rectification, effacement ou opposition doit être adressée à contact@ere-experts.fr. Délai de réponse : 30 jours.

**Lien de désabonnement :** présent dans chaque email envoyé (footer obligatoire).

---

## Traitement 2 — Gestion des prospects et clients

**Finalité :** Suivi du pipeline commercial, gestion des rendez-vous, production des études solaires.

**Base légale :** Exécution du contrat (article 6.1.b) ou mesures précontractuelles.

**Catégories de données :**
- Données du traitement 1
- Échanges emails et comptes-rendus de rendez-vous
- Documents produits : études de faisabilité, simulations financières

**Durée de conservation :** 5 ans après fin de relation commerciale.

---

## Mesures de sécurité

- Accès Supabase : authentification par token avec Row Level Security activé
- Emails : envoi via SMTP sécurisé (TLS), rotation des domaines d'envoi
- Pas de stockage de mots de passe en clair (Supabase Auth)
- Logs d'accès conservés 12 mois
- Chiffrement au repos : activé sur Supabase EU Frankfurt

---

## Transferts hors UE

| Service | Pays | Garantie |
|---------|------|---------|
| Supabase | UE (Frankfurt) | Aucun transfert |
| Lemlist | France | Aucun transfert |
| Dropcontact | France | Aucun transfert |
| Google Solar API | USA | Clauses contractuelles types |
| Pappers | France | Aucun transfert |

---

## Historique des modifications

| Date | Modification | Auteur |
|------|-------------|--------|
| 2026-04 | Création initiale | ERE Experts |
