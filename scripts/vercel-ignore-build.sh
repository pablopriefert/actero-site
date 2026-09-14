#!/bin/sh
#
# Décide si Vercel doit construire ce commit.
#
#   exit 0  → Vercel SAUTE le build
#   exit 1  → Vercel construit
#
# POURQUOI CE FICHIER EXISTE
#
# Le 10 septembre 2026, Pablo : « pourquoi les builds ils mettent de plus en
# plus de temps ». Relevé sur deux déploiements terminés :
#
#   compilation du site (Vite)        ~30 s
#   prégénération des 27 pages SEO     ~1 s
#   empaquetage de 343 fonctions   13-15 min   ← aucun journal pendant ce temps
#   téléversement                    5-6 min
#
# Vingt minutes pour trente secondes de compilation. Ça, c'est structurel :
# une fonction serverless par fichier d'API, et il y en a 343.
#
# Ce qui a fait DÉBORDER, c'est la concurrence. Vingt déploiements en
# quatre-vingt-seize minutes, dont sept lancés par le robot de documentation.
# Les builds ne ralentissaient pas : ils ATTENDAIENT. Sur l'écran des
# déploiements, la durée affichée était exactement l'âge du déploiement.
#
# Le robot a produit CENT commits, et il ne touche que `docs/`. Vérifié : rien
# dans vite.config.js, index.html, src/ ou api/ ne lit ce dossier. La
# documentation est hébergée par Mintlify, pas par cette application. Chacun de
# ces cent commits a donc reconstruit 343 fonctions pour changer un fichier
# `.mdx` qui n'entre dans aucun bundle.
#
# LE SENS DE L'ÉCHEC
#
# Toutes les erreurs mènent à `exit 1`, donc à un build. Si `HEAD^` n'existe pas
# (premier commit, clone superficiel), git échoue, et on construit. On ne saute
# jamais un build par accident : on ne le saute que sur une certitude.

set -u

# 1. Les branches du robot ne déploient jamais l'application.
#    Une prévisualisation de l'app pour un changement de documentation ne montre
#    rien de nouveau — elle occupe seulement un créneau de build.
case "${VERCEL_GIT_COMMIT_REF:-}" in
  mintlify/*)
    echo "Branche de documentation (${VERCEL_GIT_COMMIT_REF}) — build sauté."
    exit 0
    ;;
esac

# 2. Sur toute autre branche, `main` comprise : si le commit ne touche RIEN
#    en dehors de docs/, il ne change rien de ce qui est déployé.
#
#    `git diff --quiet` sort 0 quand il n'y a aucune différence — donc 0 ici
#    signifie « rien n'a bougé hors docs/ », et c'est exactement le cas où il
#    faut sauter.
if git diff --quiet HEAD^ HEAD -- . ':(exclude)docs' 2>/dev/null; then
  echo "Changement limité à docs/ — build sauté."
  exit 0
fi

echo "Changement dans l'application — build lancé."
exit 1
