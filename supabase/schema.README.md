# `schema.sql` — la photo du schéma de production

Généré le 10 septembre 2026 par `supabase db dump --linked`. **97 tables,
29 fonctions, 204 politiques RLS, 195 index.** Aucune donnée, aucun secret.

## Pourquoi ce fichier existe

Le dépôt contenait **55 migrations** quand la base en comptait **172**, et les
deux ensembles étaient quasi disjoints : tout le socle de février à août
n'existait qu'en base. Le schéma n'avait donc **aucune source de vérité
versionnée**.

Conséquence concrète, mesurée dans ACT-14 : une sauvegarde Supabase rend les
*données*, pas la capacité de **reconstruire le schéma ailleurs** — sur une
machine de développement, dans un environnement de test, ou chez un autre
hébergeur. C'est ce qui bloquait aussi ACT-15.

## Ce que ce fichier n'est pas

**Ce n'est pas une migration.** Ne pas le rejouer sur la base de production.
C'est une photo, destinée à recréer le schéma **ailleurs**, à partir de rien.

**11 septembre 2026** — les deux politiques de lecture de `ticket_backtests`
(ACT-18) ont été ajoutées **à la main** dans `schema.sql`, pas par un dump : le
worktree où la migration a été appliquée n'est pas lié au projet Supabase. Le
contenu est exact — vérifié par `pg_policies` après application — mais le
prochain `db dump` reste la seule source qui fasse foi.

**Il vieillit.** Chaque migration appliquée le rend un peu faux. Le
regénérer après une série de changements de schéma :

```bash
npx supabase db dump --linked -f supabase/schema.sql
```

Un fichier de schéma périmé est plus dangereux qu'aucun fichier : on croit
avoir une base reproductible et on découvre l'écart au pire moment.
