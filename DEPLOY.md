# ERE SOLAR BOT — Guide de déploiement

---

## 1. Premier push vers GitHub

Depuis le dossier `solar-bot/` sur ta machine Windows :

```bash
# Option A — Script automatique
bash setup.sh

# Option B — Manuellement
git init
git remote add origin https://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@github.com/mehdiiialaoui1-ops/solar-bot.git
git checkout -b feature/setup-initial
cd 04_code && npm install && cd ..
git add -A
git commit -m "ajoute: scaffolding initial ERE SOLAR BOT"
git push -u origin feature/setup-initial
```

Puis ouvrir une **Pull Request** sur GitHub et attendre la review de Mehdi.

---

## 2. Configurer Supabase (EU Frankfurt)

### Créer le projet
1. Aller sur [app.supabase.com](https://app.supabase.com)
2. **New project** → Région : **EU West (Frankfurt)**
3. Nommer le projet : `solar-bot-prod`
4. Copier l'URL et les clés API dans `.env.local`

### Appliquer le schéma initial
1. Ouvrir **SQL Editor** dans le dashboard Supabase
2. Coller le contenu de `04_code/src/lib/supabase/migrations/001_schema_initial.sql`
3. Cliquer **Run**
4. Vérifier dans **Table Editor** que les 6 tables sont créées

### Variables à copier dans .env.local
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

---

## 3. Déployer sur Vercel

### Import du repo
1. Aller sur [vercel.com](https://vercel.com) → **Add New Project**
2. **Import Git Repository** → sélectionner `mehdiiialaoui1-ops/solar-bot`
3. **Root Directory** : `04_code` ← important !
4. Framework : **Next.js** (auto-détecté)
5. Cliquer **Deploy**

### Variables d'environnement Vercel
Dans **Settings → Environment Variables**, ajouter :

| Variable | Environment |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production + Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production + Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | Production + Preview |
| `GOOGLE_MAPS_API_KEY` | Production + Preview |
| `GOOGLE_SOLAR_API_KEY` | Production + Preview |
| `ANTHROPIC_API_KEY` | Production + Preview |
| `PAPPERS_API_KEY` | Production + Preview |
| `DROPCONTACT_API_KEY` | Production + Preview |
| `LEMLIST_API_KEY` | Production + Preview |

### Déploiement preview automatique
Vercel déploie automatiquement chaque Pull Request en preview.  
L'URL de preview est ajoutée directement dans la PR GitHub.

> **Convention ERE Experts :** toujours tester sur le preview avant de merger en main.

---

## 4. Workflow quotidien

```bash
# Chaque matin
git pull origin main

# Nouvelle tâche
git checkout -b feature/nom-de-la-tache

# Après le travail
git add -A
git commit -m "ajoute: description courte"
git push origin feature/nom-de-la-tache
# → Ouvrir PR sur GitHub → Mehdi review → merge
```

---

## 5. Lancer les tests en local

```bash
cd 04_code
npm install
npm test           # vitest run (une fois)
npm run test:watch # vitest (mode watch)
npm run type-check # vérification TypeScript
```

---

## 6. URLs importantes

| Environnement | URL |
|--------------|-----|
| Local        | http://localhost:3000 |
| Preview      | Auto-généré par Vercel par PR |
| Production   | À définir après merge main |
| Supabase     | https://app.supabase.com |
| Linear       | https://linear.app/ere-experts |
