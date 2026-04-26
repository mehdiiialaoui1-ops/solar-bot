# Templates emails — Séquence outreach 3 étapes

> Séquence de 3 emails envoyés via Lemlist à J0, J+3, J+5.
> Chaque email est personnalisé par Claude API (Sonnet) à partir de ces templates + données prospect.
> Ce document sert de brief pour le prompt Claude API (J7) et la configuration Lemlist.

---

## Principes de rédaction

| Règle | Détail |
|-------|--------|
| Ton | Expert-conseil, pas commercial. Architecte qui informe, pas vendeur qui pousse. |
| Longueur | 80-120 mots max par email. Mobile-first. |
| Personnalisation | Chaque email mentionne l'adresse du bâtiment + au moins un chiffre spécifique (kWc, €, panneaux). |
| CTA | Un seul CTA par email, toujours le lien micro-site. Pas de pièce jointe. |
| Signature | "Mehdi Alaoui — Architecte DPLG, ERE Experts" (crédibilité : architecte, pas installateur). |
| Désinscription | Lien unsubscribe obligatoire en bas de chaque email (RGPD). |
| Objet | < 50 caractères, pas de majuscules abusives, pas d'emoji. |

---

## Variables dynamiques disponibles

Toutes les variables sont alimentées par la base Supabase (tables `prospects` + `calculs_solaires` + `outreach_contacts`).

```
{prenom}              — Prénom du contact (outreach_contacts.prenom)
{nom}                 — Nom du contact
{titre}               — Fonction du contact (DAF, DG, Dir. Immobilier…)
{nom_entreprise}      — Raison sociale (prospects.raison_sociale)
{adresse}             — Adresse complète du bâtiment
{commune}             — Nom de la commune
{surface_m2}          — Surface au sol en m²
{annee_construction}  — Année de construction
{nb_panneaux}         — Nombre de panneaux retenus
{puissance_kwc}       — Puissance crête en kWc
{production_kwh}      — Production annuelle estimée kWh
{economies_an}        — Économie annuelle en €
{economies_20ans}     — Économie cumulée sur 20 ans en €
{cout_installation}   — Coût estimé de l'installation HT
{retour_investissement} — Retour sur investissement en années
{prime_autoconso}     — Prime autoconsommation si applicable
{co2_evite}           — Tonnes CO₂ évitées par an
{url_microsite}       — URL du micro-site personnalisé
{obligation_aper}     — true/false
{obligation_decret}   — true/false
{jours_restants_2030} — Jours restants avant palier décret tertiaire 2030
```

---

## Email 1 — J0 : Premier contact

### Objectif
Capter l'attention en montrant qu'on a étudié SON bâtiment spécifiquement. Pas un email générique.

### Objet (3 variantes A/B testables)

- **A :** `{adresse} — étude solaire gratuite`
- **B :** `{nom_entreprise} : {puissance_kwc} kWc sur votre toiture`
- **C :** `Votre bâtiment à {commune} — potentiel solaire`

### Corps

```
Bonjour {prenom},

J'ai analysé par satellite la toiture de votre bâtiment au {adresse}.

Résultat : {nb_panneaux} panneaux, {puissance_kwc} kWc installables, soit {economies_an} € d'économies par an sur votre facture énergétique.

[SI obligation_decret = true]
Votre bâtiment de {surface_m2} m² est soumis au décret tertiaire : -40 % de consommation d'ici 2030. Le solaire couvre une part significative de cet objectif.
[/SI]

J'ai préparé une page dédiée avec l'étude complète, le détail des aides et la simulation financière :

→ Voir l'étude de votre bâtiment : {url_microsite}

Bonne lecture,

Mehdi Alaoui
Architecte DPLG — ERE Experts
Cabinet conseil en rénovation énergétique
```

### Notes techniques
- Envoi : mardi ou jeudi matin, 8h30-9h30
- Expéditeur : mehdi@ere-experts.fr (pas de no-reply)
- Reply-to : mehdi@ere-experts.fr
- Tracking : pixel ouverture + clic sur lien micro-site

---

## Email 2 — J+3 : Relance réglementaire

### Objectif
Appuyer sur l'urgence réglementaire (décret tertiaire / loi APER). Rappeler que l'étude existe déjà.

### Objet (3 variantes)

- **A :** `Décret tertiaire 2030 : {jours_restants_2030} jours restants`
- **B :** `{prenom}, votre étude solaire vous attend`
- **C :** `{surface_m2} m² de toiture inexploitée à {commune}`

### Corps

