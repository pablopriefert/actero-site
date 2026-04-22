// N8N Copilot — AI-powered workflow management via Gemini
import { withSentry } from './lib/sentry.js'
import { createClient } from '@supabase/supabase-js';
import { isActeroAdmin } from './lib/admin-auth.js'

const N8N_URL = process.env.N8N_API_URL;
const N8N_KEY = process.env.N8N_API_KEY;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const TEMPLATE_ID = 'lW5HbUydhyrDrV0M'; // "Workflow 4 - Agent SAV - Template - READY" (41 nodes)

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Gemini helper with fallback ──────────────────────────────
const GEMINI_MODELS = [
  'gemini-3-flash',
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.0-flash',
];

async function askGemini(systemPrompt, userPrompt, jsonMode = true) {
  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.05,
              ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
            },
          }),
        }
      );
      if (!res.ok) {
        const errText = await res.text();
        lastError = new Error(`Gemini ${model} ${res.status}: ${errText.substring(0, 200)}`);
        continue; // try next model
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        lastError = new Error(`Réponse vide de ${model}`);
        continue;
      }
      return jsonMode ? JSON.parse(text) : text;
    } catch (e) {
      lastError = e;
      continue; // try next model
    }
  }
  throw lastError || new Error('Tous les modèles Gemini ont échoué');
}

// ── n8n helpers ────────────────────────────────────────────
async function n8nGet(path) {
  const r = await fetch(`${N8N_URL}/api/v1${path}`, { headers: { 'X-N8N-API-KEY': N8N_KEY } });
  if (!r.ok) throw new Error(`n8n GET ${path}: ${r.status}`);
  return r.json();
}

