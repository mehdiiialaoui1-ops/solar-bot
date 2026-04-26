# Brief micro-site — Page personnalisée par prospect

> Cahier des charges pour le template micro-site Next.js (tâche Youssef J8).
> Chaque prospect reçoit une page unique accessible via un slug aléatoire : `solar.ere-experts.fr/{slug}`
> Ce document définit la structure, les contenus fixes/dynamiques, le ton et les interactions.

---

## Objectif de la page

**Convertir un clic email en prise de RDV Cal.com.**

Le prospect arrive depuis un email personnalisé. Il doit en 60 secondes :
1. Voir l'image satellite de SON bâtiment avec les panneaux positionnés
2. Comprendre les chiffres clés (kWc, économies, ROI)
3. Voir les aides financières auxquelles il est éligible
4. Cliquer sur le CTA pour réserver un échange de 15 min

---

## Spécifications générales

| Paramètre | Valeur |
|-----------|--------|
| URL | `solar.ere-experts.fr/{slug}` (slug = 8 caractères base62 aléatoires) |
| Responsive | Mobile-first (60 % des ouvertures email sont sur mobile) |
| Temps de chargement | < 2s (images optimisées, pas de framework lourd) |
| Durée de vie | 30 jours après création (mention dans l'email 3) |
| Tracking | Pixel visite, durée session, scroll depth, clic CTA |
| SEO | `noindex, nofollow` (pages privées, pas de référencement) |
| Marque blanche | Template adaptable aux couleurs de l'installateur partenaire (v2) |

---

## Structure de la page

### Section 1 — Hero (above the fold)

**Objectif :** Impact visuel immédiat. Le prospect voit son propre bâtiment.

| Élément | Type | Source |
|---------|------|--------|
| Image satellite du bâtiment | Image | `calculs_solaires.satellite_image_url` (Google Maps Static API) |
| Overlay panneaux solaires | SVG superposé | `calculs_solaires.overlay_svg_url` (généré par overlay-svg.ts) |
| Titre | Texte dynamique | "Potentiel solaire de votre bâtiment" |
| Sous-titre | Texte dynamique | `{adresse}, {commune}` |
| Badge obligation | Conditionnel | "Décret tertiaire" et/ou "Loi APER" si applicable |

**Contenu fixe :**
```
Étude réalisée par analyse satellite — ERE Experts, cabinet conseil en architecture et rénovation énergétique.
```

---

### Section 2 — Chiffres clés (4 métriques)

**Objectif :** Résumer la proposition de valeur en 4 chiffres.

| Métrique | Variable | Format | Icône |
|----------|----------|--------|-------|
| Puissance installable | `{puissance_kwc}` | "XX kWc" | Panneau solaire |
| Économie annuelle | `{economies_an}` | "XX XXX €/an" | Euro |
| Retour sur investissement | `{retour_investissement}` | "X,X ans" | Horloge |
| CO₂ évité | `{co2_evite}` | "XX t/an" | Feuille |

**Design :** 4 cartes côte à côte en desktop, 2x2 en mobile. Fond légèrement coloré. Chiffre en gras, label en dessous.

---

### Section 3 — Détail de l'installation

**Objectif :** Donner les détails techniques pour crédibiliser.

| Ligne | Variable | Label |
|-------|----------|-------|
| Nombre de panneaux | `{nb_panneaux}` | "Panneaux retenus (filtre 70 % meilleurs)" |
| Surface exploitable | `{surface_toiture_utile}` | "Surface de toiture exploitable" |
| Production annuelle | `{production_kwh}` | "Production estimée" |
| Orientation | `{azimut}` | "Orientation principale" |
| Inclinaison | `{inclinaison}` | "Inclinaison du pan" |
| Coût estimé HT | `{cout_installation}` | "Investissement estimé (HT, hors aides)" |

**Contenu fixe :**
```
Ces données sont issues de l'API Google Solar et du cadastre solaire. Elles constituent 
une pré-étude indicative. Une visite technique confirmera le dimensionnement final.
```

---

### Section 4 — Aides financières

**Objectif :** Montrer que des aides réduisent significativement le coût. Urgence réglementaire.

#### Sous-section 4a — Tableau des aides applicables

| Aide | Condition | Montant | Variable |
|------|-----------|---------|----------|
| Prime autoconsommation | < 100 kWc | `{prime_autoconso}` € | Conditionnel |
| Tarif rachat surplus EDF OA | autoconsommation avec surplus | `{tarif_oa}` €/kWh | Toujours |
| Revenu surplus annuel | autoconsommation avec surplus | `{revenu_surplus_an}` €/an | Toujours |
| Suramortissement (art. 39 decies B) | SI applicable | "jusqu'à 40 % de déduction" | Conditionnel, avec avertissement |

**Contenu fixe pour le suramortissement :**
```
⚠️ Le suramortissement pour les installations solaires est soumis à des conditions 
d'éligibilité spécifiques. Son applicabilité aux panneaux photovoltaïques en 2026 
reste à confirmer. Consultez votre expert-comptable.
```

#### Sous-section 4b — Obligations réglementaires (conditionnel)

**Si `obligation_decret = true` :**
```
Décret tertiaire — Votre bâtiment de {surface_m2} m² est soumis à l'obligation 
de réduire ses consommations énergétiques :
  • -40 % d'ici 2030 (déclaration OPERAT obligatoire)
  • -50 % d'ici 2040
  • -60 % d'ici 2050
Non-respect : amende de 7 500 €/an + publication au registre national.
```

**Si `obligation_aper = true` :**
```
Loi APER — Les parkings de plus de 1 500 m² doivent être équipés d'ombrières 
photovoltaïques. Votre site est potentiellement concerné.
```

---

### Section 5 — Simulation financière sur 20 ans

**Objectif :** Visualiser le gain cumulé sur la durée de vie de l'installation.

| Élément | Description |
|---------|-------------|
| Graphique | Courbe cumulée des économies sur 20 ans (ligne) vs. coût initial (barre) |
| Point de croisement | Marqué visuellement : "Retour sur investissement atteint en {retour_investissement} ans" |
| Total 20 ans | "{economies_20ans} € d'économies cumulées" en gras |

**Hypothèses affichées (texte fixe) :**
```
Hypothèses : augmentation du prix de l'électricité de 3 %/an, dégradation des panneaux 
de 0,5 %/an, durée de vie 25 ans. Calcul indicatif, non contractuel.
```

---

### Section 6 — CTA (Call to Action)

**Objectif :** Conversion. Un seul bouton, un seul message.

| Élément | Contenu |
|---------|---------|
| Titre | "Discutons de votre projet" |
| Sous-titre | "Un échange de 15 minutes pour valider ces résultats et répondre à vos questions." |
| Bouton | "Réserver un créneau" → lien Cal.com avec pré-remplissage |
| Texte sous bouton | "Gratuit, sans engagement. Avec Mehdi Alaoui, architecte DPLG." |

**Lien Cal.com :**
```
https://cal.com/ere-experts/decouverte?name={prenom}+{nom}&email={email}&notes=Bâtiment:{adresse}
```

---

### Section 7 — Footer

**Contenu fixe :**
```
ERE Experts — Cabinet conseil en architecture et rénovation énergétique
SIRET : [à compléter] | RCS [ville]
Architecte inscrit à l'Ordre — Mehdi Alaoui, DPLG École Spéciale de Paris

Cette étude a été réalisée à partir de données satellite et ne constitue pas un 
devis. Les montants sont indicatifs et soumis à visite technique. Les aides 
mentionnées sont celles en vigueur au T2 2026 et peuvent évoluer.

Données personnelles : vos coordonnées sont utilisées sur la base de l'intérêt 
légitime (prospection B2B). Vous pouvez demander la suppression de vos données 
à tout moment : rgpd@ere-experts.fr
```

---

## Tracking et analytics

| Événement | Méthode | Stockage |
|-----------|---------|----------|
| Visite page | Pixel / JS | `microsites.visits`, `first_visit_at`, `last_visit_at` |
| Scroll > 50 % | JS event | Log Supabase (optionnel v1) |
| Temps passé | JS timer | Log Supabase (optionnel v1) |
| Clic CTA Cal.com | JS event | `microsites.cta_clicked`, `cta_clicked_at` |
| Soumission RDV Cal.com | Webhook Cal.com | `prospects.statut` → `meeting_booked` |

---

## Design et identité visuelle

| Paramètre | Valeur v1 |
|-----------|-----------|
| Police titre | Inter ou System UI |
| Police corps | Inter ou System UI |
| Couleur primaire | À définir (bleu ERE Experts par défaut) |
| Couleur CTA | Vert / Teal (contraste, action positive) |
| Fond page | Blanc (#FFFFFF) |
| Fond sections alternées | Gris clair (#F8F8F8) |
| Largeur max contenu | 800px centré |
| Espacement sections | 60px (desktop), 40px (mobile) |

**Contrainte marque blanche (v2) :** le template doit accepter des variables de thème (couleur primaire, logo, nom installateur) pour être revendu en marque blanche aux installateurs partenaires.

---

## Données requises par le template

Le template Next.js recevra un objet JSON avec toutes les données nécessaires. Voici la structure attendue :

```typescript
interface MicrositeData {
  // Prospect
  adresse: string;
  commune: string;
  surface_m2: number;
  annee_construction: number | null;
  usage: string;
  raison_sociale: string;
  
  // Contact
  prenom: string;
  nom: string;
  email: string;
  
  // Calcul solaire
  nb_panneaux: number;
  puissance_kwc: number;
  production_kwh: number;
  surface_toiture_utile: number | null;
  azimut: number | null;
  inclinaison: number | null;
  cout_installation: number;
  economies_an: number;
  economies_20ans: number;
  retour_investissement: number;
  prime_autoconso: number | null;
  tarif_oa: number | null;
  revenu_surplus_an: number | null;
  co2_evite: number | null;
  
  // Obligations
  obligation_decret: boolean;
  obligation_aper: boolean;
  
  // Images
  satellite_image_url: string;
  overlay_svg_url: string;
  
  // Meta
  slug: string;
  url: string;
  created_at: string;
}
```

---

## Points d'attention pour Youssef

1. **Performance mobile** : l'image satellite + overlay doit se charger en < 1s. Pré-générer un PNG combiné (satellite + overlay) plutôt que superposer en CSS.
2. **Slug aléatoire** : 8 caractères base62 (a-zA-Z0-9). Ne PAS utiliser le nom de l'entreprise ou l'adresse dans l'URL (confidentialité).
3. **`noindex`** : balise meta robots obligatoire. Ces pages contiennent des données d'entreprise, elles ne doivent pas être indexées.
4. **Graphique 20 ans** : utiliser une lib légère (Chart.js via CDN ou SVG inline). Pas de recharts/d3 (trop lourd pour une page one-shot).
5. **Pré-remplissage Cal.com** : tester que les paramètres URL fonctionnent bien avec le compte Cal.com configuré.
6. **Fallback données manquantes** : si un champ est null (azimut, inclinaison, prime), masquer la ligne plutôt qu'afficher "N/A".

---

*Document rédigé le 26 avril 2026 — Sprint MVP v1 — Rattrapage J4*
