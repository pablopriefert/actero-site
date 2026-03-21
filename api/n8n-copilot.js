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
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
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
- Le template SAV e-commerce est l'ID "${TEMPLATE_ID}"

ACTIONS POSSIBLES:
1. "modify" — Modifier un workflow existant
2. "create" — Créer un nouveau workflow from scratch
3. "duplicate" — Dupliquer le template SAV pour un client
4. "delete" — Supprimer un workflow
5. "toggle" — Activer/désactiver un workflow
6. "info" — Répondre à une question (pas d'action n8n)

RETOURNE CE JSON:
{
  "intent": "modify|create|duplicate|delete|toggle|info",
  "workflowId": "ID si applicable (null sinon)",
  "workflowName": "nom du workflow si identifiable",
  "clientName": "nom du client si mentionné",
  "description": "description courte de ce qu'il faut faire",
  "message": "message à afficher à l'utilisateur pour confirmer l'action",
  "activate": true/false (pour toggle, default false)
}

RÈGLES:
- Si l'utilisateur mentionne un client, cherche le workflow associé par nom
- Si l'utilisateur veut déployer/onboarder un client → intent "duplicate"
- Si l'utilisateur pose une question → intent "info" et remplis "message" avec la réponse détaillée
- Tu as accès aux statistiques d'exécution de chaque workflow (succès, erreurs, dernière exécution). Utilise-les pour répondre aux questions sur les erreurs, la santé, les performances.
- Quand l'utilisateur demande "quels workflows ont des erreurs", liste-les avec leurs stats dans "message"
- Sois précis dans l'identification du workflowId`;

const MODIFY_PROMPT = `Tu es un expert n8n. Modifie le workflow JSON selon la demande.

RÈGLES:
- Retourne UNIQUEMENT le workflow modifié en JSON valide
- Ne change pas les credentials ni les IDs de credentials
- Conserve les nodes existants sauf demande explicite de suppression
- Utilise les types de nodes n8n corrects
- Positionne les nouveaux nodes visuellement
- Connecte les nodes logiquement via "connections"`;

const CREATE_PROMPT = `Tu es un expert n8n. Crée un workflow n8n complet en JSON à partir de la description.

RÈGLES:
- Retourne un JSON n8n valide avec: name, nodes, connections, settings
- Chaque node doit avoir: id (UUID), name, type, typeVersion, position [x, y], parameters
- Le premier node est souvent un trigger (Schedule, Webhook, etc.)
- Connecte tous les nodes via "connections"
- Utilise les types corrects: n8n-nodes-base.scheduleTrigger, n8n-nodes-base.httpRequest, n8n-nodes-base.if, n8n-nodes-base.set, n8n-nodes-base.code, etc.
- settings: { executionOrder: "v1" }`;

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

      // Fetch context: workflows + executions + clients
      const [wfData, exData, clientsData] = await Promise.all([
        n8nGet('/workflows?limit=100'),
        n8nGet('/executions?limit=100').catch(() => ({ data: [] })),
        supabase.from('clients').select('id, brand_name, client_type, status'),
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

      const context = `
WORKFLOWS ACTUELS (avec statistiques d'exécution récentes):
${workflows.map(w => {
  const statusStr = w.active ? 'ACTIF' : 'inactif';
  const execStr = w.executions > 0
    ? `${w.executions} exécutions (${w.successCount} succès, ${w.errorCount} erreurs), dernière: ${w.lastExecution || 'inconnue'}`
    : 'aucune exécution récente';
  return `- "${w.name}" (ID: ${w.id}, ${statusStr}, ${w.nodeCount} nodes) — ${execStr}`;
}).join('\n')}

CLIENTS ACTERO:
${clients.map(c => `- "${c.brand_name}" (ID: ${c.id}, type: ${c.client_type}, statut: ${c.status})`).join('\n')}

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

      const clean = { ...workflow };
      delete clean.id; delete clean.createdAt; delete clean.updatedAt; delete clean.versionId;

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
