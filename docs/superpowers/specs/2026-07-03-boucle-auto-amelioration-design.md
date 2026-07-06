# La Boucle — l'agent qui s'améliore tout seul

**Date :** 2026-07-03
**Statut :** design validé, prêt pour plan d'implémentation
**Auteur :** Pablo + Claude (CTO)

## Contexte & problème

Actero a déjà tout le pipeline IA (engine, playbooks, KB auto-crawlée, sentiment, vision…). Le marchand veut **travailler moins au quotidien** : moins de supervision, et des décisions prêtes à l'emploi (pilotage).

Aujourd'hui, quand l'agent ne sait pas répondre, il escalade. Le marchand répond à la main (dans `ClientEscalationsView`, avec déjà une case « Ajouter cette réponse à ma base »). Mais :
- c'est **manuel, un cas à la fois** — le marchand ne voit pas qu'il a répondu 8 fois à la même question ;
- il n'existe aucune **intelligence** qui détecte la récurrence, généralise une bonne réponse, et la propose ;
- `AgentImprovementWidget` existe mais n'est qu'un ensemble d'**heuristiques côté client** (seuils de comptage), avec des suggestions **génériques non-actionnables** (un lien vers un onglet), éphémères (dismiss en state local), sans IA et sans rédaction de la réponse.

## Objectif

Une boucle qui, chaque semaine, **mine les cas non auto-résolus** (escalades, faible confiance, feedback négatif) + **les réponses du marchand**, détecte les thèmes récurrents non couverts par la KB, et pour chacun **rédige une entrée KB prête à l'emploi** via Claude. Le marchand valide en **1 clic**. Comme la KB alimente l'engine, l'agent **cesse d'escalader ce cas** → boucle mesurable, zéro configuration.

