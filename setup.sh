#!/bin/bash
# =============================================
# ERE SOLAR BOT — Script de setup initial
# À exécuter une seule fois depuis le dossier solar-bot/
# =============================================

set -e  # Arrêter en cas d'erreur

TOKEN="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"
REMOTE="https://${TOKEN}@github.com/mehdiiialaoui1-ops/solar-bot.git"
BRANCH="feature/setup-initial"

echo "🚀 ERE SOLAR BOT — Setup initial"
echo "================================="

# 1. Initialiser git si pas déjà fait
if [ ! -d ".git" ]; then
  echo "→ Initialisation du repo git..."
  git init
  git remote add origin "$REMOTE"
else
  echo "→ Repo git déjà initialisé"
  # S'assurer que le remote est correct
  git remote set-url origin "$REMOTE"
fi

# 2. Configuration git locale
git config user.name "Youssef"
git config user.email "aitsaid.youssef.fr@gmail.com"

# 3. Récupérer le main existant
echo "→ Récupération du main..."
git fetch origin main 2>/dev/null || echo "  (main vide ou premier push)"

# 4. Créer la branche feature
echo "→ Création de la branche $BRANCH..."
git checkout -b "$BRANCH" 2>/dev/null || git checkout "$BRANCH"

# 5. Installer les dépendances Node
echo "→ Installation des dépendances npm..."
cd 04_code
npm install
cd ..

# 6. Ajouter tous les fichiers
echo "→ Staging des fichiers..."
git add -A

# 7. Premier commit
echo "→ Commit initial..."
git commit -m "ajoute: scaffolding initial ERE SOLAR BOT

- Structure de dossiers complète (01_specs → 08_operations)
- Next.js 14 + TypeScript strict + Vitest configurés
- Fonctions de calcul solaire avec tests unitaires complets
- Schéma Supabase initial (6 tables + RLS + triggers)
- Base réglementaire FR 2026 (APER, décret tertiaire, CEE, aides)
- Registre RGPD
- Prompts systèmes v1 (email + classifieur inbox)
- .env.example avec toutes les variables requises"

# 8. Push
echo "→ Push vers GitHub..."
git push -u origin "$BRANCH"

echo ""
echo "✅ Push réussi !"
echo ""
echo "Prochaine étape :"
echo "  1. Aller sur https://github.com/mehdiiialaoui1-ops/solar-bot"
echo "  2. Ouvrir une Pull Request : $BRANCH → main"
echo "  3. Attendre la review de Mehdi avant de merger"
echo ""
echo "Pour les déploiements Vercel : voir DEPLOY.md"
