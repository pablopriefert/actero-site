/**
 * Actero Engine — Auto-Setup Email Polling
 *
 * When a client activates the Email channel on a playbook,
 * this creates an n8n workflow that polls their IMAP inbox
 * and forwards new emails to the Actero Engine.
 *
 * POST /api/engine/setup-email-polling
 * Body: { client_id }
 */
import { createClient } from '@supabase/supabase-js'

const N8N_API_URL = process.env.N8N_API_URL
const N8N_API_KEY = process.env.N8N_API_KEY
const ENGINE_SECRET = process.env.ENGINE_WEBHOOK_SECRET
const SITE_URL = process.env.SITE_URL || 'https://actero.fr'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Auth
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorise' })
  const { error: authError } = await supabase.auth.getUser(token)
  if (authError) return res.status(401).json({ error: 'Non autorise' })

  const { client_id } = req.body
  if (!client_id) return res.status(400).json({ error: 'client_id requis' })

  if (!N8N_API_URL || !N8N_API_KEY) {
    return res.status(500).json({ error: 'N8N non configure' })
  }

  try {
    // 1. Get client SMTP/IMAP credentials
    const { data: integration } = await supabase
      .from('client_integrations')
      .select('api_key, extra_config')
      .eq('client_id', client_id)
      .eq('provider', 'smtp_imap')
      .eq('status', 'active')
      .maybeSingle()

    if (!integration) {
      return res.status(400).json({ error: 'Aucune integration email SMTP/IMAP active pour ce client' })
    }

    const config = integration.extra_config || {}
    const { imap_host, imap_port, username, email, use_ssl } = config
    const password = integration.api_key

    if (!imap_host || !username || !password) {
      return res.status(400).json({ error: 'Configuration IMAP incomplete' })
    }

    // 2. Get client name
    const { data: client } = await supabase
      .from('clients')
      .select('brand_name')
      .eq('id', client_id)
      .single()

    const clientName = client?.brand_name || 'Client'

    // 3. Check if workflow already exists
    const { data: existingWorkflow } = await supabase
      .from('client_n8n_workflows')
      .select('n8n_workflow_id')
      .eq('client_id', client_id)
      .eq('category', 'email_polling')
      .maybeSingle()

    if (existingWorkflow?.n8n_workflow_id) {
      // Activate existing workflow
      try {
        await fetch(`${N8N_API_URL}/api/v1/workflows/${existingWorkflow.n8n_workflow_id}/activate`, {
          method: 'POST',
          headers: { 'X-N8N-API-KEY': N8N_API_KEY },
        })
      } catch {}
      return res.status(200).json({ success: true, message: 'Workflow email deja existant, reactive', workflow_id: existingWorkflow.n8n_workflow_id })
    }

    // 4. Create n8n workflow
    const webhookUrl = `${SITE_URL}/api/engine/webhooks/inbound-email?client_id=${client_id}`

    const workflowData = {
      name: `Actero Email - ${clientName}`,
      nodes: [
        {
          parameters: {
            mailbox: 'INBOX',
            postProcessAction: 'read',
            options: {},
          },
          id: 'imap-trigger',
          name: 'Email Trigger',
          type: 'n8n-nodes-base.imapEmailTrigger',
          typeVersion: 1,
          position: [250, 300],
          credentials: {
            imap: {
              id: null,
              name: `IMAP - ${clientName}`,
            },
          },
        },
        {
          parameters: {
            method: 'POST',
            url: webhookUrl,
            sendHeaders: true,
            headerParameters: {
              parameters: [
                { name: 'x-engine-secret', value: ENGINE_SECRET || '' },
                { name: 'Content-Type', value: 'application/json' },
              ],
            },
            sendBody: true,
            bodyParameters: {
              parameters: [
                { name: 'from', value: '={{ $json.from.value[0].address || $json.from }}' },
                { name: 'from_name', value: '={{ $json.from.value[0].name || "" }}' },
                { name: 'subject', value: '={{ $json.subject || "" }}' },
                { name: 'text', value: '={{ $json.text || $json.textAsHtml || "" }}' },
                { name: 'to', value: '={{ $json.to.value[0].address || "" }}' },
              ],
            },
            options: {},
          },
          id: 'http-request',
          name: 'Send to Actero Engine',
          type: 'n8n-nodes-base.httpRequest',
          typeVersion: 4,
          position: [500, 300],
        },
      ],
      connections: {
        'Email Trigger': {
          main: [[{ node: 'Send to Actero Engine', type: 'main', index: 0 }]],
        },
      },
      settings: {
        executionOrder: 'v1',
      },
      active: false,
    }

    // Create the workflow in n8n
    const createRes = await fetch(`${N8N_API_URL}/api/v1/workflows`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(workflowData),
    })

    if (!createRes.ok) {
      const err = await createRes.text()
      throw new Error(`n8n workflow creation failed: ${err}`)
    }

    const created = await createRes.json()
    const workflowId = created.id

    // 5. Create IMAP credential in n8n
    const credentialRes = await fetch(`${N8N_API_URL}/api/v1/credentials`, {
      method: 'POST',
      headers: {
        'X-N8N-API-KEY': N8N_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `IMAP - ${clientName}`,
        type: 'imap',
        data: {
          host: imap_host,
          port: parseInt(imap_port) || 993,
          user: username,
          password: password,
          secure: use_ssl !== false,
        },
      }),
    })

    let credentialId = null
    if (credentialRes.ok) {
      const cred = await credentialRes.json()
      credentialId = cred.id

      // Update workflow with credential reference
      const updatedNodes = workflowData.nodes.map(node => {
        if (node.id === 'imap-trigger') {
          return {
            ...node,
            credentials: {
              imap: { id: String(credentialId), name: `IMAP - ${clientName}` },
            },
          }
        }
        return node
      })

      await fetch(`${N8N_API_URL}/api/v1/workflows/${workflowId}`, {
        method: 'PUT',
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...workflowData, nodes: updatedNodes }),
      })
    }

    // 6. Activate the workflow
    await fetch(`${N8N_API_URL}/api/v1/workflows/${workflowId}/activate`, {
      method: 'POST',
      headers: { 'X-N8N-API-KEY': N8N_API_KEY },
    })

    // 7. Save workflow reference
    const { error: saveError } = await supabase.from('client_n8n_workflows').insert({
      client_id,
      n8n_workflow_id: String(workflowId),
      label: `Email Polling - ${clientName}`,
      category: 'email_polling',
    })
    if (saveError) console.error('[setup-email-polling] DB save error:', saveError.message)

    return res.status(200).json({
      success: true,
      workflow_id: workflowId,
      credential_id: credentialId,
      message: `Workflow email polling cree et active pour ${clientName}`,
    })

  } catch (err) {
    console.error('[setup-email-polling] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}
