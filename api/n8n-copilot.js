// N8N Copilot — AI-powered workflow management via Gemini
import { createClient } from '@supabase/supabase-js';

const N8N_URL = process.env.N8N_API_URL;
const N8N_KEY = process.env.N8N_API_KEY;
const GEMINI_KEY = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const TEMPLATE_ID = 'B82qZGLUQ7uFEAP8';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── Gemini helper ──────────────────────────────────────────
async function askGemini(systemPrompt, userPrompt, jsonMode = true) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_KEY}`,
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
    throw new Error(`Gemini ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Réponse Gemini vide');
  return jsonMode ? JSON.parse(text) : text;
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

// n8n Skills Knowledge Base (from czlonkowski/n8n-skills)
const N8N_KNOWLEDGE = `
TYPES DE NODES CORRECTS (IMPORTANT — utilise exactement ces noms):
- Triggers: n8n-nodes-base.scheduleTrigger, n8n-nodes-base.webhook, n8n-nodes-base.manualTrigger
- HTTP: n8n-nodes-base.httpRequest
- Logic: n8n-nodes-base.if, n8n-nodes-base.switch, n8n-nodes-base.merge, n8n-nodes-base.splitInBatches
- Data: n8n-nodes-base.set, n8n-nodes-base.code, n8n-nodes-base.dateTime, n8n-nodes-base.crypto
- Communication: n8n-nodes-base.slack, n8n-nodes-base.emailSend, n8n-nodes-base.discord
- Database: n8n-nodes-base.postgres, n8n-nodes-base.mongoDb, n8n-nodes-base.redis
- AI: @n8n/n8n-nodes-langchain.agent, @n8n/n8n-nodes-langchain.chainLlm, @n8n/n8n-nodes-langchain.lmChatOpenAi
- Storage: n8n-nodes-base.googleSheets, n8n-nodes-base.airtable
- Error: n8n-nodes-base.errorTrigger, n8n-nodes-base.stopAndError
- Flow: n8n-nodes-base.noOp, n8n-nodes-base.wait, n8n-nodes-base.respondToWebhook
- Shopify: n8n-nodes-base.shopify, n8n-nodes-base.shopifyTrigger

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

CONNECTIONS FORMAT:
{"NomNodeSource":{"main":[[{"node":"NomNodeCible","type":"main","index":0}]]}}
Pour IF avec 2 branches: {"Vérifier":{"main":[[{"node":"SiVrai","type":"main","index":0}],[{"node":"SiFaux","type":"main","index":0}]]}}

SUPABASE CREDENTIALS ACTERO (à utiliser pour tous les nodes Supabase):
{"supabaseApi":{"id":"NswS61zLLGuXpo97","name":"Supabase account"}}

SUPABASE URL: https://ejgdwjjcpjtwaqcxptke.supabase.co/rest/v1/
`;

const MODIFY_PROMPT = `Tu es un ingénieur n8n expert. Modifie le workflow JSON selon la demande.

${N8N_KNOWLEDGE}

${NODE_EXAMPLES}

RÈGLES MODIFICATION:
- Retourne UNIQUEMENT le workflow modifié en JSON valide (name, nodes, connections, settings)
- Ne change JAMAIS les credentials ni les IDs de credentials existants
- Conserve les nodes existants sauf demande explicite de suppression
- CHAQUE node DOIT avoir: id, name, type, typeVersion, position, parameters (JAMAIS vides)
- Positionne les nouveaux nodes à +250px horizontal du dernier
- Connecte les nodes via "connections" avec le format exact montré ci-dessus
- Garde le même name, settings du workflow original`;

const CREATE_PROMPT = `Tu es un ingénieur n8n expert. Crée un workflow n8n COMPLET, FONCTIONNEL et PRODUCTION-READY.

${N8N_KNOWLEDGE}

${NODE_EXAMPLES}

RÈGLES CRÉATION STRICTES:
- Retourne un JSON avec: name, nodes, connections, settings
- CHAQUE node DOIT avoir: id (UUID unique), name, type, typeVersion (CORRECT!), position [x, y], parameters (JAMAIS vides!)
- Utilise les exemples de nodes ci-dessus comme MODÈLE EXACT — copie le format
- typeVersion DOIT correspondre à la version réelle du node (ex: httpRequest=4.2, webhook=2, scheduleTrigger=1.2, if=2, code=2, set=3.4)
- Le premier node est un trigger positionné à [220, 300]
- Espacement: +250px horizontal entre chaque node, +200px vertical pour les branches
- settings: { "executionOrder": "v1" }
- TOUS les nodes doivent être connectés via "connections"
- Les paramètres de chaque node doivent être COMPLETS et fonctionnels
- Si le workflow utilise Supabase, utilise les credentials Actero indiquées
- Noms de nodes descriptifs en français
- Pour les HTTP Request vers Supabase: TOUJOURS mettre authentication, nodeCredentialType, headers Content-Type
- Ne retourne JAMAIS un node avec parameters: {} vide (sauf noOp)`;

// ── Main handler ───────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
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
      const modified = await askGemini(
        MODIFY_PROMPT,
        `Workflow actuel:\n${JSON.stringify(currentWorkflow, null, 2)}\n\nModification demandée: ${prompt}`
      );

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

      const workflow = await askGemini(
        CREATE_PROMPT,
        `Crée un workflow n8n pour: ${prompt}`
      );

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

      // Whitelist only fields accepted by n8n API (tags is read-only on create)
      const clean = {
        name: workflow.name || 'Nouveau workflow',
        nodes: workflow.nodes || [],
        connections: workflow.connections || {},
        settings: workflow.settings || { executionOrder: 'v1' },
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
