# Textes fixes micro-site + Configuration Cal.com

> Contenus textuels non-dynamiques du micro-site personnalisé.
> Complète le brief_microsite.md (structure et design).
> Inclut la configuration Cal.com pour le CTA de prise de RDV.

---

## 1. Textes fixes du micro-site

### 1.1 — Bandeau supérieur

```
ERE Experts — Cabinet conseil en architecture et rénovation énergétique
```

### 1.2 — Section Hero — Sous-titre fixe

```
Étude réalisée par analyse satellite — données Google Solar API et cadastre IGN.
Pré-étude indicative, sans visite, sans engagement.
```

### 1.3 — Badges réglementaires (conditionnels)

**Si obligation_decret = true :**
```
DÉCRET TERTIAIRE — Bâtiment soumis à l'obligation de réduction des consommations
```

**Si obligation_aper = true :**
```
LOI APER — Site potentiellement soumis à l'obligation de solarisation
```

### 1.4 — Section "Détail de l'installation" — Disclaimer

```
Ces données sont issues de l'API Google Solar et du cadastre solaire national. 
Elles constituent une pré-étude indicative basée sur l'analyse satellite de 
votre toiture. Une visite technique sur site confirmera le dimensionnement 
final, les contraintes structurelles et le devis définitif.
```

### 1.5 — Section "Aides financières" — Textes d'accompagnement

**Introduction :**
```
Votre installation peut bénéficier de plusieurs dispositifs de soutien. 
Les montants ci-dessous sont estimatifs et basés sur les barèmes en vigueur 
au T2 2026.
```

**Note suramortissement :**
```
Le suramortissement fiscal (article 39 decies B du CGI) permet une déduction 
complémentaire pouvant aller jusqu'à 40 % du coût d'acquisition. Son 
applicabilité aux installations photovoltaïques en 2026 est soumise à des 
conditions spécifiques. Consultez votre expert-comptable pour vérifier 
votre éligibilité.
```

**Note décret tertiaire (si applicable) :**
```
Le décret tertiaire impose aux bâtiments de plus de 1 000 m² une réduction 
progressive de leurs consommations énergétiques :

-40 % d'ici 2030 — Déclaration annuelle obligatoire sur OPERAT
-50 % d'ici 2040
-60 % d'ici 2050

Non-respect : amende de 7 500 €/an et inscription au registre national 
des mauvais élèves ("name & shame").

L'autoconsommation solaire réduit directement vos consommations déclarées 
sur OPERAT et contribue à l'atteinte de vos objectifs.
```

**Note loi APER (si applicable) :**
```
La loi APER (Accélération de la Production d'Énergies Renouvelables) impose 
l'installation d'ombrières photovoltaïques sur les parkings de plus de 
1 500 m².

Échéances :
- Parkings > 10 000 m² : juillet 2026
- Parkings 1 500 à 10 000 m² : juillet 2028

Si votre site dispose d'un parking de cette taille, cette obligation 
s'ajoute au potentiel de toiture identifié dans cette étude.
```

### 1.6 — Section "Simulation financière" — Hypothèses

```
Hypothèses de calcul :
- Augmentation du prix de l'électricité : +3 %/an (moyenne historique)
- Dégradation annuelle des panneaux : -0,5 %/an
- Durée de vie de l'installation : 25 ans
- Taux d'autoconsommation estimé : 70 %
- Surplus revendu à EDF OA au tarif en vigueur

Ce calcul est indicatif et non contractuel. Le dimensionnement définitif 
sera établi après visite technique.
```

### 1.7 — Section CTA — Textes

**Titre :**
```
Discutons de votre projet
```

**Sous-titre :**
```
Un échange de 15 minutes, sans engagement, pour valider ces résultats 
et répondre à vos questions.
```

**Bouton :**
```
Réserver un créneau
```

**Sous le bouton :**
```
Gratuit, sans engagement.
Avec Mehdi Alaoui, architecte DPLG — 5 ans d'expérience en rénovation énergétique.
```

### 1.8 — Footer complet

```html
<footer>
  <div class="footer-brand">
    <p><strong>ERE Experts</strong></p>
    <p>Cabinet conseil en architecture et rénovation énergétique</p>
    <p>SIRET : [à compléter] | RCS [ville à compléter]</p>
    <p>Mehdi Alaoui — Architecte inscrit à l'Ordre, DPLG École Spéciale de Paris</p>
  </div>

  <div class="footer-legal">
    <p>
      Cette étude a été réalisée à partir de données satellite (Google Solar API) 
      et cadastrales (IGN, BDNB). Elle ne constitue pas un devis ni un engagement 
      contractuel. Les montants sont indicatifs et soumis à visite technique 
      préalable. Les aides financières mentionnées sont celles en vigueur au 
      T2 2026 et peuvent être modifiées par les pouvoirs publics.
    </p>
  </div>

  <div class="footer-rgpd">
    <p>
      <strong>Données personnelles</strong> — Vos coordonnées professionnelles 
      sont traitées sur la base de l'intérêt légitime (prospection B2B, art. 6.1.f 
      RGPD). Vous pouvez exercer vos droits d'accès, de rectification, d'effacement 
      ou d'opposition à tout moment en écrivant à 
      <a href="mailto:rgpd@ere-experts.fr">rgpd@ere-experts.fr</a>.
      Délai de traitement : 72 heures pour l'effacement, 30 jours pour les autres 
      demandes.
    </p>
    <p>
      <a href="https://ere-experts.fr/rgpd">Politique de confidentialité</a>
    </p>
  </div>
</footer>
```

