// One-click deploy: duplicate an n8n template, inject client config, activate
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './lib/admin-auth.js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Admin-only: deploys n8n workflows
  const adminUser = await requireAdmin(req, res, supabase);
  if (!adminUser) return;

  const N8N_URL = process.env.N8N_API_URL;
  const N8N_KEY = process.env.N8N_API_KEY;

  if (!N8N_URL || !N8N_KEY) {
    return res.status(500).json({ error: 'N8N_API_URL or N8N_API_KEY not configured' });
  }

  const { templateId, clientId, clientName, brandContext } = req.body || {};

  if (!templateId || !clientId || !clientName) {
    return res.status(400).json({ error: 'Missing required fields: templateId, clientId, clientName' });
  }

  const headers = {
    'X-N8N-API-KEY': N8N_KEY,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Fetch the template workflow
    const templateRes = await fetch(`${N8N_URL}/api/v1/workflows/${templateId}`, { headers });
    if (!templateRes.ok) {
      throw new Error(`Failed to fetch template workflow: ${templateRes.status}`);
    }
    const template = await templateRes.json();

    // 2. Clone and rename
    const workflowName = `SAV - ${clientName}`;

    // 3. Update Config nodes with client data
    const nodes = (template.nodes || []).map(node => {
      if (node.name === 'Config' || node.type === 'n8n-nodes-base.set') {
        const params = node.parameters || {};
        if (params.values && Array.isArray(params.values.string)) {
          params.values.string = params.values.string.map(entry => {
            if (entry.name === 'client_id') return { ...entry, value: clientId };
            if (entry.name === 'client_name') return { ...entry, value: clientName };
            if (entry.name === 'brand_context') return { ...entry, value: brandContext || '' };
            return entry;
          });
        }
        // Also handle assignments format (newer n8n versions)
        if (params.assignments && Array.isArray(params.assignments.assignments)) {
          params.assignments.assignments = params.assignments.assignments.map(entry => {
            if (entry.name === 'client_id') return { ...entry, value: clientId };
            if (entry.name === 'client_name') return { ...entry, value: clientName };
            if (entry.name === 'brand_context') return { ...entry, value: brandContext || '' };
            return entry;
          });
        }
        return { ...node, parameters: params };
      }
      return node;
    });

    // 4. Build payload — whitelist only allowed fields
    const createPayload = {
      name: workflowName,
      nodes,
      connections: template.connections,
      settings: template.settings || {},
      staticData: template.staticData || null,
      pinData: template.pinData || {},
    };

    const createRes = await fetch(`${N8N_URL}/api/v1/workflows`, {
      method: 'POST',
      headers,
      body: JSON.stringify(createPayload),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      throw new Error(`Failed to create workflow: ${createRes.status} — ${err}`);
    }
    const created = await createRes.json();

    // 5. Activate the workflow
    const activateRes = await fetch(`${N8N_URL}/api/v1/workflows/${created.id}/activate`, {
      method: 'POST',
      headers,
    });
    if (!activateRes.ok) {
      console.error(`Warning: workflow created but activation failed: ${activateRes.status}`);
    }

    return res.status(200).json({
      success: true,
      workflowId: created.id,
      workflowName: created.name,
    });
  } catch (error) {
    console.error('deploy-workflow error:', error);
    return res.status(500).json({ error: error.message });
  }
}