async function n8nPost(path, body) {
  const r = await fetch(`${N8N_URL}/api/v1${path}`, {
    method: 'POST', headers: { 'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`n8n POST ${path}: ${r.status} ${t}`); }
  return r.json();
}

async function n8nPut(path, body) {
  const r = await fetch(`${N8N_URL}/api/v1${path}`, {
    method: 'PUT', headers: { 'X-N8N-API-KEY': N8N_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`n8n PUT ${path}: ${r.status} ${t}`); }
  return r.json();
}

async function n8nDelete(path) {
  const r = await fetch(`${N8N_URL}/api/v1${path}`, {
    method: 'DELETE', headers: { 'X-N8N-API-KEY': N8N_KEY },
  });
  if (!r.ok && r.status !== 204) throw new Error(`n8n DELETE ${path}: ${r.status}`);
  return true;
}

// ── System prompts ─────────────────────────────────────────
const ROUTER_PROMPT = `Tu es l'IA Copilot Actero pour n8n. Tu analyses la demande de l'utilisateur et tu retournes un JSON décrivant l'action à effectuer.

CONTEXTE:
- Tu as accès aux workflows n8n et aux clients Actero
- Tu as accès à TOUTES les données Supabase: clients, connexions Shopify (shop_domain + access_token), paramètres (tarifs, coûts), métriques journalières, événements d'automatisation, pipeline funnel
- Quand on te demande des infos sur un client, utilise TOUTES ces données pour répondre en détail
- Le template SAV e-commerce est l'ID "${TEMPLATE_ID}"
- Quand tu crées un workflow qui utilise l'API Shopify d'un client, utilise son access_token depuis les données Shopify

ACTIONS POSSIBLES:
1. "gather_create" — L'utilisateur veut créer un workflow mais il manque des infos. Pose des questions QCM pour tout clarifier AVANT de créer.
2. "gather_modify" — L'utilisateur veut modifier un workflow mais il manque des infos. Pose des questions QCM pour clarifier.
3. "create" — Tu as TOUTES les infos nécessaires (via les réponses QCM précédentes). Crée le workflow.
4. "modify" — Tu as TOUTES les infos nécessaires. Modifie le workflow.
5. "duplicate" — Dupliquer le template SAV pour un client
6. "delete" — Supprimer un workflow
7. "toggle" — Activer/désactiver un workflow
8. "info" — Répondre à une question (pas d'action n8n)

RETOURNE CE JSON:
{
  "intent": "gather_create|gather_modify|create|modify|duplicate|delete|toggle|info",
  "workflowId": "ID si applicable (null sinon)",
  "workflowName": "nom du workflow si identifiable",
  "clientName": "nom du client si mentionné",
  "description": "description complète de ce qu'il faut faire",
  "message": "message à afficher à l'utilisateur",
  "activate": true/false (pour toggle, default false),
  "questions": [
    {
      "id": "q1",
      "question": "La question à poser",
      "options": ["Option A", "Option B", "Option C", "Option D"]
    }
  ]
}

RÈGLES POUR LES QUESTIONS (gather_create / gather_modify):
- TOUJOURS utiliser intent "gather_create" ou "gather_modify" quand l'utilisateur demande de créer ou modifier un workflow pour la PREMIÈRE fois (pas assez d'infos)
- Pose entre 3 et 6 questions QCM maximum
- Chaque question a 2 à 5 options claires
- Les questions doivent couvrir: le trigger (quand déclencher?), les actions (que faire?), les services (quels outils?), le client (pour qui?), la fréquence, les notifications
- Mets "questions" dans le JSON avec un array de questions
- Le "message" doit être une phrase d'introduction du style "Pour créer ce workflow, j'ai besoin de quelques précisions :"
- Si le message SUIVANT contient les réponses aux questions → utilise intent "create" ou "modify" avec toutes les infos

RÈGLES POUR CREATE/MODIFY:
- Utilise "create" ou "modify" SEULEMENT quand tu as reçu les réponses aux questions QCM
- Ou si l'utilisateur donne TOUTES les infos en un seul message (trigger, action, service, fréquence, etc.)

AUTRES RÈGLES:
- Si l'utilisateur mentionne un client, cherche le workflow associé par nom
- Si l'utilisateur veut déployer/onboarder un client → intent "duplicate"
- Si l'utilisateur pose une question → intent "info" et remplis "message" avec la réponse détaillée
- Tu as accès aux statistiques d'exécution. Utilise-les pour répondre aux questions sur les erreurs/santé/performances.
- Sois précis dans l'identification du workflowId`;

// n8n Expert Knowledge Base (production-ready, AI-first, minimal workflows)
const N8N_KNOWLEDGE = `
⚠️ LISTE BLANCHE STRICTE DES NODES — N'UTILISE AUCUN AUTRE TYPE DE NODE QUE CEUX LISTÉS CI-DESSOUS.
Si un node n'est pas dans cette liste, NE L'UTILISE PAS. Utilise httpRequest ou code à la place.
INTERDIT: tout node custom, tout node avec un "?" dans n8n, tout node qui n'est pas listé ici.

NODES AUTORISÉS (avec typeVersion EXACTE):

Triggers:
- n8n-nodes-base.scheduleTrigger (typeVersion: 1.2)
- n8n-nodes-base.webhook (typeVersion: 2)
- n8n-nodes-base.manualTrigger (typeVersion: 1)
- n8n-nodes-base.gmailTrigger (typeVersion: 1.3)
- n8n-nodes-base.telegramTrigger (typeVersion: 1.2)
- n8n-nodes-base.shopifyTrigger (typeVersion: 1)
- n8n-nodes-base.errorTrigger (typeVersion: 1)

Logic & Flow:
- n8n-nodes-base.if (typeVersion: 2)
- n8n-nodes-base.switch (typeVersion: 3.3)
- n8n-nodes-base.merge (typeVersion: 3.2)
- n8n-nodes-base.splitInBatches (typeVersion: 3)
- n8n-nodes-base.noOp (typeVersion: 1)
- n8n-nodes-base.wait (typeVersion: 1.1)
- n8n-nodes-base.respondToWebhook (typeVersion: 1.1)
- n8n-nodes-base.stopAndError (typeVersion: 1)

Data:
- n8n-nodes-base.set (typeVersion: 3.4) — UTILISE CE NODE POUR CONFIGURER DES VARIABLES
- n8n-nodes-base.code (typeVersion: 2) — UTILISE CE NODE POUR TOUTE LOGIQUE COMPLEXE
- n8n-nodes-base.httpRequest (typeVersion: 4.2) — UTILISE CE NODE POUR TOUTE API EXTERNE
- n8n-nodes-base.dateTime (typeVersion: 2)
- n8n-nodes-base.crypto (typeVersion: 1)

Communication:
- n8n-nodes-base.gmail (typeVersion: 2.1) — lire/envoyer des emails
- n8n-nodes-base.emailSend (typeVersion: 2.1) — envoyer via SMTP
- n8n-nodes-base.telegram (typeVersion: 1.2) — envoyer messages Telegram
- n8n-nodes-base.slack (typeVersion: 2.2) — notifications Slack
- n8n-nodes-base.discord (typeVersion: 2)

Storage & Database:
- n8n-nodes-base.googleSheets (typeVersion: 4.7) — lire/écrire Google Sheets
- n8n-nodes-base.googleDocs (typeVersion: 2) — lire Google Docs
- n8n-nodes-base.googleDocsTool (typeVersion: 2) — outil pour agent IA
- n8n-nodes-base.postgres (typeVersion: 2.5)
- n8n-nodes-base.airtable (typeVersion: 2.1)
- n8n-nodes-base.mongoDb (typeVersion: 1)
- n8n-nodes-base.redis (typeVersion: 1)
- n8n-nodes-base.shopify (typeVersion: 1)

IA & LangChain:
- @n8n/n8n-nodes-langchain.agent (typeVersion: 3) — agent IA principal
- @n8n/n8n-nodes-langchain.lmChatOpenAi (typeVersion: 1.3) — modèle GPT
- @n8n/n8n-nodes-langchain.memoryBufferWindow (typeVersion: 1.3) — mémoire conversation
- @n8n/n8n-nodes-langchain.vectorStoreSupabase (typeVersion: 1.3) — RAG avec Supabase
- @n8n/n8n-nodes-langchain.embeddingsOpenAi (typeVersion: 1.2) — embeddings
- @n8n/n8n-nodes-langchain.documentDefaultDataLoader (typeVersion: 1.1) — charger données
- @n8n/n8n-nodes-langchain.chainLlm (typeVersion: 1)

RÈGLE D'OR: N'utilise QUE les nodes de cette liste. Si tu as besoin d'une fonctionnalité absente, utilise httpRequest ou code.
NE JAMAIS inventer un type de node. Chaque node DOIT avoir ses paramètres COMPLETS et FONCTIONNELS.

EXPRESSION SYNTAX:
- Utilise {{ }} pour les expressions dans les paramètres string
- Variables: $json (données entrantes), $node["NomDuNode"].json, $now, $env
- IMPORTANT: Pour les webhooks, les données sont sous $json.body (pas $json directement)
- Référencer un autre node: {{ $node["Mon Node"].json.field }}
- Date: {{ $now.toISO() }}, {{ $now.minus({days: 7}).toISO() }}

5 PATTERNS ARCHITECTURAUX:
1. Webhook Processing: Webhook → Validate → Transform → Respond/Notify
2. HTTP API Integration: Trigger → HTTP Request → Transform → Action → Error Handler
3. Database Operations: Schedule → Query → Transform → Write → Verify
4. AI Agent: Trigger → AI Agent (Model + Tools + Memory) → Output
5. Scheduled Tasks: Schedule → Fetch → Process → Deliver → Log

STRUCTURE D'UN NODE:
{
  "id": "uuid-unique",
  "name": "Nom descriptif",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [x, y],  // Espacement: +250 horizontal entre nodes
  "parameters": { ... }
}

CONNECTIONS FORMAT:
{
  "connections": {
    "Nom du node source": {
      "main": [[{ "node": "Nom du node cible", "type": "main", "index": 0 }]]
    }
  }
}

ERREURS COURANTES À ÉVITER:
- Ne PAS utiliser "nodes-base.*", utiliser "n8n-nodes-base.*"
- Ne PAS oublier typeVersion (requis pour chaque node)
- Ne PAS hardcoder des credentials dans les paramètres
- Toujours settings: { executionOrder: "v1" }
- Pour le Code node: retourner un ARRAY d'objets: return items.map(item => ({ json: { ... } }))
- Pour Set node: utiliser assignments avec {name, value, type} dans typeVersion 3.4

N8N EXPERT — PRINCIPES DE CONCEPTION:

PRIORITÉS PAR DÉFAUT (dans l'ordre):
1. Construire le workflow le plus PETIT possible qui fonctionne
2. Le chemin principal doit être compréhensible par un enfant de 8 ans
3. Préférer les nodes natifs n8n au lieu de HTTP Request
4. Préférer AI Agent et AI Agent Tool au lieu de Code nodes quand possible
5. Ajouter des notes pour que chaque section soit compréhensible
6. Chaque node doit justifier son existence — si tu peux l'enlever sans casser le workflow, enlève-le

HIÉRARCHIE DE DÉCISION (préférer le haut):
1. Un seul node natif
2. Petite chaîne de nodes natifs
3. AI Agent avec outils natifs
4. AI Agent + AI Agent Tool nodes
5. HTTP Request node (justifier pourquoi)
6. Code node (justifier pourquoi)

ANTI-PATTERNS À ÉVITER:
- Ajouter des nodes helper qui renomment 1-2 champs → utiliser des expressions
- Splitter un flow linéaire en branches sans raison
- Noms de nodes techniques qui cachent le but métier
- Workflow sans notes
- Utiliser HTTP Request quand un node natif existe
- Utiliser Code pour de la logique qui tient dans une expression

PATTERNS ARCHITECTURAUX PRÉFÉRÉS:
1. Simple AI Worker: Trigger → AI Agent → Action finale (pour classification, résumé, extraction)
2. AI Agent With Tools: Trigger → AI Agent → Tool nodes → Action (pour lookup + réponse)
3. Webhook Processing: Webhook → Validate → Transform → Respond
4. Scheduled Task: Schedule → Fetch → Process → Deliver → Log

NOTES WORKFLOW OBLIGATOIRES:
Chaque workflow non-trivial DOIT avoir des notes (Sticky Notes) expliquant:
- Start: ce qui déclenche le workflow
- Brain: où l'IA est utilisée et ce qu'elle fait
- Tools: quels systèmes externes sont touchés
- Finish: ce que le workflow produit/envoie/stocke
Style: langage simple, pas de jargon technique

TRACKING MÉTRIQUES OBLIGATOIRE:
Chaque workflow DOIT inclure un node "📊 Tracker Métriques" qui insère dans automation_events.
Ce node est un httpRequest POST vers Supabase avec les champs:
- client_id: UUID du client (depuis le node ⚙️ Config)
- event_category: support_ticket | cart_recovery | lead_qualified | email_sent | alert
- event_type: type précis (ticket_auto_resolved, cart_recovered, lead_scored, etc.)
- description: texte lisible en français
- revenue_amount: montant en euros si applicable (sinon 0)
- time_saved_seconds: estimation du temps économisé (min 60s)
- metadata: { source: "n8n", workflow_name: "nom" }
- metrics_counted: false (TOUJOURS false)

PLACEMENT DU TRACKER:
- APRÈS chaque action réussie
- AVANT le node de réponse finale
- Si branches multiples → un tracker sur CHAQUE branche de succès

NODE ⚙️ CONFIG OBLIGATOIRE:
Chaque workflow commence par: Trigger → ⚙️ Config (Set node) → reste du flow
Le Config contient: client_id, client_name, supabase_url

ESTIMATION time_saved_seconds PAR TYPE:
- Ticket SAV traité: 300 (5 min)
- Panier relancé: 180 (3 min)
- Lead qualifié: 480 (8 min)
- Email envoyé: 120 (2 min)
- Alerte: 60 (1 min)

CHECKLIST AVANT LIVRAISON:
1. Le workflow peut-il être plus petit? Si oui, simplifier
2. Chaque node a un nom clair en langage simple?
3. Les notes sont présentes pour Start, Brain, Tools, Finish?
4. Le node ⚙️ Config est en 2e position?
5. Le node 📊 Tracker Métriques est avant la fin?
6. Tous les nodes sont dans la LISTE BLANCHE?
7. Aucun Code ou HTTP Request injustifié?
`;

// Real node examples from production workflows
const NODE_EXAMPLES = `
EXEMPLES DE NODES RÉELS PRODUCTION-READY (copie ce format EXACTEMENT):

1. Schedule Trigger (toutes les 5 min):
{"name":"Schedule Trigger","type":"n8n-nodes-base.scheduleTrigger","typeVersion":1.2,"position":[220,300],"parameters":{"rule":{"interval":[{"field":"minutes","minutesInterval":5}]}},"id":"uuid-1"}

2. Webhook Trigger:
{"name":"Webhook","type":"n8n-nodes-base.webhook","typeVersion":2,"position":[220,300],"parameters":{"path":"mon-webhook","httpMethod":"POST","responseMode":"responseNode","options":{}},"id":"uuid-2"}

3. HTTP Request (GET Supabase):
{"name":"Fetch Data","type":"n8n-nodes-base.httpRequest","typeVersion":4.2,"position":[470,300],"parameters":{"method":"GET","url":"https://ejgdwjjcpjtwaqcxptke.supabase.co/rest/v1/automation_events?limit=100","authentication":"predefinedCredentialType","nodeCredentialType":"supabaseApi","sendHeaders":true,"headerParameters":{"parameters":[{"name":"Content-Type","value":"application/json"}]},"options":{"response":{"response":{"responseFormat":"json"}}}},"credentials":{"supabaseApi":{"id":"NswS61zLLGuXpo97","name":"Supabase account"}},"id":"uuid-3"}

4. HTTP Request (POST Supabase):
{"name":"Insert Data","type":"n8n-nodes-base.httpRequest","typeVersion":4.2,"position":[720,300],"parameters":{"method":"POST","url":"https://ejgdwjjcpjtwaqcxptke.supabase.co/rest/v1/automation_events","authentication":"predefinedCredentialType","nodeCredentialType":"supabaseApi","sendHeaders":true,"headerParameters":{"parameters":[{"name":"Content-Type","value":"application/json"},{"name":"Prefer","value":"return=representation"}]},"sendBody":true,"specifyBody":"json","jsonBody":"={{ JSON.stringify($json) }}","options":{"response":{"response":{"responseFormat":"json"}}}},"credentials":{"supabaseApi":{"id":"NswS61zLLGuXpo97","name":"Supabase account"}},"id":"uuid-4"}

5. IF Condition:
{"name":"Vérifier données","type":"n8n-nodes-base.if","typeVersion":2,"position":[470,300],"parameters":{"conditions":{"options":{"caseSensitive":true,"leftValue":"","typeValidation":"strict"},"conditions":[{"id":"uuid","leftValue":"={{ $json.status }}","rightValue":"active","operator":{"type":"string","operation":"equals"}}],"combinator":"and"}},"id":"uuid-5"}

6. Code Node (JavaScript):
{"name":"Traiter données","type":"n8n-nodes-base.code","typeVersion":2,"position":[720,300],"parameters":{"jsCode":"const items = $input.all();\\nconst results = items.map(item => ({\\n  json: {\\n    client_id: item.json.client_id,\\n    processed: true,\\n    timestamp: new Date().toISOString()\\n  }\\n}));\\nreturn results;"},"id":"uuid-6"}

7. Set Node (mapping):
{"name":"Préparer données","type":"n8n-nodes-base.set","typeVersion":3.4,"position":[720,300],"parameters":{"mode":"manual","duplicateItem":false,"assignments":{"assignments":[{"id":"uuid","name":"client_id","value":"={{ $json.client_id }}","type":"string"},{"id":"uuid","name":"status","value":"active","type":"string"}]}},"id":"uuid-7"}

8. Slack Notification:
{"name":"Notifier Slack","type":"n8n-nodes-base.slack","typeVersion":2.2,"position":[970,300],"parameters":{"resource":"message","operation":"post","channel":{"__rl":true,"value":"#notifications","mode":"name"},"text":"={{ $json.message }}","otherOptions":{}},"credentials":{"slackApi":{"id":"SLACK_CRED_ID","name":"Slack"}},"id":"uuid-8"}

9. Email Send:
{"name":"Envoyer Email","type":"n8n-nodes-base.emailSend","typeVersion":2.1,"position":[970,300],"parameters":{"fromEmail":"noreply@actero.fr","toEmail":"={{ $json.email }}","subject":"Notification","emailType":"text","message":"={{ $json.message }}"},"credentials":{"smtp":{"id":"SMTP_CRED_ID","name":"SMTP"}},"id":"uuid-9"}

10. Split In Batches:
{"name":"Boucle","type":"n8n-nodes-base.splitInBatches","typeVersion":3,"position":[470,300],"parameters":{"batchSize":1,"options":{}},"id":"uuid-10"}

11. Respond To Webhook:
{"name":"Répondre","type":"n8n-nodes-base.respondToWebhook","typeVersion":1.1,"position":[970,300],"parameters":{"respondWith":"json","responseBody":"={{ JSON.stringify({ success: true, data: $json }) }}","options":{"responseCode":200}},"id":"uuid-11"}

12. No Operation (pour branching):
{"name":"Ne rien faire","type":"n8n-nodes-base.noOp","typeVersion":1,"position":[720,500],"parameters":{},"id":"uuid-12"}

13. ⚙️ Config Node (OBLIGATOIRE en 2e position dans chaque workflow):
{"name":"⚙️ Config","type":"n8n-nodes-base.set","typeVersion":3.4,"position":[470,300],"parameters":{"mode":"manual","duplicateItem":false,"assignments":{"assignments":[{"id":"cfg-1","name":"client_id","value":"CLIENT_ID_A_REMPLACER","type":"string"},{"id":"cfg-2","name":"client_name","value":"Nom du client","type":"string"},{"id":"cfg-3","name":"supabase_url","value":"https://ejgdwjjcpjtwaqcxptke.supabase.co/rest/v1","type":"string"}]}},"id":"config-uuid"}

14. 📊 Tracker Métriques Supabase (OBLIGATOIRE en fin de chaque workflow):
{"name":"📊 Tracker Métriques","type":"n8n-nodes-base.httpRequest","typeVersion":4.2,"position":[1500,300],"parameters":{"method":"POST","url":"https://ejgdwjjcpjtwaqcxptke.supabase.co/rest/v1/automation_events","authentication":"predefinedCredentialType","nodeCredentialType":"supabaseApi","sendHeaders":true,"headerParameters":{"parameters":[{"name":"Content-Type","value":"application/json"},{"name":"Prefer","value":"return=representation"}]},"sendBody":true,"contentType":"json","specifyBody":"json","jsonBody":"={{ JSON.stringify({ client_id: $node[\\\"⚙️ Config\\\"].json.client_id, event_category: \\\"support_ticket\\\", event_type: \\\"ticket_auto_resolved\\\", description: \\\"Ticket traité automatiquement par IA\\\", revenue_amount: 0, time_saved_seconds: 300, metadata: { source: \\\"n8n\\\", workflow_name: \\\"SAV\\\" }, metrics_counted: false }) }}","options":{"response":{"response":{"responseFormat":"json"}}}},"credentials":{"supabaseApi":{"id":"NswS61zLLGuXpo97","name":"Supabase account"}},"id":"tracker-uuid"}

15. Sticky Note (pour annoter le workflow):
{"name":"📝 Note","type":"n8n-nodes-base.stickyNote","typeVersion":1,"position":[200,100],"parameters":{"content":"## Start\\nCe workflow se déclenche quand...","width":250,"height":150},"id":"note-uuid"}

CONNECTIONS FORMAT:
{"NomNodeSource":{"main":[[{"node":"NomNodeCible","type":"main","index":0}]]}}
Pour IF avec 2 branches: {"Vérifier":{"main":[[{"node":"SiVrai","type":"main","index":0}],[{"node":"SiFaux","type":"main","index":0}]]}}

SUPABASE CREDENTIALS ACTERO (à utiliser pour tous les nodes Supabase):
{"supabaseApi":{"id":"NswS61zLLGuXpo97","name":"Supabase account"}}

SUPABASE URL: https://ejgdwjjcpjtwaqcxptke.supabase.co/rest/v1/
`;

// Reference architecture from the production-ready SAV template
const SAV_TEMPLATE_REFERENCE = `
TEMPLATE DE RÉFÉRENCE — "Agent SAV Multi-Canal Intelligent" (41 nodes, PRODUCTION-READY)
Utilise cette architecture comme modèle pour créer des workflows de qualité production.

ARCHITECTURE EN 4 ÉTAPES:
Step 1 — Réception & Qualification:
  Triggers multi-canaux (Gmail Trigger v1.3 + Telegram Trigger v1.2)
  → Nodes ⚙️ CONFIGURATION (Set v3.4) pour les variables client (googleSheetId, googleDocKbId, supportEmail)
  → Lookup mémoire conversationnelle (Google Sheets v4.7 — filtersUI par chatId/threadId)
  → Code v2 pour préparer l'historique (formatter les messages passés en contexte)

Step 2 — Normalisation & RAG:
  → Code v2: Normalisation des données (unifie le format entre Gmail et Telegram)
  → Code v2: Résumé & Priorité (analyse le message, extrait l'intention, détermine la priorité)
  → vectorStoreSupabase v1.3 (mode: "retrieve", tableName: "documents") pour recherche KB
  → Code v2: Agrégateur de connaissances (combine KB results + historique)

Step 3 — Agent IA:
  → Merge v3.2 (mode: "combine", combineBy: "position") — fusionne contexte + données
  → Agent LangChain v3 (promptType: "define", text: prompt complet avec instructions SAV)
    Sub-nodes connectés à l'agent:
    - lmChatOpenAi v1.3 (model: "gpt-4o-mini") — connecté via ai_languageModel
    - memoryBufferWindow v1.3 (sessionKey dynamique) — connecté via ai_memory
    - embeddingsOpenAi v1.2 — connecté via ai_embedding
    - googleDocsTool v2 — connecté via ai_tool (accès direct à la KB)
  → Code v2: Extraction réponse IA (parse la sortie de l'agent)

Step 4 — Réponse & Mémoire:
  → Switch v3.3 (aiguillage par canal: email ou telegram)
  → Gmail v2.1 (operation: "reply", messageId dynamique) OU Telegram v1.2 (chatId dynamique)
  → Code v2: Préparer stockage mémoire (formater l'échange pour archivage)
  → Google Sheets v4.7 (operation: "appendOrUpdate") — sauvegarde de la conversation

PIPELINE INDEXATION (séparé, exécuté une seule fois):
  Manual Trigger → Google Docs v2 (operation: "get") → Code v2 (formatter le texte)
  → vectorStoreSupabase v1.3 (mode: "insert") avec embeddingsOpenAi v1.2 + documentDefaultDataLoader v1.1

CREDENTIALS REQUISES:
- OpenAI API (pour GPT-4o-mini et Embeddings)
- Supabase API (pour stockage vectoriel RAG)
- Google OAuth2 (pour Docs, Sheets, Gmail)
- Telegram API (pour le bot)

BONNES PRATIQUES DU TEMPLATE:
- Noms de nodes descriptifs avec préfixes: ⚙️ pour config, 📧 pour email, 🤖 pour IA
- Nodes CONFIGURATION (Set) en début de flow pour centraliser les variables
- Code nodes pour TOUTE transformation de données (jamais de logique dans les paramètres)
- Mémoire conversationnelle via Google Sheets (pas en mémoire volatile)
- Switch pour l'aiguillage multi-canal (pas des IF imbriqués)
`;

const MODIFY_PROMPT = `Tu es un ingénieur n8n expert. Modifie le workflow JSON selon la demande.

${N8N_KNOWLEDGE}

${SAV_TEMPLATE_REFERENCE}

${NODE_EXAMPLES}

RÈGLES MODIFICATION:
- Retourne UNIQUEMENT le workflow modifié en JSON valide (name, nodes, connections, settings)
- Ne change JAMAIS les credentials ni les IDs de credentials existants
- Conserve les nodes existants sauf demande explicite de suppression
- CHAQUE node DOIT avoir: id, name, type, typeVersion, position, parameters (JAMAIS vides)
- Positionne les nouveaux nodes à +250px horizontal du dernier
- Connecte les nodes via "connections" avec le format exact montré ci-dessus
- Garde le même name, settings du workflow original
- Si le workflow n'a PAS de node "📊 Tracker Métriques", AJOUTE-EN UN qui POST vers automation_events
- Si le workflow n'a PAS de node "⚙️ Config", AJOUTE-EN UN après le trigger avec client_id
- Les notes (Sticky Notes) doivent être préservées et ajoutées si absentes`;

const CREATE_PROMPT = `Tu es un ingénieur n8n expert. Crée un workflow n8n COMPLET, FONCTIONNEL et PRODUCTION-READY.

${N8N_KNOWLEDGE}

${SAV_TEMPLATE_REFERENCE}

${NODE_EXAMPLES}

RÈGLES CRÉATION STRICTES:
- Retourne un JSON avec: name, nodes, connections, settings
- CHAQUE node DOIT avoir: id (UUID unique), name, type, typeVersion (CORRECT!), position [x, y], parameters (JAMAIS vides!)
- Utilise les exemples de nodes ci-dessus comme MODÈLE EXACT — copie le format
- typeVersion DOIT correspondre à la version exacte listée dans la LISTE BLANCHE ci-dessus
- Le premier node est un trigger positionné à [220, 300]
- Espacement: +250px horizontal entre chaque node, +200px vertical pour les branches
- settings: { "executionOrder": "v1" }
- TOUS les nodes doivent être connectés via "connections"
- Les paramètres de chaque node doivent être COMPLETS et fonctionnels
- Si le workflow utilise Supabase, utilise les credentials Actero indiquées
- Noms de nodes descriptifs en français
- Pour les HTTP Request vers Supabase: TOUJOURS mettre authentication, nodeCredentialType, headers Content-Type
- Ne retourne JAMAIS un node avec parameters: {} vide (sauf noOp)

⛔ INTERDICTIONS ABSOLUES:
- JAMAIS de node qui n'est pas dans la LISTE BLANCHE. Si tu as besoin d'une fonctionnalité qui n'est pas dans la liste, utilise httpRequest ou code.
- JAMAIS de node "custom" ou avec un type inventé
- JAMAIS de node sans paramètres remplis (sauf noOp et manualTrigger)
- Pour appeler une API (Shopify, OpenAI, Stripe, etc.), utilise TOUJOURS httpRequest avec method, url, headers, body
- Pour transformer des données, utilise TOUJOURS le node code avec du JavaScript fonctionnel
- Pour Supabase, utilise TOUJOURS httpRequest avec les credentials supabaseApi`;

// ── Node whitelist & validator ──────────────────────────────
const VALID_NODE_TYPES = new Set([
  // Triggers
  'n8n-nodes-base.scheduleTrigger', 'n8n-nodes-base.webhook', 'n8n-nodes-base.manualTrigger',
  'n8n-nodes-base.gmailTrigger', 'n8n-nodes-base.telegramTrigger', 'n8n-nodes-base.shopifyTrigger',
  'n8n-nodes-base.errorTrigger',
  // Logic & Flow
  'n8n-nodes-base.if', 'n8n-nodes-base.switch', 'n8n-nodes-base.merge', 'n8n-nodes-base.splitInBatches',
  'n8n-nodes-base.noOp', 'n8n-nodes-base.wait', 'n8n-nodes-base.respondToWebhook', 'n8n-nodes-base.stopAndError',
  // Data
  'n8n-nodes-base.set', 'n8n-nodes-base.code', 'n8n-nodes-base.httpRequest',
  'n8n-nodes-base.dateTime', 'n8n-nodes-base.crypto',
  // Communication
  'n8n-nodes-base.gmail', 'n8n-nodes-base.emailSend', 'n8n-nodes-base.telegram',
  'n8n-nodes-base.slack', 'n8n-nodes-base.discord',
  // Storage & Database
  'n8n-nodes-base.googleSheets', 'n8n-nodes-base.googleDocs', 'n8n-nodes-base.googleDocsTool',
  'n8n-nodes-base.postgres', 'n8n-nodes-base.airtable', 'n8n-nodes-base.mongoDb', 'n8n-nodes-base.redis',
  'n8n-nodes-base.shopify',
  // IA & LangChain
  '@n8n/n8n-nodes-langchain.agent', '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  '@n8n/n8n-nodes-langchain.chainLlm', '@n8n/n8n-nodes-langchain.memoryBufferWindow',
  '@n8n/n8n-nodes-langchain.vectorStoreSupabase', '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
  '@n8n/n8n-nodes-langchain.documentDefaultDataLoader',
  // Sticky notes (keep them)
  'n8n-nodes-base.stickyNote',
]);

const TYPE_VERSIONS = {
  // Triggers
  'n8n-nodes-base.scheduleTrigger': 1.2, 'n8n-nodes-base.webhook': 2, 'n8n-nodes-base.manualTrigger': 1,
  'n8n-nodes-base.gmailTrigger': 1.3, 'n8n-nodes-base.telegramTrigger': 1.2,
  'n8n-nodes-base.shopifyTrigger': 1, 'n8n-nodes-base.errorTrigger': 1,
  // Logic
  'n8n-nodes-base.if': 2, 'n8n-nodes-base.switch': 3.3, 'n8n-nodes-base.merge': 3.2,
  'n8n-nodes-base.splitInBatches': 3, 'n8n-nodes-base.noOp': 1, 'n8n-nodes-base.wait': 1.1,
  'n8n-nodes-base.respondToWebhook': 1.1, 'n8n-nodes-base.stopAndError': 1,
  // Data
  'n8n-nodes-base.set': 3.4, 'n8n-nodes-base.code': 2, 'n8n-nodes-base.httpRequest': 4.2,
  'n8n-nodes-base.dateTime': 2, 'n8n-nodes-base.crypto': 1,
  // Communication
  'n8n-nodes-base.gmail': 2.1, 'n8n-nodes-base.emailSend': 2.1, 'n8n-nodes-base.telegram': 1.2,
  'n8n-nodes-base.slack': 2.2, 'n8n-nodes-base.discord': 2,
  // Storage
  'n8n-nodes-base.googleSheets': 4.7, 'n8n-nodes-base.googleDocs': 2, 'n8n-nodes-base.googleDocsTool': 2,
  'n8n-nodes-base.postgres': 2.5, 'n8n-nodes-base.airtable': 2.1, 'n8n-nodes-base.mongoDb': 1, 'n8n-nodes-base.redis': 1,
  'n8n-nodes-base.shopify': 1,
  // IA
  '@n8n/n8n-nodes-langchain.agent': 3, '@n8n/n8n-nodes-langchain.lmChatOpenAi': 1.3,
  '@n8n/n8n-nodes-langchain.chainLlm': 1, '@n8n/n8n-nodes-langchain.memoryBufferWindow': 1.3,
  '@n8n/n8n-nodes-langchain.vectorStoreSupabase': 1.3, '@n8n/n8n-nodes-langchain.embeddingsOpenAi': 1.2,
  '@n8n/n8n-nodes-langchain.documentDefaultDataLoader': 1.1,
};

function sanitizeWorkflow(workflow) {
  if (!workflow || !workflow.nodes) return workflow;

  workflow.nodes = workflow.nodes.map(node => {
    // Fix missing or invalid type → replace with httpRequest or code
    if (!node.type || !VALID_NODE_TYPES.has(node.type)) {
      const origType = node.type || 'unknown';
      // If it looks like a trigger, replace with manualTrigger
      if (origType.toLowerCase().includes('trigger')) {
        node.type = 'n8n-nodes-base.manualTrigger';
        node.typeVersion = 1;
        node.parameters = {};
      }
      // If it looks like data processing, replace with code node
      else if (origType.toLowerCase().match(/transform|convert|extract|parse|filter|format/)) {
        node.type = 'n8n-nodes-base.code';
        node.typeVersion = 2;
        node.parameters = {
          jsCode: `// Remplace le node invalide: ${origType}\nconst items = $input.all();\n// TODO: implémenter la logique de ${node.name}\nreturn items;`
        };
      }
      // Default: replace with httpRequest for API calls or code for logic
      else {
        node.type = 'n8n-nodes-base.code';
        node.typeVersion = 2;
        node.parameters = {
          jsCode: `// Remplace le node invalide: ${origType}\nconst items = $input.all();\n// TODO: implémenter la logique de ${node.name}\nreturn items;`
        };
      }
    }

    // Fix typeVersion
    if (TYPE_VERSIONS[node.type] && (!node.typeVersion || node.typeVersion !== TYPE_VERSIONS[node.type])) {
      node.typeVersion = TYPE_VERSIONS[node.type];
    }

    // Ensure required fields
    if (!node.id) node.id = crypto.randomUUID();
    if (!node.position) node.position = [220, 300];
    if (!node.parameters) node.parameters = {};

    return node;
  });

  // Ensure settings
  if (!workflow.settings) workflow.settings = { executionOrder: 'v1' };
  if (!workflow.settings.executionOrder) workflow.settings.executionOrder = 'v1';

  // ── Auto-inject ⚙️ Config if missing ──
  const hasConfig = workflow.nodes.some(n => n.name?.includes('Config') || n.name?.includes('⚙️'));
  if (!hasConfig) {
    const triggers = workflow.nodes.filter(n => n.type?.includes('Trigger') || n.type?.includes('trigger') || n.type?.includes('webhook'));
    if (triggers.length > 0) {
      const configNode = {
        id: crypto.randomUUID ? crypto.randomUUID() : `config-${Date.now()}`,
        name: '⚙️ Config',
        type: 'n8n-nodes-base.set',
        typeVersion: 3.4,
        position: [(triggers[0].position?.[0] || 220) + 250, triggers[0].position?.[1] || 300],
        parameters: {
          mode: 'manual', duplicateItem: false,
          assignments: { assignments: [
            { id: 'c1', name: 'client_id', value: 'CLIENT_ID_A_REMPLACER', type: 'string' },
            { id: 'c2', name: 'client_name', value: 'Nom du client', type: 'string' },
            { id: 'c3', name: 'supabase_url', value: 'https://ejgdwjjcpjtwaqcxptke.supabase.co/rest/v1', type: 'string' },
          ]}
        }
      };
      workflow.nodes.push(configNode);
      // Connect trigger to config
      const triggerName = triggers[0].name;
      if (!workflow.connections) workflow.connections = {};
      if (!workflow.connections[triggerName]) {
        workflow.connections[triggerName] = { main: [[{ node: configNode.name, type: 'main', index: 0 }]] };
      }
    }
  }

  // ── Auto-inject 📊 Tracker Métriques if missing ──
  const hasTracker = workflow.nodes.some(n => n.name?.includes('Tracker') || n.name?.includes('Métriques') || n.name?.includes('📊'));
  if (!hasTracker) {
    const lastNode = workflow.nodes.reduce((max, n) =>
      (n.position?.[0] || 0) > (max.position?.[0] || 0) ? n : max, workflow.nodes[0]
    );
    const trackerNode = {
      id: crypto.randomUUID ? crypto.randomUUID() : `tracker-${Date.now()}`,
      name: '📊 Tracker Métriques',
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.2,
      position: [(lastNode?.position?.[0] || 1200) + 250, lastNode?.position?.[1] || 300],
      parameters: {
        method: 'POST',
        url: 'https://ejgdwjjcpjtwaqcxptke.supabase.co/rest/v1/automation_events',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'supabaseApi',
        sendHeaders: true,
        headerParameters: { parameters: [
          { name: 'Content-Type', value: 'application/json' },
          { name: 'Prefer', value: 'return=representation' }
        ]},
        sendBody: true, contentType: 'json', specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ client_id: $node["⚙️ Config"].json.client_id || "CLIENT_ID", event_category: "automation", event_type: "task_completed", description: "Action automatisée exécutée", revenue_amount: 0, time_saved_seconds: 120, metadata: { source: "n8n", workflow_name: "' + (workflow.name || 'Workflow') + '" }, metrics_counted: false }) }}',
        options: { response: { response: { responseFormat: 'json' } } }
      },
      credentials: { supabaseApi: { id: 'NswS61zLLGuXpo97', name: 'Supabase account' } }
    };
    workflow.nodes.push(trackerNode);
    // Connect last node to tracker
    if (lastNode && workflow.connections) {
      if (!workflow.connections[lastNode.name]) {
        workflow.connections[lastNode.name] = { main: [[]] };
      }
      const mainOutputs = workflow.connections[lastNode.name].main;
      if (mainOutputs && mainOutputs[0]) {
        mainOutputs[0].push({ node: trackerNode.name, type: 'main', index: 0 });
      }
    }
  }

  return workflow;
}