```
Bonjour {prenom},

Je reviens vers vous concernant l'étude solaire de votre bâtiment au {adresse}.

[SI obligation_decret = true]
En tant que bâtiment tertiaire de plus de 1 000 m², vous êtes soumis au décret tertiaire : réduction de 40 % des consommations énergétiques avant 2030 (déclaration OPERAT). Le non-respect expose à une amende de 7 500 €/an et surtout au « name & shame » (publication des mauvais élèves).

L'installation de {puissance_kwc} kWc que j'ai simulée couvrirait une partie significative de cet objectif, avec un retour sur investissement de {retour_investissement} ans.
[/SI]

[SI obligation_aper = true]
Par ailleurs, la loi APER impose la solarisation des parkings > 1 500 m². Votre site est potentiellement concerné.
[/SI]

L'étude complète est toujours accessible ici :

→ {url_microsite}

Si vous souhaitez en discuter, je suis disponible pour un échange de 15 min.

Mehdi Alaoui
Architecte DPLG — ERE Experts
```

### Notes techniques
- Envoi : 3 jours après Email 1, même créneau horaire
- Condition d'envoi : Email 1 non répondu ET non unsubscribed
- Si Email 1 ouvert mais pas cliqué → priorité envoi

---

## Email 3 — J+5 : Dernière relance

### Objectif
Créer un sentiment de clôture. Dernière chance de consulter l'étude. Ton plus direct, plus court.

### Objet (3 variantes)

- **A :** `Dernière relance — étude {adresse}`
- **B :** `{prenom}, je clôture votre dossier`
- **C :** `{economies_20ans} € d'économies potentielles`

### Corps

```
Bonjour {prenom},

Dernier message de ma part concernant l'étude solaire de votre bâtiment au {adresse}.

Le résumé en 3 chiffres :
• {puissance_kwc} kWc installables sur votre toiture
• {economies_an} € d'économies annuelles estimées
• Retour sur investissement en {retour_investissement} ans

[SI prime_autoconso > 0]
Votre installation est éligible à la prime autoconsommation de {prime_autoconso} € (versement unique, barème T2 2026).
[/SI]

L'étude reste accessible 30 jours :

→ {url_microsite}

Si ce n'est pas le bon moment, aucun souci. Je reste à disposition si le sujet revient à l'ordre du jour.

Mehdi Alaoui
Architecte DPLG — ERE Experts
```

### Notes techniques
- Envoi : 5 jours après Email 1 (2 jours après Email 2)
- Condition d'envoi : Email 1 ET Email 2 non répondus ET non unsubscribed
- Cet email clôt la séquence. Pas de relance supplémentaire.

---

## Règles de séquence Lemlist

| Règle | Valeur |
|-------|--------|
| Délai Email 1 → Email 2 | 3 jours |
| Délai Email 1 → Email 3 | 5 jours |
| Stop si réponse | oui, immédiat |
| Stop si unsubscribe | oui, immédiat |
| Stop si bounce | oui, immédiat |
| Stop si clic micro-site + CTA Cal.com | oui (prospect qualifié) |
| Jours d'envoi | mardi, mercredi, jeudi uniquement |
| Créneau d'envoi | 8h30 – 10h00 (heure Paris) |
| Rotation boîtes | mehdi@ere-experts.fr, contact@ere-experts.fr |
| Limite quotidienne par boîte | 30 emails/jour max (warm-up progressif) |

---

## KPI cibles

| Métrique | Objectif | Benchmark cold email B2B |
|----------|----------|------------------------|
| Taux d'ouverture | > 35 % | 20-30 % moyen |
| Taux de clic (micro-site) | > 8 % | 3-5 % moyen |
| Taux de réponse | > 5 % | 1-3 % moyen |
| Taux de RDV | > 2 % | 0.5-1 % moyen |
| Taux de bounce | < 3 % | 2-5 % moyen |
| Taux d'unsubscribe | < 1 % | < 2 % |

**Levier principal de performance :** la personnalisation par bâtiment. Un email qui mentionne l'adresse exacte, le nombre de panneaux et les économies spécifiques a un taux d'ouverture 2-3x supérieur à un email générique.

---

## Pied de page obligatoire (tous les emails)

```html
<p style="font-size: 11px; color: #888; margin-top: 30px;">
  ERE Experts — Cabinet conseil en architecture et rénovation énergétique<br>
  Cet email vous est envoyé car votre bâtiment est soumis à des obligations de performance énergétique.<br>
  <a href="{lien_unsubscribe}">Se désinscrire</a> | 
  Vos données sont traitées conformément au RGPD (intérêt légitime B2B). 
  <a href="https://ere-experts.fr/rgpd">Politique de confidentialité</a>
</p>
```

---

## Instructions pour le prompt Claude API (J7)

Le prompt système Claude devra :

1. Recevoir en entrée : template + variables prospect + persona détecté (A/B/C/D)
2. Adapter le ton selon le persona (DAF = chiffres, Asset Manager = volume, RSE = CO₂)
3. Respecter la longueur max (80-120 mots pour le corps)
4. Ne jamais inventer de chiffres — utiliser uniquement les variables fournies
5. Varier légèrement la formulation entre prospects pour éviter les filtres spam
6. Retourner : objet final + corps HTML prêt à injecter dans Lemlist

---

*Document rédigé le 26 avril 2026 — Sprint MVP v1 — Rattrapage J4*
