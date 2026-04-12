/**
 * Actero MCP Server — Streamable HTTP transport
 *
 * Single endpoint: /api/mcp/{api_key}
 * Supports both POST (JSON-RPC requests) and GET (SSE stream for server-initiated messages)
 *
 * Protocol: MCP 2025-03-26 (Streamable HTTP)
 * Auth: API key in URL path
 *
 * Tools:
 * - actero_send_message: Send a message to the AI agent
 * - actero_get_usage: Get current month usage stats
 * - actero_list_escalations: List pending escalations
 * - actero_get_conversations: Get recent conversations
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SERVER_INFO = {
  protocolVersion: '2025-03-26',
  capabilities: { tools: {} },
  serverInfo: { name: 'actero-mcp', version: '1.0.0' },
}

const TOOLS = [
  {
    name: 'actero_send_message',
    description: 'Envoie un message au support IA Actero et retourne la reponse de l\'agent',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Le message du client' },
        session_id: { type: 'string', description: 'Identifiant de session (optionnel)' },
      },
      required: ['message'],
    },
  },
  {
    name: 'actero_get_usage',
    description: 'Retourne les statistiques de consommation du mois en cours (tickets, plan, limites)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'actero_list_escalations',
    description: 'Liste les escalades en attente de traitement humain',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Nombre max (defaut 10)' },
      },
    },
  },
  {
    name: 'actero_get_conversations',
    description: 'Retourne les dernieres conversations traitees par l\'agent IA',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Nombre max (defaut 10)' },
      },
    },
  },
]

async function resolveClient(apiKey) {
  if (!apiKey) return null
  const { data: keyRow } = await supabase
    .from('client_api_keys')
    .select('client_id')
    .eq('key_value', apiKey)
    .eq('is_active', true)
    .maybeSingle()
  if (keyRow) return keyRow.client_id

  const { data: settings } = await supabase
    .from('client_settings')
    .select('client_id')
    .eq('widget_api_key', apiKey)
    .maybeSingle()
  if (settings) return settings.client_id

  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', apiKey)
    .maybeSingle()
  return client?.id || null
}

async function executeTool(toolName, args, clientId) {
  switch (toolName) {
    case 'actero_send_message': {
      const sessionId = args.session_id || `mcp-${Date.now()}`
      try {
        const res = await fetch(`${process.env.PUBLIC_API_URL || 'https://actero.fr'}/api/engine/webhooks/widget?api_key=${clientId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: args.message, session_id: sessionId }),
        })
        const data = await res.json()
        return JSON.stringify({ response: data.response || 'Pas de reponse', session_id: sessionId })
      } catch (err) {
        return JSON.stringify({ error: err.message })
      }
    }
    case 'actero_get_usage': {
      const period = new Date().toISOString().slice(0, 7)
      const [{ data: usage }, { data: client }] = await Promise.all([
        supabase.from('usage_counters').select('*').eq('client_id', clientId).eq('period', period).maybeSingle(),
        supabase.from('clients').select('plan').eq('id', clientId).maybeSingle(),
      ])
      return JSON.stringify({ plan: client?.plan || 'free', period, tickets_used: usage?.tickets_used || 0, voice_minutes_used: usage?.voice_minutes_used || 0 })
    }
    case 'actero_list_escalations': {
      const limit = args.limit || 10
      const { data } = await supabase.from('escalation_tickets').select('id, customer_email, subject, status, created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(limit)
      return JSON.stringify({ escalations: data || [], count: data?.length || 0 })
    }
    case 'actero_get_conversations': {
      const limit = args.limit || 10
      const { data } = await supabase.from('ai_conversations').select('id, customer_email, customer_message, ai_response, status, created_at').eq('client_id', clientId).order('created_at', { ascending: false }).limit(limit)
      return JSON.stringify({ conversations: data || [], count: data?.length || 0 })
    }
    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` })
  }
}

function jsonRpcResponse(id, result) {
  return { jsonrpc: '2.0', id, result }
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } }
}

export default async function handler(req, res) {
  const apiKey = req.query.key

  // Auth
  const clientId = await resolveClient(apiKey)
  if (!clientId) {
    return res.status(401).json({ error: 'Invalid API key' })
  }

  // CORS for Claude Desktop
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id, MCP-Protocol-Version')
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // DELETE — session termination (acknowledge)
  if (req.method === 'DELETE') {
    return res.status(200).json({ ok: true })
  }

  // GET — SSE stream for server-initiated messages
  if (req.method === 'GET') {
    const accept = req.headers.accept || ''
    if (!accept.includes('text/event-stream')) {
      return res.status(405).json({ error: 'Accept: text/event-stream required for GET' })
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders?.()

    // Keep alive
    const ping = setInterval(() => {
      try { res.write(': ping\n\n') } catch { clearInterval(ping) }
    }, 25000)

    // Close after 4.5 min (Vercel ~5min timeout)
    setTimeout(() => { clearInterval(ping); try { res.end() } catch {} }, 270000)
    req.on('close', () => clearInterval(ping))
    return
  }

  // POST — handle JSON-RPC messages
  if (req.method === 'POST') {
    let body
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    } catch {
      return res.status(400).json(jsonRpcError(null, -32700, 'Parse error'))
    }

    const { id, method, params } = body || {}

    // Notifications (no id = no response expected, but we acknowledge with 202)
    if (id === undefined || id === null) {
      return res.status(202).end()
    }

    // initialize
    if (method === 'initialize') {
      return res.status(200).json(jsonRpcResponse(id, SERVER_INFO))
    }

    // tools/list
    if (method === 'tools/list') {
      return res.status(200).json(jsonRpcResponse(id, { tools: TOOLS }))
    }

    // tools/call
    if (method === 'tools/call') {
      const toolName = params?.name
      const toolArgs = params?.arguments || {}

      if (!toolName) {
        return res.status(200).json(jsonRpcError(id, -32602, 'Missing tool name'))
      }

      const knownTool = TOOLS.find(t => t.name === toolName)
      if (!knownTool) {
        return res.status(200).json(jsonRpcError(id, -32602, `Unknown tool: ${toolName}`))
      }

      try {
        const resultText = await executeTool(toolName, toolArgs, clientId)
        return res.status(200).json(jsonRpcResponse(id, {
          content: [{ type: 'text', text: resultText }],
        }))
      } catch (err) {
        return res.status(200).json(jsonRpcError(id, -32000, err.message))
      }
    }

    // ping
    if (method === 'ping') {
      return res.status(200).json(jsonRpcResponse(id, {}))
    }

    // resources/list, prompts/list — empty
    if (method === 'resources/list') {
      return res.status(200).json(jsonRpcResponse(id, { resources: [] }))
    }
    if (method === 'prompts/list') {
      return res.status(200).json(jsonRpcResponse(id, { prompts: [] }))
    }

    // Unknown method
    return res.status(200).json(jsonRpcError(id, -32601, `Method not found: ${method}`))
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
