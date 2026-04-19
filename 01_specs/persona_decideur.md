# Personas décideurs — ERE SOLAR BOT

> Cible : propriétaires et gestionnaires de bâtiments tertiaires/industriels > 500 m² en France
> Usage : alimentation du prompt email Claude API + scoring prospects + personnalisation micro-site

---

## Persona A — Le DAF / Directeur Immobilier de PME-ETI

**Nom fictif :** Jean-Pierre M.
**Titre :** DAF ou Directeur Immobilier
**Entreprise :** PME industrielle ou tertiaire, 50-500 salariés, CA 10-100 M€
**Bâtiment :** bureaux ou entrepôt, 1 000-5 000 m², propriétaire ou bail emphytéotique
**Âge :** 45-60 ans

### Contexte décisionnel
- Décide seul ou en comité de direction (2-3 personnes)
- Budget capex soumis à validation du DG
- Cycle de décision : 3-6 mois
- A déjà reçu 5-10 sollicitations d'installateurs solaires → méfiant

### Douleurs prioritaires
1. Obligation décret tertiaire -40% en 2030 — ne sait pas comment l'atteindre
2. Facture énergie qui a triplé depuis 2020 — pression du DG
3. Reçoit des courriers de la préfecture sur OPERAT — stress administratif
4. A peur de se tromper d'installateur (arnaques PV perçues)

### Déclencheurs d'action
- Réception d'un document personnalisé sur SON bâtiment (pas un PDF générique)
- Chiffres vérifiables par une source tierce (Google Solar API)
- Mention de l'obligation légale avec une échéance précise
- Interlocuteur crédible (architecte, pas commercial)

### Message clé
> "Votre bâtiment au [adresse] est soumis au décret tertiaire. Voici une étude gratuite montrant [X] panneaux, [Y] kWc, [Z]€ d'économies/an — réalisée par satellite, sans visite."

### Variables email
`{prenom}`, `{nom_entreprise}`, `{adresse}`, `{surface_m2}`, `{annee_construction}`, `{nb_panneaux}`, `{puissance_kwc}`, `{economies_an}`, `{economies_20ans}`, `{url_microsite}`

---

## Persona B — Le Directeur de Patrimoine / Asset Manager

**Nom fictif :** Caroline D.
**Titre :** Directeur de Patrimoine, Asset Manager, Head of Real Estate
**Entreprise :** Foncière, SCPI, family office, REIT, 5-50 bâtiments en portefeuille
**Bâtiment :** parc logistique, centres commerciaux, entrepôts, bureaux multi-sites
**Âge :** 35-50 ans

### Contexte décisionnel
- Gère un portefeuille — raisonne en volume, pas en bâtiment unique
- Cherche des solutions réplicables et scalables
- Reporting ESG aux investisseurs / LPs
- Cycle de décision : 6-12 mois, mais peut accélérer si obligation réglementaire

### Douleurs prioritaires
1. Obligation APER parkings > 10 000 m² — échéance juillet 2026 (imminent)
2. Pression ESG des investisseurs — score GRESB à améliorer
3. Gérer N installateurs sur N sites → veut un interlocuteur unique
4. Valorisation du patrimoine : DPE, certification BREEAM/HQE

### Déclencheurs d'action
- Tableau récapitulatif multi-sites (pas site par site)
- ROI consolidé sur le portefeuille
- Mention des échéances APER avec amendes (20 000 €/infraction)
- Proposition de déploiement industrialisé (pipeline automatisé)

### Message clé
> "Nous avons analysé [N] bâtiments de votre portefeuille [nom foncière]. [X] sont soumis à l'obligation APER d'ici juillet 2026. Voici les chiffres site par site."

---

## Persona C — Le Directeur RSE / Sustainability Manager

**Nom fictif :** Sophie L.
**Titre :** Directrice RSE, Chief Sustainability Officer, Responsable Développement Durable
**Entreprise :** ETI ou Grande Entreprise, 500+ salariés
**Bâtiment :** siège social, campus tertiaire, 5 000-20 000 m²
**Âge :** 30-45 ans

### Contexte décisionnel
- N'a pas le budget directement — doit convaincre le DAF et le DG
- A besoin d'un dossier clé en main pour défendre le projet en interne
- Sensibilisée au sujet mais manque de données chiffrées fiables
- Cycle de décision : 6-9 mois (passage en comité)

### Douleurs prioritaires
1. Objectifs carbone internes à atteindre (plan climat, Scope 2)
2. Rapport RSE annuel — besoin de projets concrets à afficher
3. Décret tertiaire : elle est la référente OPERAT mais pas décisionnaire
4. Communication interne : les salariés demandent des actions visibles

### Déclencheurs d'action
- Dossier technique prêt à présenter au comité de direction
- Calcul d'impact carbone (tonnes CO₂ évitées)
- Comparaison avec des bâtiments similaires déjà équipés
- Crédibilité de la source (architecte, données satellite)

### Message clé
> "Votre siège au [adresse] peut produire [Y] kWc, soit [T] tonnes de CO₂ évitées par an. Voici un dossier prêt à présenter à votre direction."

---

## Persona D — Le Gérant de SCI / Propriétaire Direct

**Nom fictif :** Ahmed B.
**Titre :** Gérant, Dirigeant, CEO
**Entreprise :** SCI patrimoniale, PME familiale, TPE
**Bâtiment :** local commercial, atelier, entrepôt, 500-2 000 m²
**Âge :** 40-65 ans

### Contexte décisionnel
- Décide seul et vite (1-3 mois)
- Très sensible au ROI et au temps de retour sur investissement
- Pas de service immobilier ni RSE — il fait tout
- Confiance = relation humaine, pas un outil en ligne

### Douleurs prioritaires
1. Facture énergie en hausse — impact direct sur la marge
2. Pas au courant des obligations (décret tertiaire, APER)
3. Sollicité par des commerciaux agressifs → méfiant
4. Pas de temps pour étudier le sujet lui-même

### Déclencheurs d'action
- Mail court, direct, chiffré (économie annuelle + ROI)
- Mention qu'il n'y a RIEN à payer pour l'étude
- Le fait que ce soit personnalisé sur SON bâtiment
- Ton conseil (architecte), pas commercial

### Message clé
> "M. [nom], votre bâtiment au [adresse] pourrait vous faire économiser [Z]€/an grâce au solaire. Étude gratuite, aucun engagement — 15 min au téléphone suffisent."

---

## Hiérarchie de ciblage (cascade enrichissement)

Quand on identifie un bâtiment, chercher le décideur dans cet ordre :

1. **Propriétaire-dirigeant** (gérant SCI, CEO PME) → Persona D
2. **Directeur immobilier / patrimoine** → Persona A ou B
3. **DAF** → Persona A
4. **Directeur RSE** → Persona C
5. **DG / Président** → fallback si aucun profil spécialisé trouvé

Cette hiérarchie guide la cascade Pappers → Dropcontact dans le module enrichissement.

---

## Anti-personas (à exclure du pipeline)

| Profil | Raison d'exclusion |
|--------|-------------------|
| Particuliers / résidences principales | MaPrimeRénov', pas notre marché |
| Bâtiments < 500 m² | ROI trop faible, pas de volume |
| Locataires sans accord propriétaire | Pas décisionnaire travaux |
| Bâtiments classés / monuments historiques | Contraintes ABF, très long |
| Collectivités / mairies | Marchés publics, hors scope v1 |
| Bâtiments déjà équipés PV | Pas de besoin |

---

*Document rédigé le 20 avril 2026 — Sprint MVP v1*
