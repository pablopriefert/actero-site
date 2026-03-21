/**
 * POST /api/deploy-workflow
 * Deploys a SAV e-commerce n8n workflow for a client.
 *
 * Body: { client_id: string, shop_domain: string }
 *
 * 1. Fetches the template workflow from n8n
 * 2. Replaces client_id in all Config nodes
 * 3. Renames the workflow
 * 4. Creates it in n8n
 * 5. Activates it
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { client_id, shop_domain } = req.body;

  if (!client_id) {
    return res.status(400).json({ error: 'Missing client_id' });
  }

  const n8nUrl = process.env.N8N_URL;
  const n8nApiKey = process.env.N8N_API_KEY;
  const templateId = process.env.N8N_TEMPLATE_WORKFLOW_ID || 'B82qZGLUQ7uFEAP8';

  if (!n8nUrl || !n8nApiKey) {
    return res.status(500).json({ error: 'n8n configuration missing' });
  }

  const headers = {
    'X-N8N-API-KEY': n8nApiKey,
    'Content-Type': 'application/json',
  };

  try {
    // 1. Look up client brand name from Supabase
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let brandName = 'Client';
    if (supabaseUrl && supabaseKey) {
      const clientRes = await fetch(
        `${supabaseUrl}/rest/v1/clients?id=eq.${client_id}&select=brand_name`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );
      const clientData = await clientRes.json();
      if (clientData?.[0]?.brand_name) {
        brandName = clientData[0].brand_name;
      }
    }

    // 2. Fetch template workflow from n8n
    const templateRes = await fetch(`${n8nUrl}/api/v1/workflows/${templateId}`, { headers });
    if (!templateRes.ok) {
      const errText = await templateRes.text();
      return res.status(500).json({ error: 'Failed to fetch template', details: errText });
    }

    const template = await templateRes.json();

    // 3. Modify the workflow
    // - Rename
    template.name = `SAV Shopify — ${brandName}`;

    // - Remove id so n8n generates a new one
    delete template.id;

    // - Replace VOTRE_CLIENT_ID_ICI in all Config nodes
    if (template.nodes) {
      template.nodes = template.nodes.map((node) => {
        if (node.name && node.name.toLowerCase().includes('config')) {
          if (node.parameters?.assignments?.assignments) {
            node.parameters.assignments.assignments = node.parameters.assignments.assignments.map((assignment) => {
              if (assignment.value === 'VOTRE_CLIENT_ID_ICI') {
                return { ...assignment, value: client_id };
              }
              return assignment;
            });
          }
        }
        return node;
      });
    }

    // 4. Create the new workflow in n8n
    const createRes = await fetch(`${n8nUrl}/api/v1/workflows`, {
      method: 'POST',
      headers,
      body: JSON.stringify(template),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      return res.status(500).json({ error: 'Failed to create workflow', details: errText });
    }

    const newWorkflow = await createRes.json();

    // 5. Activate the workflow
    const activateRes = await fetch(`${n8nUrl}/api/v1/workflows/${newWorkflow.id}/activate`, {
      method: 'POST',
      headers,
    });

    if (!activateRes.ok) {
      console.error('Failed to activate workflow:', await activateRes.text());
      // Don't fail — workflow was created, just not activated
    }

    return res.status(200).json({
      success: true,
      workflow_id: newWorkflow.id,
      workflow_name: newWorkflow.name,
      client_id,
      shop_domain: shop_domain || null,
    });
  } catch (err) {
    console.error('Deploy workflow error:', err);
    return res.status(500).json({ error: err.message });
  }
}
