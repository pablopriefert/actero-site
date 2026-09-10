# Architecture — comment tourne le moteur Actero

ACT-16. Pour quelqu'un qui arrive : d'où vient un message, qui décide de la réponse, où c'est stocké, ce qui casse si un fournisseur tombe. Vérifié dans le code le 10 septembre 2026 — pas de diagramme d'intention, que ce qui est branché.

## Le chemin d'un message — pipeline V2

C'est le pipeline avec les agents spécialisés. Quatre fichiers, dans l'ordre :

1. **`api/engine/gateway.js`** — point d'entrée HTTP. Authentifie (secret partagé pour les appels internes, JWT pour le dashboard), vérifie que l'appelant a le droit sur ce `client_id`, applique le rate-limit et le quota de tickets du plan, normalise l'événement (`lib/normalizer.js`) et charge le playbook actif du client (`lib/playbook-loader.js`).
2. **`brain.js`** — classifie le message (1 appel Claude), puis délègue à l'agent spécialisé qui correspond à la classification : `agents/order-agent.js` (suivi de commande), `return-agent.js` (retour/remboursement), `product-agent.js` (question produit), `escalation-agent.js` (client agressif/plainte), ou `general-agent.js` en repli (`agents/index.js` fait le routage). Le Brain lui-même ne répond plus au client depuis la V2 — il route. Il vérifie ensuite les signaux d'escalade (`lib/escalation-signals.js`) : sentiment ≤ 2, demande explicite d'un humain, classification agressive → le message part en révision humaine quel que soit ce que l'agent a répondu.
3. **`executor.js`** — si pas d'escalade, exécute le plan d'action du playbook étape par étape (`send_reply`, `escalate`, `notify_slack`, `create_ticket`, `lookup_order`, …). Les étapes irréversibles (envoi d'email, ticket) sont réservées avant exécution via `lib/action-claim.js` — un retry de cron ou un webhook redélivré ne double pas la réponse au client.
4. Une escalade déclenche toujours les mêmes trois effets (ticket + alerte marchand + webhook), qu'elle vienne de l'executor ou d'une mise en révision directe dans `gateway.js` — c'est centralisé dans **`lib/raise-escalation.js`** précisément parce que ça avait été oublié une fois côté révision (voir le commentaire en tête du fichier).

## Canaux d'entrée

Tous les canaux qui touchent un client final finissent normalisés dans la même forme (`{customer_email, message, subject, order_id, channel}` via `normalizeEvent`) — sauf deux, qui **ne passent pas par le pipeline V2 ci-dessus** :

| Canal | Endpoint | Pipeline |
|---|---|---|
| Widget site marchand | `webhooks/widget.js` | V2 — appelle `runBrain`/`runExecutor` directement, synchrone. Aussi utilisé par la démo (`DemoAgentPage.jsx`) et par l'outil MCP (`api/mcp/index.js`). |
| Email (polling cron) | `webhooks/inbound-email.js` | V2 |
| **Gorgias** | `webhooks/gorgias.js` | **V1** — voir plus bas |
| **Zendesk** | `webhooks/zendesk.js` | **V1** — voir plus bas |
| Vocal (ElevenLabs) | `webhooks/elevenlabs-postcall.js` | Ni l'un ni l'autre — la conversation a lieu côté ElevenLabs ; ce webhook ne fait que journaliser l'appel après coup dans `engine_events`/`ai_conversations` pour le dashboard. |
| `gateway.js` en direct | `/api/engine/gateway` | Réservé au dashboard : simulateur de conversation, assistant de setup, bouton de test rapide. Toujours appelé avec `is_test: true` ou des emails `*@actero-test.com`. Ce n'est pas un canal client. |

**Le point important : Gorgias et Zendesk tournent sur un pipeline différent.** `webhooks/gorgias.js` et `webhooks/zendesk.js` appellent `process.js` (`processMessage`), pas `brain.js`/`executor.js`. `process.js` fait un seul appel Claude monolithique (`buildSystemPrompt` + `buildMessages`, pas de classification séparée, pas d'agents spécialisés, pas de plan d'action) puis route la réponse via `respond.js`. Un marchand sur Gorgias ou Zendesk n'a donc ni les agents spécialisés, ni les actions de l'executor (`notify_slack`, `create_ticket`, le dédoublonnage par `action-claim.js`) — seulement une escalade si `should_escalate`/sentiment le déclenche. Documenter le pipeline V2 comme universel serait faux : c'est le pipeline de trois canaux sur cinq.

## Données — les tables qui structurent le flux

| Table | Rôle |
|---|---|
| `clients` | compte marchand : plan, essai, type de commerce |
| `client_integrations` (+ `client_shopify_connections` pour le jeton boutique) | identifiants chiffrés par connecteur — détail dans `credentials-runbook.md` |
| `engine_client_playbooks` | quel playbook (prompt de classification + règles de décision) est actif pour quel client et quel type d'événement |
| `engine_events` | chaque événement entrant traité par le pipeline V2 (pas alimentée par Gorgias/Zendesk, qui écrivent dans `engine_messages` via `process.js`) |
| `engine_runs_v2` | chaque exécution : classification, confiance, plan d'action, steps, coût et tokens |
| `engine_reviews_v2` | file de révision humaine (`needs_review`) — rien ne la surveille automatiquement au-delà de `raiseEscalation`, voir plus haut |
| `ai_conversations` | historique affiché au marchand dans le dashboard ; alimentée par les deux pipelines (V1 et V2) |
| `escalation_tickets` | tickets créés par `raiseEscalation` / l'action `create_ticket` |

## Ce qui tourne tout seul

Les crons (fréquences, ce qui les justifie, ce qui a été coupé faute de trafic) sont documentés dans **`docs/crons-cadences.md`** — ne pas le recopier ici.

## Dépendances externes

Supabase porte tout (données + auth + stockage). Le LLM du moteur passe par `lib/llm-client.js`, qui bascule sur `LLM_PROVIDER` (OpenRouter par défaut, repli Anthropic). Resend porte l'email sortant. Le détail complet — exposition par fournisseur, ce qui casse si chacun tombe, les trois avertissements sur la bascule LLM partielle et l'absence d'alerte de solde — vit dans **`docs/fournisseurs-registre.md`**.

## Composants présents dans le code, mais non branchés au pipeline

Ce dépôt a un défaut connu : du code fonctionnel qui n'est appelé par rien en production. Trois cas trouvés en vérifiant ce document :

- **`execute-agent-action.mjs`** + `agent-actions/refund-with-rules.js` + `agent-actions/discount-with-rules.js` : un exécuteur de remboursement/remise dans un bac à sable E2B isolé, avec audit complet (`agent_action_logs`). Entièrement fonctionnel, mais ni `executor.js` ni aucun agent (`return-agent.js` compris) ne l'appelle. Les seuls appelants sont des scripts de test (`scripts/test-e2b-action.mjs`, `api/dev/test-e2b-sandbox.mjs`). `return-agent.js` ne fait aujourd'hui que consulter la commande et répondre en texte — il n'exécute aucun remboursement réel.
- **`lib/normalizer.js`** : les fonctions `normalizeGorgias` et `normalizeZendesk`, enregistrées sous les clés `ticket_gorgias`/`ticket_zendesk`, ne sont jamais invoquées — conséquence directe du point ci-dessus : ces deux canaux ne passent jamais par `normalizeEvent`.
- **`executor.js`, action `wait_then`** : le code retourne `{scheduled: true}` sans rien planifier — aucune queue n'existe pour l'exécution différée. Assumé dans le commentaire du fichier, mais à savoir si un playbook y fait référence.