---

## 2. Configuration Cal.com

### 2.1 — Compte

| Paramètre | Valeur |
|-----------|--------|
| Plateforme | Cal.com (plan gratuit suffisant pour le MVP) |
| URL d'équipe | cal.com/ere-experts |
| Fuseau horaire | Europe/Paris |

### 2.2 — Type d'événement "Découverte solaire"

| Paramètre | Valeur |
|-----------|--------|
| Nom | Découverte solaire — ERE Experts |
| Slug | `decouverte` |
| URL complète | `https://cal.com/ere-experts/decouverte` |
| Durée | 15 minutes |
| Description | "Échange gratuit pour valider l'étude solaire de votre bâtiment et répondre à vos questions. Avec Mehdi Alaoui, architecte DPLG." |
| Lieu | Google Meet (lien automatique) ou téléphone |
| Disponibilités | Lundi-vendredi, 9h-12h et 14h-18h (heure Paris) |
| Buffer avant | 5 minutes |
| Buffer après | 10 minutes |
| Max RDV/jour | 4 (pour ne pas saturer l'agenda) |
| Fenêtre de réservation | 14 jours à l'avance |
| Délai minimum | 4 heures avant le créneau |

### 2.3 — Lien pré-rempli depuis le micro-site

```
https://cal.com/ere-experts/decouverte?name={prenom}+{nom}&email={email}&notes=Bâtiment : {adresse}, {commune} — {puissance_kwc} kWc — Étude : {url_microsite}
```

**Paramètres URL :**

| Paramètre | Variable | Effet |
|-----------|----------|-------|
| `name` | `{prenom}+{nom}` | Pré-remplit le nom du prospect |
| `email` | `{email}` | Pré-remplit l'email |
| `notes` | adresse + kWc + lien | Contexte pour Mehdi avant le RDV |

### 2.4 — Email de confirmation Cal.com

**Personnaliser l'email de confirmation avec :**

```
Bonjour {nom},

Votre rendez-vous avec Mehdi Alaoui (ERE Experts) est confirmé.

Date : {date} à {heure}
Durée : 15 minutes
Lieu : {lien Google Meet}

Pour préparer notre échange, vous pouvez consulter l'étude de votre 
bâtiment : {notes — contient l'URL micro-site}

À très bientôt,
ERE Experts
```

### 2.5 — Webhook Cal.com → Supabase

**Événement :** `BOOKING_CREATED`

**Action :** Mettre à jour le statut du prospect dans Supabase.

```typescript
// 04_code/src/integrations/calcom-webhook.ts

interface CalComBooking {
  attendees: Array<{ email: string; name: string }>;
  startTime: string;
  endTime: string;
  metadata: { notes: string };
}

async function handleBookingCreated(booking: CalComBooking) {
  const email = booking.attendees[0]?.email;
  if (!email) return;

  // Trouver le contact par email
  const { data: contact } = await supabase
    .from('outreach_contacts')
    .select('prospect_id')
    .eq('email_pro', email)
    .single();

  if (contact) {
    // Mettre à jour le statut prospect → meeting_booked
    await supabase
      .from('prospects')
      .update({ statut: 'meeting_booked', updated_at: new Date().toISOString() })
      .eq('id', contact.prospect_id);

    // Mettre à jour le micro-site
    await supabase
      .from('microsites')
      .update({ cta_clicked: true, cta_clicked_at: new Date().toISOString() })
      .eq('prospect_id', contact.prospect_id);
  }
}
```

---

## 3. Checklist de mise en service

- [ ] Créer le compte Cal.com (cal.com/ere-experts)
- [ ] Configurer l'événement "Découverte solaire" (15 min)
- [ ] Connecter Google Calendar pour les disponibilités
- [ ] Personnaliser l'email de confirmation
- [ ] Configurer le webhook BOOKING_CREATED → endpoint Vercel
- [ ] Tester le lien pré-rempli avec un prospect fictif
- [ ] Vérifier que le statut Supabase passe bien à meeting_booked

---

*Document rédigé le 26 avril 2026 — Sprint MVP v1 — Rattrapage J8*