// ── Main handler ───────────────────────────────────────────
async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth: admin only
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' });
  const isAdmin = await isActeroAdmin(user, supabase);
  if (!isAdmin) return res.status(403).json({ error: 'Acces refuse — admin uniquement' });

  if (!N8N_URL || !N8N_KEY) return res.status(500).json({ error: 'N8N credentials missing' });
  if (!GEMINI_KEY) return res.status(500).json({ error: 'GEMINI_API_KEY missing' });

  const { action } = req.body;

  try {
    // ── List workflows ──
    if (action === 'list') {
      const data = await n8nGet('/workflows?limit=100');
      const workflows = (data.data || []).map(w => ({
        id: w.id, name: w.name, active: w.active,
        nodeCount: w.nodes?.length || 0,
        nodes: (w.nodes || []).map(n => n.name),
      }));
      return res.status(200).json({ workflows });
    }

    // ── List clients ──
    if (action === 'clients') {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, brand_name, client_type, status')
        .order('created_at', { ascending: false });
      return res.status(200).json({ clients: clients || [] });
    }

    // ── Chat — AI router ──
    if (action === 'chat') {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

      // Fetch ALL context: workflows + executions + full Supabase data
      const [wfData, exData, clientsData, shopifyData, settingsData, metricsData, eventsData, funnelData] = await Promise.all([
        n8nGet('/workflows?limit=100'),
        n8nGet('/executions?limit=100').catch(() => ({ data: [] })),
        supabase.from('clients').select('id, brand_name, client_type, status, contact_email, created_at'),
        supabase.from('client_shopify_connections').select('client_id, shop_domain, access_token, scopes, created_at'),
        supabase.from('client_settings').select('client_id, hourly_cost, avg_ticket_time_min, actero_monthly_price'),
        supabase.from('metrics_daily').select('client_id, date, time_saved_minutes, estimated_roi, tasks_executed, tickets_total, tickets_auto').order('date', { ascending: false }).limit(50),
        supabase.from('automation_events').select('client_id, event_category, created_at, revenue_amount, time_saved_seconds').order('created_at', { ascending: false }).limit(100),
        supabase.from('funnel_clients').select('id, company_name, email, status, client_type, setup_price, monthly_price, created_at').order('created_at', { ascending: false }),
      ]);

      // Map executions to workflows
      const execByWf = {};
      (exData.data || []).forEach(ex => {
        const wfId = ex.workflowId;
        if (!execByWf[wfId]) execByWf[wfId] = { success: 0, error: 0, total: 0, lastAt: null };
        execByWf[wfId].total++;
        if (ex.status === 'success' || (ex.finished && ex.stoppedAt)) execByWf[wfId].success++;
        else execByWf[wfId].error++;
        if (!execByWf[wfId].lastAt || ex.startedAt > execByWf[wfId].lastAt) execByWf[wfId].lastAt = ex.startedAt;
      });

      const workflows = (wfData.data || []).map(w => {
        const stats = execByWf[w.id] || { success: 0, error: 0, total: 0, lastAt: null };
        return {
          id: w.id, name: w.name, active: w.active, nodeCount: w.nodes?.length || 0,
          executions: stats.total, successCount: stats.success, errorCount: stats.error,
          lastExecution: stats.lastAt,
        };
      });
      const clients = clientsData.data || [];
      const shopify = shopifyData.data || [];
      const settings = settingsData.data || [];
      const metrics = metricsData.data || [];
      const events = eventsData.data || [];
      const funnel = funnelData.data || [];

      // Enrich clients with their Shopify, settings, and metrics
      const enrichedClients = clients.map(c => {
        const shop = shopify.find(s => s.client_id === c.id);
        const sett = settings.find(s => s.client_id === c.id);
        const clientMetrics = metrics.filter(m => m.client_id === c.id);
        const clientEvents = events.filter(e => e.client_id === c.id);
        const totalRoi = clientMetrics.reduce((s, m) => s + (Number(m.estimated_roi) || 0), 0);
        const totalTimeSaved = Math.round(clientMetrics.reduce((s, m) => s + (Number(m.time_saved_minutes) || 0), 0) / 60);
        const totalEvents = clientEvents.length;

        let info = `- "${c.brand_name}" (ID: ${c.id}, type: ${c.client_type}, statut: ${c.status}, email: ${c.contact_email || 'N/A'})`;
        if (shop) info += `\n    Shopify: ${shop.shop_domain} (token: ${shop.access_token?.substring(0, 8)}..., scopes: ${shop.scopes})`;
        if (sett) info += `\n    Config: ${sett.hourly_cost}€/h, ${sett.avg_ticket_time_min}min/ticket, abo: ${sett.actero_monthly_price}€/mois`;
        if (totalEvents > 0) info += `\n    Stats récentes: ${totalEvents} événements, ${totalTimeSaved}h économisées, ${totalRoi}€ ROI`;
        return info;
      });

      const context = `
WORKFLOWS N8N (avec statistiques d'exécution):
${workflows.map(w => {
  const statusStr = w.active ? 'ACTIF' : 'inactif';
  const execStr = w.executions > 0
    ? `${w.executions} exéc. (${w.successCount} OK, ${w.errorCount} ERR), dernière: ${w.lastExecution || '?'}`
    : 'aucune exécution récente';
  return `- "${w.name}" (ID: ${w.id}, ${statusStr}, ${w.nodeCount} nodes) — ${execStr}`;
}).join('\n')}

CLIENTS ACTERO (avec Shopify, config et métriques):
${enrichedClients.join('\n')}

PIPELINE FUNNEL:
${funnel.map(f => `- "${f.company_name}" (${f.email}, statut: ${f.status}, ${f.setup_price}€ + ${f.monthly_price}€/mois)`).join('\n') || 'Aucun prospect'}

DEMANDE: ${prompt}`;

      const intent = await askGemini(ROUTER_PROMPT, context);
      return res.status(200).json({ intent, workflows, clients });
    }

    // ── Modify workflow ──
    if (action === 'modify') {
      const { workflowId, prompt } = req.body;
      if (!workflowId || !prompt) return res.status(400).json({ error: 'Missing workflowId/prompt' });

      const currentWorkflow = await n8nGet(`/workflows/${workflowId}`);
      let modified = await askGemini(
        MODIFY_PROMPT,
        `Workflow actuel:\n${JSON.stringify(currentWorkflow, null, 2)}\n\nModification demandée: ${prompt}`
      );

      // Sanitize modified workflow
      modified = sanitizeWorkflow(modified);

      const origNames = new Set((currentWorkflow.nodes || []).map(n => n.name));
      const newNames = (modified.nodes || []).map(n => n.name);

      return res.status(200).json({
        modifiedWorkflow: modified,
        diff: {
          before: currentWorkflow.nodes?.length || 0,
          after: modified.nodes?.length || 0,
          added: newNames.filter(n => !origNames.has(n)),
          removed: [...origNames].filter(n => !newNames.includes(n)),
        },
      });
    }

    // ── Create workflow from scratch ──
    if (action === 'create') {
      const { prompt } = req.body;
      if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

      let workflow = await askGemini(
        CREATE_PROMPT,
        `Crée un workflow n8n pour: ${prompt}`
      );

      // Sanitize: fix invalid nodes, typeVersions, missing fields
      workflow = sanitizeWorkflow(workflow);

      return res.status(200).json({
        workflow,
        preview: {
          name: workflow.name || 'Nouveau workflow',
          nodeCount: workflow.nodes?.length || 0,
          nodes: (workflow.nodes || []).map(n => ({ name: n.name, type: n.type })),
        },
      });
    }

    // ── Duplicate template for client ──
    if (action === 'duplicate') {
      const { templateId, clientName, clientId } = req.body;
      const tplId = templateId || TEMPLATE_ID;

      const template = await n8nGet(`/workflows/${tplId}`);

      // Clean and rename
      const newWorkflow = { ...template };
      delete newWorkflow.id;
      delete newWorkflow.createdAt;
      delete newWorkflow.updatedAt;
      delete newWorkflow.versionId;
      newWorkflow.name = `SAV - ${clientName || 'Nouveau client'}`;
      newWorkflow.active = false;

      // If we have a clientId, update Config nodes
      if (clientId) {
        (newWorkflow.nodes || []).forEach(node => {
          if (node.name?.toLowerCase().includes('config') && node.parameters?.assignments?.assignments) {
            node.parameters.assignments.assignments.forEach(a => {
              if (a.name === 'client_id') a.value = clientId;
            });
          }
        });
      }

      return res.status(200).json({
        workflow: newWorkflow,
        preview: {
          name: newWorkflow.name,
          nodeCount: newWorkflow.nodes?.length || 0,
          templateName: template.name,
          clientName,
        },
      });
    }

    // ── Apply (create new or update existing) ──
    if (action === 'apply') {
      const { workflowId, workflow } = req.body;
      if (!workflow) return res.status(400).json({ error: 'Missing workflow' });

      // Sanitize nodes before sending to n8n
      const sanitized = sanitizeWorkflow(workflow);

      // Whitelist only fields accepted by n8n API (tags is read-only on create)
      const clean = {
        name: sanitized.name || 'Nouveau workflow',
        nodes: sanitized.nodes || [],
        connections: sanitized.connections || {},
        settings: sanitized.settings || { executionOrder: 'v1' },
      };
      if (workflow.staticData) clean.staticData = workflow.staticData;

      let result;
      if (workflowId) {
        result = await n8nPut(`/workflows/${workflowId}`, clean);
      } else {
        result = await n8nPost('/workflows', clean);
      }

      return res.status(200).json({ success: true, workflow: result });
    }

    // ── Delete ──
    if (action === 'delete') {
      const { workflowId } = req.body;
      if (!workflowId) return res.status(400).json({ error: 'Missing workflowId' });

      // First deactivate if needed
      try {
        await n8nPost(`/workflows/${workflowId}/deactivate`, {});
      } catch { /* ignore if already inactive */ }

      await n8nDelete(`/workflows/${workflowId}`);
      return res.status(200).json({ success: true });
    }

    // ── Toggle active/inactive ──
    if (action === 'toggle') {
      const { workflowId, active } = req.body;
      if (!workflowId) return res.status(400).json({ error: 'Missing workflowId' });

      const endpoint = active ? 'activate' : 'deactivate';
      const result = await n8nPost(`/workflows/${workflowId}/${endpoint}`, {});
      return res.status(200).json({ success: true, active: result.active });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error('N8N Copilot error:', error);
    return res.status(500).json({ error: error.message });
  }
}

export default withSentry(handler)
