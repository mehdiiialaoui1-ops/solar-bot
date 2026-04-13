# ERE SOLAR BOT — Guide de construction (version FR)

> **Éditeur :** ERE Experts  
> **Client pilote interne :** BATILIAN  
> **Cibles commerciales :** installateurs solaires français spécialisés tertiaire / industriel  
> **Version :** 1.0 — avril 2026  
> **Basé sur :** OpenClaw Reroof (version US) — adapté au marché et à la réglementation française

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Ce qu'on construit](#2-ce-quon-construit)
3. [La stack en un coup d'œil](#3-la-stack-en-un-coup-dœil)
4. [Étape 1 — Sourcer les bâtiments](#4-étape-1--sourcer-les-bâtiments)
5. [Étape 2 — Imagerie satellite](#5-étape-2--imagerie-satellite)
6. [Étape 3 — Géométrie solaire réelle](#6-étape-3--géométrie-solaire-réelle)
7. [Étape 4 — Identifier le vrai décideur](#7-étape-4--identifier-le-vrai-décideur)
8. [Étape 5 — Générer la vidéo](#8-étape-5--générer-la-vidéo)
9. [Étape 6 — Déployer le micro-site](#9-étape-6--déployer-le-micro-site)
10. [Étape 7 — Outreach multi-canal](#10-étape-7--outreach-multi-canal)
11. [Étape 8 — Gestion des réponses et prise de RDV](#11-étape-8--gestion-des-réponses-et-prise-de-rdv)
12. [Conseils de scaling](#12-conseils-de-scaling)
13. [Coût par prospect (bout en bout)](#13-coût-par-prospect-bout-en-bout)
14. [Par où commencer (MVP v1)](#14-par-où-commencer-mvp-v1)
15. [Pourquoi ça marche](#15-pourquoi-ça-marche)
16. [ANNEXE A — Configuration Claude Cowork + workflow collaboratif](#annexe-a--configuration-claude-cowork--workflow-collaboratif)
17. [ANNEXE B — Stratégie commerciale ERE Experts](#annexe-b--stratégie-commerciale-ere-experts)
18. [ANNEXE C — Conformité RGPD + réglementaire FR](#annexe-c--conformité-rgpd--réglementaire-fr)

---

## 1. Vue d'ensemble

Guide pas à pas pour construire un système qui :

- Identifie les bâtiments tertiaires / industriels français concernés par les obligations solaires
- Calcule leur potentiel solaire réel avec layout des panneaux sur leur toiture
- Identifie le vrai décideur (pas la SCI, mais le dirigeant ou le directeur immobilier)
- Livre au propriétaire une **proposition vidéo personnalisée** avec compte à rebours réglementaire
- Automatise l'outreach multi-canal et réserve les rendez-vous

C'est la stack technique complète. En suivant ce guide de bout en bout, vous aurez un pipeline commercial opérationnel.

---

## 2. Ce qu'on construit

Un workflow qui :

1. Extrait les bâtiments tertiaires / industriels depuis le **cadastre français + BDNB (CSTB)**
2. Filtre par **surface, usage, et âge** (bâtiments concernés par l'obligation de solarisation loi APER)
3. Récupère la **géométrie réelle de toiture + placement optimal des panneaux** via Google Solar API (ou PVGIS en fallback)
4. **Identifie le vrai décideur** derrière la SCI ou la société propriétaire, via Pappers + SIRENE + LinkedIn
5. Génère un **survol drone cinématique** de leur bâtiment avec panneaux incrustés
6. Déploie un **micro-site personnalisé** par prospect
7. Envoie un **outreach multi-canal** avec compte à rebours réglementaire (décret tertiaire, loi APER)
8. **Réserve des appels** quand ils répondent

---

## 3. La stack en un coup d'œil

| Couche | Outil | Usage | Coût |
|---|---|---|---|
| Orchestration | n8n (auto-hébergé) ou **Make** | Moteur de workflow | Gratuit auto-hébergé / 20 €/mois cloud |
| Base de données | **Supabase** (Postgres UE) | Prospects, état, dashboard realtime | Free tier puis 25 €/mois |
| Hébergement | **Vercel** ou **OVH** | Micro-sites + dashboard | Free tier |
| Données parcelles | **API Cadastre IGN** + **BDNB (CSTB)** | Bâtiments + année construction + surface | Gratuit (public) |
| Géocodage | **API Adresse (BAN)** | Adresse → lat/lng | Gratuit |
| Imagerie satellite | Google Maps Static API | Image du bâtiment | ~2 $ / 1000 calls |
| Géométrie solaire | Google Solar API (ou **PVGIS** fallback) | Layout panneaux + production | ~2 $ / 1000 calls |
| Dirigeants entreprise | **Pappers API** + SIRENE INSEE | SCI → dirigeant réel | 49 €/mois starter |
| Enrichissement contact | **Dropcontact** (FR, RGPD) | Email pro vérifié | 29 €/mois |
| Vérification email | MillionVerifier | Contrôle délivrabilité | 0,005 $/check |
| Texte IA | Claude API (Sonnet 4.6) | Copy email, classifieur réponses | ~0,02 €/prospect |
| Vidéo IA | **Veo 3** via fal.ai | Satellite → survol drone | ~2 €/vidéo |
| Compositing vidéo | ffmpeg + skia | Overlay panneaux, compte à rebours, texte | Gratuit |
| Envoi email | **Lemlist** (FR) ou Instantly | Envoi avec rotation | 59–97 €/mois |
| SMS (optionnel) | OVH Télécom ou Twilio | Relance mobile | ~0,08 €/SMS |
| Courrier papier | La Poste API ou Lob | Fallback courrier manuscrit | ~1,50 €/lettre |
| Agenda | Cal.com | Prise de RDV | Gratuit |

**Coût outillage initial : ~300 €/mois** + frais variables d'usage.  
**Coût par prospect traité bout en bout : ~3 à 5 €.**

---

## 4. Étape 1 — Sourcer les bâtiments

**Objectif :** obtenir une liste de bâtiments tertiaires ou industriels français concernés par la solarisation obligatoire.

### 1a. Choisir son marché

Commencer par **une seule région** à fort ensoleillement. Classement PACA, Occitanie, Nouvelle-Aquitaine, Auvergne-Rhône-Alpes > le reste. Plus d'heures de soleil = meilleure rentabilité = argumentaire commercial plus percutant.

> **Conseil ERE Experts** : commencer par l'Île-de-France si vous ciblez les sièges sociaux décisionnaires (effet RSE), mais PACA/Occitanie pour la rentabilité pure.

### 1b. Extraire les données cadastrales

Utiliser l'**API Cadastre IGN** (gratuit, public) pour obtenir les parcelles, puis la **Base de Données Nationale des Bâtiments (BDNB)** du CSTB pour les caractéristiques.

```javascript
// n8n http node — API Cadastre IGN
GET https://apicarto.ign.fr/api/cadastre/parcelle
  ?code_insee=75056        // ex : Paris
  &code_arr=75101

// Puis BDNB pour les caractéristiques
GET https://bdnb.io/api/v1/donnees/batiment_groupe
  ?code_insee=75056
  &usage_principal_bdnb_open=tertiaire
  &surface_activite_min=500
  &annee_construction_max=2005
```

Requête type : **bâtiments tertiaires ou industriels, surface > 1000 m², construits entre 1990 et 2010** (toitures en fin de vie qui justifient un combo réfection + solarisation).

Pour les **cibles loi APER** : bâtiments ayant un parking > 1500 m² OU toiture > 500 m² sur bâtiment neuf/rénové.

Enregistrer chaque résultat comme ligne dans la table `prospects` de Supabase.

### 1c. Enrichir avec les données communales

La BDNB a parfois des trous. Pour les champs manquants, interroger l'**API GéoRisques** (performance énergétique, DPE collectifs) et les **Open Data** des métropoles (Paris, Lyon, Marseille publient des jeux de données détaillés).

**Schéma Supabase `prospects` minimal :**

```sql
CREATE TABLE prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adresse text,
  code_postal text,
  commune text,
  lat double precision,
  lng double precision,
  parcelle_id text UNIQUE,
  surface_m2 numeric,
  usage text,
  annee_construction integer,
  siren_proprietaire text,
  raison_sociale text,
  statut text DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);
```

---

## 5. Étape 2 — Imagerie satellite

**Objectif :** obtenir une image satellite propre en vue du dessus de chaque bâtiment.

### 2a. Google Maps Static API

Un appel par prospect :

```
GET https://maps.googleapis.com/maps/api/staticmap
  ?center={lat},{lng}
  &zoom=18
  &size=1280x720
  &maptype=satellite
  &key=VOTRE_CLE
```

Sauvegarder le PNG dans Supabase Storage. Conserver l'URL dans la ligne prospect.

### 2b. Astuces

- Le zoom 18 donne tout le bâtiment sans trop de bruit autour
- Pour les très grands entrepôts (> 10 000 m²), descendre au zoom 17
- Ratio carré pour le micro-site, 16:9 pour la vidéo

---

## 6. Étape 3 — Géométrie solaire réelle

C'est le **cœur du système**. C'est ce qui fait qu'une proposition ressemble à un rapport d'ingénieur plutôt qu'à un pitch commercial.

### 3a. Appeler Google Solar API

```
POST https://solar.googleapis.com/v1/buildingInsights:findClosest
  ?location.latitude={lat}
  &location.longitude={lng}
  &requiredQuality=HIGH
  &key=VOTRE_CLE
```

La réponse contient :

- `solarPotential.maxArrayPanelsCount` — nombre théorique max de panneaux
- `solarPotential.solarPanels[]` — tableau avec lat/lng, orientation, id de pan de toiture pour chaque panneau
- `solarPotential.roofSegmentStats[]` — azimut, pente, surface utilisable par pan
- `solarPotential.financialAnalyses[]` — production annuelle par panneau, triée par meilleur rendement

> **Couverture France** : Google Solar API couvre la plupart des zones urbaines et périurbaines françaises. Pour les zones rurales non couvertes, fallback sur **PVGIS** (Commission Européenne, gratuit) qui donne l'irradiation mais pas le layout visuel — dans ce cas générer un layout simplifié par grille.

### 3b. Découper à une couverture réaliste

Prendre les **70 % meilleurs panneaux par production**. Cela correspond à ce qu'un installateur réel déploierait après les reculs réglementaires (ressauts, cheminements de sécurité, obstacles). Ne pas utiliser 100 % — ça sonne faux, et tout installateur RGE expérimenté le verra.

```javascript
const allPanels = response.solarPotential.solarPanels;
const sortedByOutput = allPanels.sort((a, b) => b.yearlyEnergyDcKwh - a.yearlyEnergyDcKwh);
const deployablePanels = sortedByOutput.slice(0, Math.floor(allPanels.length * 0.7));
```

### 3c. Calculer l'économie du projet

Panneau standard 1,045 m × 1,879 m, puissance 400 W.

```javascript
const systemKW = deployablePanels.length * 0.4; // 400W par panneau
const yearlyKWh = deployablePanels.reduce((sum, p) => sum + p.yearlyEnergyDcKwh, 0);

// Prix de l'électricité pour le tertiaire (varie 0,14 à 0,25 €/kWh HT en 2026)
const kwhRate = 0.18;
const yearlyEconomies = yearlyKWh * kwhRate;

// Revente du surplus (tarif OA pour >100 kWc : env. 0,078 €/kWh en 2026, à vérifier)
const tarifRevente = 0.078;
const economies20ans = yearlyEconomies * 20 * 1.03; // 3% d'escalade annuelle

// Prix installation commerciale en France : 800–1200 €/kWc posé selon taille
const coutSysteme = systemKW * 1000; // ~1000 €/kWc en moyenne

// Aides françaises (à calculer précisément selon projet) :
// - Prime autoconsommation EDF OA (pour < 100 kWc)
// - CEE (Certificats d'Économie d'Énergie) pour rénovation associée
// - Aides régionales variables
const primeAutoconsommation = systemKW < 100 ? systemKW * 1000 * 0.08 : 0;
```

Stocker tout sur la ligne prospect.

### 3d. Projeter les panneaux lat/lng en coordonnées pixel

Pour dessiner les panneaux sur l'image satellite, convertir chaque lat/lng en position pixel avec la projection Web Mercator :

```javascript
function latLngToPixel(lat, lng, centerLat, centerLng, zoom, width, height) {
  const scale = 256 * Math.pow(2, zoom);
  const worldX = (lng + 180) / 360 * scale;
  const worldY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * scale;
  const centerWorldX = (centerLng + 180) / 360 * scale;
  const centerWorldY = (1 - Math.log(Math.tan(centerLat * Math.PI / 180) + 1 / Math.cos(centerLat * Math.PI / 180)) / Math.PI) / 2 * scale;
  return {
    x: width / 2 + (worldX - centerWorldX),
    y: height / 2 + (worldY - centerWorldY)
  };
}
```

Pour chaque panneau, projeter son centre lat/lng en coordonnées pixel, puis dessiner un `<rect>` SVG tourné selon l'azimut du pan de toiture. Tailles : 1,045 m large × 1,879 m haut converties en pixels selon le niveau de zoom.

### 3e. Rendre l'overlay

Construire un SVG qui se superpose au PNG satellite. Sauver les deux : un PNG combiné **et** le SVG brut (on aura besoin du SVG pour l'étape compositing vidéo).

---

## 7. Étape 4 — Identifier le vrai décideur

Le propriétaire sur la parcelle est généralement une SCI ou une SAS foncière du type **"SCI DU 12 RUE DE LA RÉPUBLIQUE"**. Ce n'est pas le décideur.

### 4a. Lookup Pappers / SIRENE

D'abord récupérer les données officielles :

```
GET https://api.pappers.fr/v2/entreprise
  ?api_token={VOTRE_CLE}
  &siren={siren_proprietaire}
```

On obtient : dirigeants (gérant, président, DG), bénéficiaires effectifs, historique des modifications, bilans. Pappers agrège INSEE + BODACC + INPI — c'est la référence France.

### 4b. Croiser avec les bénéficiaires effectifs

Le **registre des bénéficiaires effectifs (RBE)** indique qui détient > 25 % des parts. C'est souvent le vrai décideur économique. Accessible via Pappers ou via data.inpi.fr.

### 4c. Croiser avec LinkedIn

Via Apollo, Lemlist, ou **Kaspr** (français) :

1. Chercher la société mère ou le groupe (pas la SCI — elle n'a pas de profil actif)
2. Tirer les profils LinkedIn pour : dirigeant, directeur immobilier, directeur général, directeur RSE, responsable énergie / achats, directeur des opérations

Classer par priorité : **propriétaire-dirigeant > directeur immobilier > directeur RSE > directeur général > directeur des achats**.

Pour les grands groupes, le **directeur immobilier** ou le **directeur RSE** est souvent plus réceptif que le CEO — c'est son sujet.

### 4d. Cascade d'enrichissement email + téléphone

Faire passer le contact prioritaire à travers :

1. **Dropcontact** → email vérifié + mobile (conforme RGPD, basé en France)
2. **Kaspr** → fallback
3. **Hunter.io** → fallback pattern
4. **Devinette pattern** (`prenom.nom@domaine.com`) → vérifier avec MillionVerifier

Ne garder que le premier avec taux de délivrabilité > 95 %.

### 4e. Tout sauvegarder

Stocker nom du décideur, titre, email, téléphone, score de confiance sur la ligne prospect.

> ⚠️ **Conformité RGPD** : l'enrichissement B2B est couvert par l'intérêt légitime, mais documenter les sources et prévoir un droit d'opposition facile (unsubscribe, suppression sur demande en 72h). Voir [Annexe C](#annexe-c--conformité-rgpd--réglementaire-fr).

---

## 8. Étape 5 — Générer la vidéo

**Objectif :** transformer l'image satellite + l'overlay panneaux en un survol drone cinématique de 15 secondes.

### 5a. Appeler Veo 3 via fal.ai

Veo 3 prend un prompt image + un prompt de mouvement et produit une vidéo. fal.ai l'expose via une API simple.

```javascript
const result = await fal.subscribe("fal-ai/veo-3", {
  input: {
    image_url: satelliteImageUrl,
    prompt: `vue aérienne drone cinématique, montée en travelling au-dessus d'un grand bâtiment ${typeBatiment} français, lumière de fin d'après-midi, plan stable professionnel`,
    duration: 12,
    aspect_ratio: "16:9"
  }
});

const videoUrl = result.data.video.url;
```

Coût : ~2 € par vidéo. Temps de rendu : 60–90 secondes.

### 5b. Compositer l'overlay avec ffmpeg

La sortie Veo n'est que le plan drone. Il faut y superposer la grille de panneaux, le nom du décideur, le compte à rebours et le montant des aides.

Pipeline :

```bash
# 1. Extraire la dernière frame de la vidéo
ffmpeg -sseof -0.1 -i survol.mp4 -vframes 1 frame-finale.png

# 2. Compositer l'overlay SVG sur la frame finale
# (utiliser sharp ou skia-canvas pour rasteriser le SVG puis overlay)

# 3. Créer une séquence "matérialisation des panneaux" en générant 15 frames
# avec opacité progressive (0% → 100%)

# 4. Appendre la séquence à la fin du survol
ffmpeg -i survol.mp4 -i panneaux-materialisation.mp4 \
  -filter_complex "[0:v][1:v]concat=n=2:v=1[out]" -map "[out]" final-pre.mp4

# 5. Incruster les textes (en français)
ffmpeg -i final-pre.mp4 \
  -vf "drawtext=text='$NOM_DECIDEUR':x=40:y=h-120:fontsize=32:fontcolor=white:box=1:boxcolor=black@0.5,\
       drawtext=text='$MONTANT_AIDES économisés':x=40:y=h-80:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.5,\
       drawtext=text='%{eif\:max(0\,JOURS_RESTANTS-t/86400)\:d} jours avant échéance':x=w-500:y=40:fontsize=24:fontcolor=yellow" \
  -c:a copy final.mp4
```

### 5c. Uploader sur un CDN

Utiliser **Bunny.net**, **Cloudflare Stream** ou **Mux** pour streaming rapide. Récupérer une URL publique.

### 5d. Générer une miniature

Capturer la première frame en PNG pour l'aperçu email :

```bash
ffmpeg -i final.mp4 -ss 0 -vframes 1 thumbnail.png
```

---

## 9. Étape 6 — Déployer le micro-site

Chaque prospect reçoit son propre sous-domaine. Exemple : `[slug-entreprise].solar.ere-experts.fr` ou un domaine dédié du client installateur.

### 6a. Template Next.js

Construire **un** template Next.js avec :

- **Hero** : la vidéo en autoplay en haut
- **Caractéristiques du bâtiment** : surface, année construction, âge estimé toiture, nom du décideur
- **Système solaire** : nombre de panneaux, puissance crête kWc, production annuelle kWh, économies sur 20 ans
- **Bloc aides et réglementation** : montant CEE + MaPrimeRénov' + prime autoconso + compte à rebours décret tertiaire / obligations loi APER + explication du cadre
- **CTA** : bouton "Réserver un échange" → lien Cal.com

Utiliser des `props` pour tout ce qui est dynamique.

### 6b. Déployer via Vercel API

Pour chaque nouveau prospect, le bot :

```javascript
// créer un déploiement Vercel avec les variables d'env injectées
await fetch('https://api.vercel.com/v13/deployments', {
  method: 'POST',
  headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
  body: JSON.stringify({
    name: `${prospect.slug}-ere-solar`,
    gitSource: { type: 'github', repo: 'ere-experts/solar-microsite-template', ref: 'main' },
    env: {
      PROSPECT_SLUG: prospect.slug,
      NOM_DECIDEUR: prospect.decideur,
      VIDEO_URL: prospect.videoUrl,
      // ... tout le reste
    }
  })
});
```

Pointer ensuite un enregistrement DNS wildcard vers Vercel (`*.solar.ere-experts.fr`) et chaque déploiement devient accessible automatiquement sur son sous-domaine.

### 6c. Alternative moins chère

Si vous ne voulez pas déployer un site Next.js complet par prospect, pré-rendre un HTML statique dans n8n avec un moteur de template (handlebars / liquid), uploader HTML + vidéo vers Supabase Storage, servir via un worker Cloudflare qui mappe `[slug].solar.ere-experts.fr` → `storage/prospects/{slug}/index.html`. Beaucoup moins cher, scale à l'infini, fonctionne pareil pour le prospect.

---

## 10. Étape 7 — Outreach multi-canal

### 7a. Jour 0 — Email

Utiliser Claude API pour générer le texte. Court, direct, pas de blabla marketing.

```
Objet : votre toiture au {adresse} + {montant_aides} d'aides à saisir

Bonjour {prenom},

J'ai analysé la toiture de {nom_entreprise} au {adresse}. 
Elle date de {annee_construction}, en fenêtre de remplacement.

Je vous ai fait une simulation 3D de 15 secondes montrant ce que ça 
donnerait avec une installation photovoltaïque + le détail des aides 
2026 auxquelles vous êtes éligible.

{miniature_video} → {url_microsite}

Au titre du décret tertiaire, vous devez réduire votre consommation 
énergétique de 40 % d'ici 2030. Il vous reste {jours_restants} jours 
avant le prochain palier de reporting.

— {prenom_installateur}, {nom_entreprise_installateur}

[Se désabonner — conforme RGPD]
```

Envoyer via **Lemlist** (outil français, intégrations natives avec CRM FR) ou Instantly. Utiliser un domaine échauffé. Rotation sur 3–5 boîtes pour éviter les signaux de volume.

### 7b. Jour 3 — Second email

Si pas de réponse, recadrer autour de l'échéance :

```
Objet : 82 jours avant le palier du décret tertiaire

{prenom}, je reviens vers vous. Il vous reste 82 jours pour sécuriser 
votre projet photovoltaïque avant le reporting OPERAT 2026.

Le combo réfection toiture + solaire revient à {cout_total}, avec 
{montant_aides} pris en charge entre la prime autoconso, les CEE et 
la fiscalité (suramortissement article 39 decies pour le tertiaire).

{url_microsite}
```

### 7c. Jour 5 — LinkedIn

Demande de connexion + message doux :

```
Bonjour {prenom}, {prenom_installateur} de {entreprise_installateur}. 
Je vous ai envoyé un survol 3D de la toiture de {entreprise} la 
semaine dernière — ça vaut un appel de 15 minutes ?
```

### 7d. Jour 7 — SMS

Si on a le mobile (et base légale validée) :

```
{prenom}, {prenom_installateur} de {entreprise_installateur}. 
Juste un mot — avez-vous vu la vidéo de la toiture de {entreprise} ? 
{url_microsite}
STOP au XXXXX pour vous désinscrire.
```

> ⚠️ Mention STOP obligatoire (loi française). Ne pas envoyer avant 8h ni après 20h, jamais le dimanche.

### 7e. Jour 10 — Courrier via La Poste

Dernier recours : imprimer la miniature vidéo sur une carte postale avec QR code du micro-site. Via l'API de La Poste (ou Lob si vous préférez).

---

## 11. Étape 8 — Gestion des réponses et prise de RDV

### 11a. Classifieur de boîte de réception

Chaque réponse déclenche un appel Claude API qui la classe :

- `interesse` → envoi auto du lien calendrier
- `pas_maintenant` → mise en pause 30 jours
- `mauvaise_personne` → ré-enrichir au niveau du groupe / société mère
- `desabonnement` → marquer inactif, suppression RGPD
- `question` → notifier l'installateur pour réponse manuelle

### 11b. Envoi auto du calendrier

Pour les réponses `interesse`, insérer un lien Cal.com dans une réponse pré-écrite dans le ton de l'installateur.

### 11c. Dashboard

Supabase realtime → dashboard Next.js affichant :

- Nombre de prospects par étape du pipeline
- Flux d'activité en temps réel (ce que le bot fait maintenant)
- RDV réservés aujourd'hui
- Montant potentiel d'aides activées
- Jours restants avant prochains paliers réglementaires (OPERAT, APER)

---

## 12. Conseils de scaling

- **Mettre en lot les appels Google Solar API**. Chaque appel coûte ~2 €. Si vous traitez 500 prospects/jour, c'est 1 000 €/jour en frais d'API. Mettre en file d'attente hors heures de pointe et mettre en cache agressivement — un même bâtiment ne doit jamais être interrogé deux fois.

- **Échauffer votre infrastructure email 30 jours avant d'en avoir besoin**. Lemlist / Instantly prennent 3–4 semaines pour chauffer un domaine frais à 50+ envois/jour.

- **Tourner 5 boîtes par domaine, 3 domaines minimum**. Répartit le volume et protège la réputation.

- **Pré-rendre 10 templates vidéo pendant le setup**, pas par prospect. Seule l'étape de compositing final est par prospect.

- **Cibler une seule région à la fois**. Essayer 10 métropoles en parallèle fera fondre votre base de données et vos APIs.

---

## 13. Coût par prospect (bout en bout)

| Poste | Coût |
|---|---|
| Données cadastre + BDNB | Gratuit |
| Image satellite | 0,002 € |
| Google Solar API | 0,10 € |
| Pappers + enrichissement | 0,40 € |
| Vérification email | 0,005 € |
| Claude API (copy + classification) | 0,02 € |
| Vidéo Veo 3 | 2,00 € |
| Compositing ffmpeg | gratuit |
| Déploiement micro-site | 0,001 € |
| Envoi email | 0,005 € |
| SMS (si utilisé) | 0,08 € |
| **Total** | **~2,60 €** |

Sur un taux de conversion à 2 %, une taille moyenne de projet de 300 000 € (installation 200 kWc + réfection toiture tertiaire) et une marge installateur de 10 % sur le combo (30 000 € de profit par deal), le ROI est massif : **coût d'acquisition = ~130 €**, valeur d'un client = **30 000 €**.

---

## 14. Par où commencer (MVP v1)

**Ne pas tout construire d'un coup.** Livrer dans cet ordre :

1. **Jour 1–2** : sourcing cadastre + schéma Supabase
2. **Jour 3–4** : Google Maps Static + Google Solar API + maths projection pixel
3. **Jour 5–6** : cascade d'enrichissement décideur
4. **Jour 7** : génération copy email Claude + intégration Lemlist (zapper la vidéo pour la v1)
5. **Jour 8** : template micro-site statique (pas de vidéo, juste image satellite + overlay panneaux)
6. **Jour 9** : envoyer 50 vrais emails, voir ce qui se passe

C'est le MVP. **Si les gens répondent**, ajouter Veo 3 + compositing vidéo en semaine 2. **S'ils ne répondent pas**, vous n'avez pas brûlé 2 € par prospect en génération vidéo.

---

## 15. Pourquoi ça marche

- **Vraie échéance.** Le décret tertiaire 2030 et les reporting OPERAT annuels sont des **obligations légales**, pas des incitations qui peuvent être ignorées. Chaque jour qui passe rapproche du palier.

- **Vraies maths.** Google Solar API est de qualité assurance-crédit. Ce n'est pas une photo stock avec des panneaux Photoshoppés. C'est le layout exact qu'une étude de permis de construire montrerait.

- **Vrai décideur.** Vous n'envoyez pas à info@. Vous envoyez au directeur immobilier dont le nom apparaît sur le RBE.

- **Vraie urgence.** La vidéo se termine par un compte à rebours. Chaque prospect la voit sur **son propre bâtiment** avec un nombre à 6 chiffres qui flotte au-dessus.

Mettez ces quatre éléments dans un email et il s'ouvre de lui-même.

---

## ANNEXE A — Configuration Claude Cowork + workflow collaboratif

### A.1 Prérequis techniques

- **Claude Desktop** à jour (macOS ou Windows) sur chaque machine
- Plan **Claude Pro ou Max** minimum pour toi et ton collaborateur
- Un dossier racine dédié : `~/ERE_Experts/SolarBot/`

### A.2 Architecture de dossiers (à reproduire à l'identique chez vous deux)

```
SolarBot/
├── 00_README.md                    ← règles du projet + conventions
├── 01_specs/                       ← specs fonctionnelles
│   ├── persona_commercial.md
│   ├── parcours_prospect.md
│   └── base_reglementaire_FR.md    ← décret tertiaire, APER, CEE, MPR
├── 02_prompts/                     ← prompts système versionnés
│   ├── v1_email_copy.txt
│   ├── v1_inbox_classifier.txt
│   └── v1_lead_qualifier.txt
├── 03_data/                        ← données réglementaires FR
│   ├── tarifs_OA_2026.csv
│   ├── CEE_fiches_operations.csv
│   ├── zones_irradiation_FR.json
│   └── seuils_decret_tertiaire.csv
├── 04_code/                        ← code du pipeline
│   ├── src/
│   │   ├── sourcing/               ← étape 1
│   │   ├── satellite/              ← étape 2–3
│   │   ├── enrichment/             ← étape 4
│   │   ├── video/                  ← étape 5
│   │   ├── microsite/              ← étape 6
│   │   ├── outreach/               ← étape 7
│   │   └── inbox/                  ← étape 8
│   └── tests/
├── 05_integrations/                ← n8n workflows exportés, Make scenarios
├── 06_tests/                       ← cas de test end-to-end
├── 07_livrables_clients/           ← démos, one-pagers, pitch decks
└── 08_operations/                  ← documents ERE Experts, CGV, DPA
```

### A.3 Créer le Project Cowork

Dans Cowork, créer un projet nommé `ERE SOLAR BOT` et coller dans les instructions :

```
Tu es l'assistant de développement du pipeline commercial ERE SOLAR BOT.

CONTEXTE : outil édité par ERE Experts (cabinet de conseil architecture 
et bâtiment), vendu en marque blanche à des installateurs solaires 
français spécialisés tertiaire et industriel.

CIBLE FINALE : propriétaires de bâtiments tertiaires/industriels 
français > 500 m² concernés par les obligations de solarisation 
(loi APER, décret tertiaire, trajectoire OPERAT).

CADRE RÉGLEMENTAIRE : France 2026. Intégrer systématiquement :
- MaPrimeRénov' Copropriétés / rénovation d'ampleur
- CEE (fiches IND-UT, BAT-EN, BAT-TH)
- Tarif de rachat EDF OA surplus
- Prime à l'autoconsommation (< 100 kWc)
- Suramortissement article 39 decies B
- Obligations loi APER (parkings, toitures neuves/rénovées)
- Décret tertiaire (paliers 2030/2040/2050)

IDENTITÉ VISUELLE : ERE Experts — ton professionnel, data-driven, 
expert-conseil. Couleurs à définir (voir 01_specs/).

RÈGLES DE CODE :
- Tout le code en TypeScript côté back, Next.js 14+ côté front
- Toute la doc en français soigné
- Commit messages en français impératif : "ajoute X", "corrige Y"
- Avant toute modification importante, créer une branche Git et 
  attendre validation avant merge
- Tests unitaires Vitest obligatoires sur les fonctions de calcul 
  (pixel projection, économies, dimensionnement)

CONFORMITÉ : toute fonctionnalité touchant aux données personnelles 
doit être documentée dans 08_operations/registre_rgpd.md.
```

### A.4 Connecteurs Cowork à activer

- **GitHub** (indispensable — voir section A.6)
- **Google Drive** (CSV de barèmes partagés, pitch decks)
- **Gmail** (pour tests d'envoi en prod)
- **Notion** ou **Linear** (backlog partagé)
- **Supabase** (accès direct à la base depuis Cowork)
- **Claude in Chrome** (pour scraping ADEME, photovoltaique.info, france-renov.gouv.fr)

### A.5 Skills Cowork personnalisées à créer

Créer des skills ERE Experts réutilisables :

- `skill-verif-eligibilite-aper.md` — logique de filtrage loi APER
- `skill-calcul-cee.md` — mapping fiches CEE pour chaque type de travaux
- `skill-generation-email-fr.md` — style de rédaction française B2B
- `skill-conformite-rgpd-outreach.md` — garde-fous RGPD à vérifier

### A.6 Workflow collaboratif à deux (GitFlow léger)

**Règle d'or** : Cowork tourne **localement** sur chaque machine. GitHub est votre serveur partagé. Aucun fichier de code ne circule en dehors de Git.

**Rituel matinal (5 min chacun)** :
```bash
cd ~/ERE_Experts/SolarBot
git pull origin main
```

**Pendant la journée, chacun de son côté** :

| Toi (Paris) | Ton collaborateur (autre ville) |
|---|---|
| `git checkout -b feature/sourcing-bdnb` | `git checkout -b feature/video-compositing` |
| Cowork bosse sur le sourcing BDNB | Cowork bosse sur le pipeline ffmpeg |
| Commit + push + Pull Request | Commit + push + Pull Request |
| Review de la PR de le collaborateur dans GitHub | Review de ta PR dans GitHub |
| Merge sur `main` | `git pull` pour récupérer |

**Répartition des rôles suggérée** :

- **Toi (architecte, expert métier)** :
  - Specs dans `01_specs/`
  - Base réglementaire dans `03_data/`
  - Personas commerciaux et parcours prospect
  - Tests qualité des emails et des micro-sites
  - Relation client ERE Experts
  - Pilotage du client pilote BATILIAN

- **Ton collaborateur (rôle technique)** :
  - Code dans `04_code/`
  - Workflows n8n dans `05_integrations/`
  - Infrastructure (Vercel, Supabase, DNS)
  - Déploiement et monitoring
  - Sécurité et conformité technique

**Rituels de synchro** :

- **Daily async** de 5 min : chacun envoie un vocal WhatsApp : *fait hier / fait aujourd'hui / blocage*
- **Point hebdo visio** de 45 min le vendredi 17h : démo + priorités semaine suivante
- **Board Linear ou Notion** comme source de vérité des tâches (pas de tâches dans les conversations Cowork)

### A.7 Convention de nommage des tâches Cowork

Dans chaque machine Cowork, nommer les sessions avec un préfixe :

- `[DEV]` pour le code
- `[SPEC]` pour les specs
- `[DATA]` pour les données réglementaires
- `[CLIENT]` pour la préparation d'un RDV client ERE Experts
- `[DEBUG]` pour un bug de prod

Exemple : `[DEV] intégration API Pappers pour enrichissement dirigeants`

### A.8 Claude Managed Agents vs OpenClaw : notre choix

Depuis le 4 avril 2026, Anthropic a coupé l'accès des abonnements Claude Pro/Max aux frameworks tiers comme OpenClaw. Depuis le 8 avril, **Claude Managed Agents** est en bêta publique.

**Pour ERE Experts → Claude Managed Agents**, sans hésiter :

| Critère | Pourquoi Managed Agents |
|---|---|
| Vente à des entreprises françaises B2B | Infrastructure Anthropic = argument de fiabilité |
| RGPD / conformité enterprise | Contrats entreprise Anthropic disponibles |
| Pas de DevOps full-time | Ops gérée par Anthropic |
| Multi-clients en marque blanche | Cloisonnement natif des agents |
| Facturation simple au token | Mapping direct sur tarification SaaS client |

**Architecture :**

- **Dev** : Cowork local sur chaque poste + Claude API pour tests
- **Production** : un agent Managed Agents par client installateur (`agent_batilian`, `agent_client_A`, `agent_client_B`…)
- **Exposition client** : widget iframe sur leur site + webhook vers leur CRM

---

## ANNEXE B — Stratégie commerciale ERE Experts

### B.1 Positionnement

> *ERE Experts — cabinet de conseil en architecture et performance du bâtiment — édite et déploie des agents conversationnels spécialisés pour les acteurs français de la transition énergétique.*

Tu n'es pas un éditeur de logiciel généraliste. Tu es **un cabinet d'expert qui a construit son propre outil** et qui le met à disposition de pairs. C'est une posture très différente — et beaucoup plus crédible auprès des DSI et dirigeants.

### B.2 Cible client (ICP — Ideal Customer Profile)

- Entreprises françaises
- Spécialisées dans l'installation photovoltaïque tertiaire/industriel
- Certification RGE QualiPV Bâtiment
- CA entre 2 M€ et 50 M€
- Équipe commerciale active en recherche de leads qualifiés
- Territoire : France métropolitaine, idéalement multi-régions

### B.3 Pricing proposé (à valider par test marché)

**Setup fee (paiement unique)** :
- Audit besoins + personnalisation du persona + base de connaissance spécifique
- Intégration CRM du client
- Formation équipe commerciale
- **3 000 € à 8 000 € HT** selon complexité

**Abonnement mensuel** :
- Licence d'usage de la plateforme
- Hébergement Managed Agents + Supabase + Vercel
- Maintenance, mises à jour réglementaires
- Support
- **300 € à 1 500 € HT / mois** selon volume de prospects traités

**Success fee (optionnel)** :
- 5–10 % du CA généré par les leads transmis et convertis
- Permet d'aligner les intérêts
- Nécessite un reporting transparent partagé

### B.4 BATILIAN comme client pilote ("dogfooding")

BATILIAN devient ton **client zéro** : tu fais tourner le pipeline sur ton propre business pendant 2–3 mois, tu affines, tu mesures les KPIs réels.

Avantages :
- Cas d'usage crédible à présenter : *« Nous l'utilisons nous-mêmes, voici nos chiffres. »*
- Pas de risque image (si ça rate, c'est chez toi, pas chez un client)
- Retour terrain direct pour l'équipe dev
- Génère du vrai CA BATILIAN pendant le développement

### B.5 Canaux de vente ERE Experts

- **FFB, CAPEB, AT2EU** : tu es membre. Interventions en commissions, keynotes lors d'événements de section.
- **Syndicat Enerplan / SER-SOLER** : organisations professionnelles du solaire FR — incontournables pour crédibiliser.
- **Salons** : Be Positive (Lyon), EnerJ-Meeting, Energaïa. Stand partagé avec BATILIAN pour mutualiser les coûts.
- **LinkedIn outbound** : tu appliques ton propre bot à ta propre cible (installateurs). Très méta, très efficace.
- **Contenu** : articles LinkedIn + vidéos courtes montrant des cas concrets anonymisés.

### B.6 Propriété intellectuelle et CGV

- Code et prompts = propriété **ERE Experts**
- Clients obtiennent une **licence d'usage** non exclusive et non transférable
- Données clients (prospects, réponses) = propriété du client, ERE Experts est **sous-traitant RGPD**
- **DPA (Data Processing Agreement)** standard à faire rédiger par un avocat spécialisé
- Clause de non-concurrence territoriale possible (un seul installateur par région) → levier de pricing premium

---

## ANNEXE C — Conformité RGPD + réglementaire FR

### C.1 Base légale des traitements

- **Prospection B2B (email)** : intérêt légitime (CNIL recommandation 2020), sous conditions
- **SMS cold B2B** : plus risqué, opt-in recommandé
- **Enrichissement contacts pro** : intérêt légitime, avec documentation rigoureuse des sources
- **Données propriétaires bâtiments (RBE, cadastre)** : données publiques, traitement libre mais respecter la finalité

### C.2 Obligations minimales

- **Registre des traitements** (art. 30 RGPD) tenu à jour dans `08_operations/registre_rgpd.md`
- **Mention d'information claire** dans chaque email : finalité + droits + contact DPO
- **Opt-out en un clic** dans chaque email (Lemlist le gère nativement)
- **Droit d'opposition, accès, rectification, effacement** : procédure documentée, SLA 30 jours max (72h idéal)
- **Analyse d'impact (AIPD)** recommandée dès que volume > 10 000 prospects/mois
- **Sous-traitants listés** : Pappers, Dropcontact, Google, fal.ai, Lemlist, Cal.com, Supabase, Vercel, Anthropic, etc.

### C.3 Données à ne JAMAIS collecter ni stocker

- Données de santé
- Opinions politiques / religieuses / syndicales
- Données personnelles des **salariés** des entreprises ciblées autres que décideurs pros contactés
- Données de géolocalisation au-delà de l'adresse postale du siège

### C.4 Hébergement

- **Supabase EU** (Francfort) — oui
- **Vercel** — transferts hors UE possibles, prévoir clauses contractuelles types
- **OVH** — alternative 100 % France si client sensible
- **Veo 3 / fal.ai** — hébergement US, ne traiter que des données non nominatives (image satellite uniquement, pas de nom)
- **Anthropic** — DPA disponible pour usage API entreprise

### C.5 Cadre réglementaire français à activer dans l'argumentaire commercial

| Texte | Obligation | Échéance / Trigger |
|---|---|---|
| **Loi APER** (2023) | Ombrières PV sur parkings > 1500 m² | Depuis juil. 2023 (existants) / juil. 2026 (progressif) |
| **Loi APER toitures** | PV ou végétalisation bâtiments neufs/rénovés > 500 m² (commerces, bureaux, entrepôts, hôpitaux, parkings couverts) | Depuis juil. 2023 |
| **Décret tertiaire** | -40 % conso énergétique finale d'ici 2030, -50 % 2040, -60 % 2050 | Déclarations OPERAT annuelles (28 sept.) |
| **DPE tertiaire** | Obligatoire avant vente / location | Variable |
| **Article 39 decies B du CGI** | Suramortissement 40 % sur équipements décarbonation | Investissements 2024–2027 |
| **RE2020** | Bâtiments neufs — plafonds énergie + carbone | Dépôts PC depuis 2022 |

---

## Conclusion

Ce guide est conçu pour être exploité directement. Chaque étape est actionnable, chaque outil est sourcé, chaque coût est estimé sur la base de la réalité marché France 2026.

Prochaines actions immédiates (si tu valides) :

1. Créer le **repo GitHub privé** `ere-experts/solar-bot`
2. Créer la **structure de dossiers** décrite en Annexe A.2
3. Provisionner **Claude Desktop + Cowork** sur les deux postes
4. Ouvrir les comptes fournisseurs : Supabase, Vercel, Pappers, Dropcontact, Lemlist
5. Passer BATILIAN en **client pilote interne** et lancer le **MVP v1 en 9 jours** (voir §14)

Pour toute question sur une section spécifique, ouvrir une issue dans le repo avec le tag `question/[nom-section]`.

---

*Document édité par ERE Experts — avril 2026. Basé sur la méthode OpenClaw Reroof (marché US) avec adaptations complètes au marché, à la réglementation et aux usages français.*