Couvre les deux axes demandés : *supervision* (moins d'escalades répétées) et *pilotage* (le marchand voit ce qui coince + agit en 1 clic).

## Périmètre V1

- Catégorie de suggestion : **`kb_gap`** uniquement (trou dans la base de connaissances).
- Autonomie : **toujours validation en 1 clic**. Rien n'est ajouté à la KB ni modifié dans l'agent sans action explicite du marchand. (L'auto-application est explicitement **hors périmètre**, gardée pour une V2.)

## Architecture & composants

### a) Le mineur — `api/cron/improvement-loop.js` (cron hebdomadaire)
Wrappé dans `withCronMonitor`. Pour chaque client actif ayant assez de volume :
1. Rassemble les 30 derniers jours de cas non auto-résolus : escalades (`ai_conversations` / `automation_events` `ticket_escalated`), runs à faible confiance (`engine_runs_v2` `confidence < 0.6`), feedback négatif (`automation_events.feedback = 'negative'`). Récupère la **question client** et, quand elle existe, la **réponse humaine du marchand**.
2. Charge la KB active (`client_knowledge_base` où `is_active`) pour ne pas re-suggérer ce qui est déjà couvert.
3. **1 appel Claude structuré** (JSON) : regroupe les cas par thème (seuil ≥ 3 occurrences), et pour chaque thème rédige `{ theme, occurrences, kb_title, kb_content, evidence_conversation_ids, estimated_time_gain_minutes }`, en s'appuyant sur les réponses humaines quand elles existent, et en **ignorant les thèmes déjà couverts par la KB**.
4. Pour chaque suggestion : calcule un `fingerprint` (hash du thème normalisé) et **upsert** dans `ai_recommendations` (voir schéma). Ne recrée pas une suggestion déjà `pending` ou `implemented` pour le même fingerprint.

Fail-soft **par client** (une erreur n'interrompt pas les autres). 1 appel Claude / client / semaine, tokens plafonnés. Les clients sans volume suffisant sont ignorés.

### b) Le rail de suggestions — table `ai_recommendations` (réutilisée, aucune migration)
Champs utilisés :
- `category = 'kb_gap'`
- `title` = libellé court du thème (« Assurance et colis perdus »)
- `description` = phrase de contexte (« Des clients demandent si les colis sont assurés… »)
- `evidence` (jsonb) = `{ kb_title, kb_content, occurrences, conversation_ids }` — **le brouillon KB vit ici**
- `fingerprint` = dédup
- `impact_score`, `estimated_time_gain_minutes`
- `status` ∈ `pending` | `implemented` | `dismissed`
- `expires_at` = ~14 jours (les `pending` non traités expirent, pas de bruit permanent)
- `source_version` = version du mineur

### c) L'application 1 clic — `api/client/apply-recommendation.js`
`POST { reco_id }`. Étapes :
1. Auth + **ownership check** (le caller appartient au `client_id` de la reco — via `client_users` ou `clients.owner_user_id`, comme les correctifs sécurité du 2026-07-02).
2. Insère l'entrée dans `client_knowledge_base` depuis `evidence` : `source = 'improvement_loop'`, `needs_review = false` (validée par le marchand), `is_active = true`.
3. Marque la reco `implemented` via l'RPC `mark_ai_recommendation`.
4. Log un `automation_event` de traçabilité.

Endpoint « ignorer » : marque la reco `dismissed` (persistant, contrairement au state local actuel).

### d) La surface — évolution de `AgentImprovementWidget.jsx`
Remplace les heuristiques client par une lecture des `ai_recommendations` persistées (`category = 'kb_gap'`, `status = 'pending'`). Pour chaque suggestion : thème + nombre d'occurrences + **brouillon KB éditable** + boutons **Ajouter à ma base** (1 clic) / Modifier / Ignorer. Affiche aussi les recos `implemented` récentes avec leur mesure (Lot 2). Placé sur la **Vue d'ensemble** + miroir dans l'onglet **Base de connaissances**.

## Flux de données

```
cas non résolus + réponses marchand + KB actuelle
        │
        ▼  (mineur, hebdo)
  Claude : clustering thématique + rédaction d'entrée KB
        │
        ▼
  ai_recommendations (status=pending, evidence=brouillon KB, fingerprint)
        │
        ▼  widget (Vue d'ensemble / onglet KB)
   marchand : 1 clic « Ajouter à ma base »
        │
        ▼
  client_knowledge_base (source=improvement_loop) + reco implemented
        │
        ▼  au prochain ticket, l'engine lit la KB enrichie
   moins d'escalades sur ce thème
        │
        ▼  (mineur, semaine suivante) mesure la baisse → carte « résolu »
```

## UI (3 états)

1. **Suggestion détaillée (pending)** — badge « Trou dans ta base » + « revenu 8 fois cette semaine » ; phrase de contexte ; encart vert **« Entrée proposée pour ta base »** (titre + contenu, éditable) avec mention « rédigé à partir de tes réponses aux 8 clients » ; ligne d'impact (« éviterait ~8 escalades/mois · ~40 min ») ; actions **Ajouter à ma base** (pill vert `#0E653A`) / Modifier / Ignorer.
2. **Suggestion compacte (pending)** — thème + occurrences + proposition en une ligne + bouton **Ajouter** direct.
3. **État résolu/mesuré** — « X escalades la semaine d'avant → 0 depuis », chip « résolu ». (Lot 2.)

Style Actero : DM Sans + Instrument Serif, vert `#0E653A` (CTA), cartes blanches/crème, coins arrondis, pills. Suit la skill `actero-branding`.

## Garde-fous

- Fail-soft par client ; mineur sous `withCronMonitor`.
- Seuil ≥ 3 occurrences pour éviter le bruit.
- Dédup par `fingerprint` ; expiration des `pending` après ~14 j.
- 1 appel Claude / client / semaine, tokens plafonnés ; clients à faible volume ignorés.
- Le marchand garde le contrôle total : brouillon éditable, ignorable, aucun changement d'agent sans clic.
- Endpoint `apply` avec ownership check.

## Métriques de succès

- **Taux d'acceptation** des suggestions (implemented / (implemented + dismissed)) — vise > 60 %.
- **Escalades évitées** par thème après application (mesure avant/après).
- Baisse du taux d'escalade global des clients qui utilisent la boucle.

## Découpage en lots

- **Lot 1 (MVP)** : mineur (`kb_gap`) + écriture `ai_recommendations` + endpoint `apply` + évolution du widget (1 clic). Livre ~90 % de la valeur.
- **Lot 2** : mesure « escalades évitées » + carte « résolu » + placement Vue d'ensemble.
- **Lot 3 (futur)** : catégories `tone` / `rule` + option auto-application (la V2 écartée pour l'instant).

## Hors périmètre (V1)

- Auto-application des suggestions (V2).
- Suggestions de ton / de règles / de playbooks.
- Refonte de `IntelligenceView` (on branche le widget existant, pas de nouvelle page).
