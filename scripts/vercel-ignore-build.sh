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

# 2. Depuis QUAND juger ce qui a changé.
#
#    Vercel fournit `VERCEL_GIT_PREVIOUS_SHA`, le commit du dernier déploiement
#    réussi. C'est la bonne référence : un push peut contenir plusieurs commits.
#    La première version comparait seulement HEAD^ et HEAD — un correctif de
#    l'application suivi d'un commit de doc, poussés ensemble, n'étaient donc
#    jamais déployés.
#
#    Si ce commit manque au clone (clone superficiel), on ne sait pas ce qui a
#    changé depuis : on construit. Sans la variable, on retombe sur HEAD^.
BASE="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -n "$BASE" ]; then
  if ! git cat-file -e "${BASE}^{commit}" 2>/dev/null; then
    echo "Dernier déploiement ($BASE) introuvable dans le clone — build lancé."
    exit 1
  fi
else
  BASE="HEAD^"
fi

# 3. Aucun fichier modifié du tout : c'est une relance volontaire (commit vide,
#    variable d'environnement changée). On construit.
#
#    14 septembre 2026 : le commit vide poussé pour relancer un correctif de
#    sécurité que Vercel n'avait pas pris a été SAUTÉ — « rien n'a changé » était
#    lu comme « seule la doc a changé ».
if ! CHANGEMENTS=$(git diff --name-only "$BASE" HEAD 2>/dev/null); then
  echo "Comparaison impossible avec $BASE — build lancé."
  exit 1
fi
if [ -z "$CHANGEMENTS" ]; then
  echo "Aucun fichier modifié : relance volontaire — build lancé."
  exit 1
fi

# 4. Si rien n'a bougé EN DEHORS de docs/, rien de déployé n'a changé.
#
#    `git diff --quiet` sort 0 quand il n'y a aucune différence — donc 0 ici
#    signifie « rien n'a bougé hors docs/ », et c'est exactement le cas où il
#    faut sauter.
if git diff --quiet "$BASE" HEAD -- . ':(exclude)docs' 2>/dev/null; then
  echo "Changement limité à docs/ — build sauté."
  exit 0
fi

echo "Changement dans l'application — build lancé."
exit 1
