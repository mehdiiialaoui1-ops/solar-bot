# Région pilote — Métropole de Lyon

> Sélection de la zone géographique pour la première campagne de prospection.
> Ce document sert de référence pour le sourcing cadastre (J3) et la sélection des 50 premiers prospects (J9).

---

## Pourquoi Lyon Métropole ?

| Critère | Valeur |
|---------|--------|
| Irradiation solaire annuelle | ~1 300 kWh/m²/an (ensoleillement : 2 002 h/an) |
| Emplois industriels métropole | 77 860 emplois / 7 610 établissements |
| Espaces productifs protégés | 1 760 hectares |
| Potentiel prospects qualifiés | 3 500 – 5 000 bâtiments tertiaires/industriels > 500 m² |
| Accessibilité décideurs | Tissu économique dense, sièges sociaux régionaux, forte présence PME/ETI |

**Avantages stratégiques :**

- Bon compromis ensoleillement / densité de bâtiments tertiaires
- Fort tissu industriel (Vallée de la Chimie, logistique est lyonnais)
- Zones d'activités récentes avec grandes toitures plates (entrepôts, commerces)
- Obligation loi APER : nombreux parkings > 1 500 m² dans les ZA
- Décret tertiaire : forte concentration de bâtiments > 1 000 m²

---

## Communes sélectionnées — Phase pilote

### Tier 1 — Prioritaires (lancement J9)

| Commune | Code INSEE | Justification | Zones d'activités clés |
|---------|-----------|---------------|----------------------|
| Lyon | 69123 | Capitale régionale, plus forte densité tertiaire | La Mouche, Gerland, Part-Dieu, Confluence |
| Vénissieux | 69259 | Fort tissu industriel, grandes surfaces | Lyon Sud-Est, Parilly |
| Saint-Priest | 69199 | Zones logistiques, entrepôts grandes surfaces | Mi-Plaine, Lyon Sud-Est |
| Chassieu | 69044 | Concentration ZA pure, peu de résidentiel | Mi-Plaine, Perica |

### Tier 2 — Extension rapide (semaine 2-3)

| Commune | Code INSEE | Justification | Zones d'activités clés |
|---------|-----------|---------------|----------------------|
| Vaulx-en-Velin | 69256 | La Soie en développement, nouveaux bâtiments | La Rize, La Soie |
| Décines-Charpieu | 69073 | Croissance tertiaire post-OL Vallée | La Soie, OL Vallée |
| Corbas | 69069 | Logistique pure, grandes toitures plates | Lyon Sud-Est |
| Meyzieu | 69381 | Zone logistique Meyzieu-Jonage | Meyzieu-Jonage |

### Tier 3 — Réserve

| Commune | Code INSEE | Justification |
|---------|-----------|---------------|
| Villeurbanne | 69266 | Dense mais plus résidentiel, tertiaire de bureau |
| Bron | 69029 | Périphérie La Soie, volume moindre |
| Saint-Fons | 69199 | Vallée de la Chimie, industrie lourde (profil différent) |

---

## Codes INSEE pour le sourcing automatique

```typescript
// 04_code/src/sourcing/config.ts
export const REGION_PILOTE = {
  nom: "Métropole de Lyon",
  tier1: ["69123", "69259", "69199", "69044"],  // Lyon, Vénissieux, Saint-Priest, Chassieu
  tier2: ["69256", "69073", "69069", "69381"],  // Vaulx-en-Velin, Décines, Corbas, Meyzieu
  tier3: ["69266", "69029", "69199"],            // Villeurbanne, Bron, Saint-Fons
};

// Appel BDNB pour chaque code INSEE :
// GET https://bdnb.io/api/v1/donnees/batiment_groupe?code_insee={code}&usage_principal_bdnb_open=tertiaire&surface_activite_min=500
```

---

## Filtres de sourcing

Pour chaque commune, le module sourcing appliquera les filtres suivants :

| Filtre | Valeur | Raison |
|--------|--------|--------|
| Surface au sol | > 500 m² | Seuil de rentabilité installation solaire tertiaire |
| Usage | tertiaire, industriel, commercial, logistique | Exclure résidentiel et équipements publics |
| Année construction | toutes | Pas de filtre, mais bonus scoring si < 2000 |
| Parcelle identifiée | oui | Nécessaire pour appel Google Solar API |

---

## Estimation du volume — Phase pilote

| Métrique | Estimation |
|----------|-----------|
| Bâtiments > 500 m² dans Tier 1 (4 communes) | 800 – 1 200 |
| Après filtre usage (tertiaire/industriel uniquement) | 500 – 800 |
| Après filtre SIREN trouvé | 350 – 600 |
| Après filtre email vérifié | 150 – 300 |
| **Sélection campagne pilote** | **50** |

L'objectif du sprint est d'envoyer 50 emails à des prospects qualifiés. Avec un taux de conversion sourcing → email vérifié d'environ 30 %, il faut sourcer au minimum 200 bâtiments dans le Tier 1 pour garantir les 50 prospects.

---

## Paramètres de calcul solaire pour la zone

| Paramètre | Valeur Lyon Métropole |
|-----------|----------------------|
| Irradiation globale horizontale | ~1 300 kWh/m²/an |
| Inclinaison optimale panneaux | 35° |
| Facteur de performance (PR) | 0.80 (standard) |
| Prix électricité tertiaire | 0.18 – 0.22 €/kWh (tarif bleu pro) |
| Tarif OA surplus (< 100 kWc) | 0.0536 €/kWh (T2 2026) |
| Coût installation estimé | 900 – 1 100 €/kWc (tertiaire, > 36 kWc) |

---

## Prochaines étapes

1. **Youssef (J3)** : configurer le module sourcing avec les codes INSEE Tier 1, lancer le premier scraping BDNB + Cadastre IGN
2. **Mehdi (J6)** : tester manuellement Pappers sur 10 SIREN issus du sourcing Lyon pour valider la qualité des données dirigeants
3. **Décision semaine 2** : si le Tier 1 ne donne pas assez de volume qualifié, activer le Tier 2

---

*Document rédigé le 26 avril 2026 — Sprint MVP v1 — Rattrapage J3*
