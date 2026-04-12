/**
 * Actero MCP Server — SSE endpoint for Claude Desktop / Cursor / any MCP client
 *
 * URL: GET /api/mcp/{api_key}
 *
 * This is a Model Context Protocol (MCP) server that exposes Actero tools
 * to AI assistants. The client connects via SSE, sends JSON-RPC requests,
 * and receives responses.
 *
 * Protocol: MCP over SSE (Server-Sent Events)
 * Auth: API key in the URL path (validated against client_api_keys table)
 *
 * Tools exposed:
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

// MCP tool definitions
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
    description: 'Retourne les statistiques de consommation du mois en cours (tickets utilises, limite, plan)',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'actero_list_escalations',
    description: 'Liste les escalades en attente de traitement humain',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Nombre max de resultats (defaut 10)' },
      },
    },
  },
  {
    name: 'actero_get_conversations',
    description: 'Retourne les dernieres conversations traitees par l\'agent IA',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Nombre max de resultats (defaut 10)' },
      },
    },
  },
]

// Resolve client from API key
async function resolveClient(apiKey) {
  if (!apiKey) return null

  // Check client_api_keys table first
  const { data: keyRow } = await supabase
    .from('client_api_keys')
    .select('client_id')
    .eq('key_value', apiKey)
    .eq('is_active', true)
    .maybeSingle()

  if (keyRow) return keyRow.client_id

  // Fallback: check client_settings.widget_api_key
  const { data: settings } = await supabase
    .from('client_settings')
    .select('client_id')
    .eq('widget_api_key', apiKey)
    .maybeSingle()

  if (settings) return settings.client_id

  // Fallback: check if it's a client_id directly
  const { data: client } = await supabase
    .from('clients')
    .select('id')
    .eq('id', apiKey)
    .maybeSingle()

  return client?.id || null
}

// Tool implementations
async function executeTool(toolName, args, clientId) {
  switch (toolName) {
    case 'actero_send_message': {
      const sessionId = args.session_id || `mcp-${Date.now()}`
      const res = await fetch(`${process.env.PUBLIC_API_URL || 'https://actero.fr'}/api/engine/webhooks/widget?api_key=${clientId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: args.message,
          session_id: sessionId,
        }),
      })
      const data = await res.json()
      return { response: data.response || data.error || 'Pas de reponse', session_id: sessionId }
    }

    case 'actero_get_usage': {
      const period = new Date().toISOString().slice(0, 7)
      const [{ data: usage }, { data: client }] = await Promise.all([
        supabase.from('usage_counters').select('*').eq('client_id', clientId).eq('period', period).maybeSingle(),
        supabase.from('clients').select('plan').eq('id', clientId).maybeSingle(),
      ])
      return {
        plan: client?.plan || 'free',
        period,
        tickets_used: usage?.tickets_used || 0,
        voice_minutes_used: usage?.voice_minutes_used || 0,
      }
    }

    case 'actero_list_escalations': {
      const limit = args.limit || 10
      const { data } = await supabase
        .from('escalation_tickets')
        .select('id, customer_email, subject, status, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit)
      return { escalations: data || [], count: data?.length || 0 }
    }

    case 'actero_get_conversations': {
      const limit = args.limit || 10
      const { data } = await supabase
        .from('ai_conversations')
        .select('id, customer_email, customer_message, ai_response, status, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit)
      return { conversations: data || [], count: data?.length || 0 }
    }

    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}

// JSON-RPC response helper
function jsonRpc(id, result) {
  return JSON.stringify({ jsonrpc: '2.0', id, result })
}

function jsonRpcError(id, code, message) {
  return JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })
}

export default async function handler(req, res) {
  const apiKey = req.query.key

  // Auth
  const clientId = await resolveClient(apiKey)
  if (!clientId) {
    return res.status(401).json({ error: 'Invalid API key' })
  }

  // SSE mode (GET) — MCP over SSE
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders?.()

    // Send server info
    const serverInfo = jsonRpc(null, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'actero-mcp', version: '1.0.0' },
    })
    res.write(`data: ${serverInfo}\n\n`)

    // Keep connection alive with ping every 30s
    const pingInterval = setInterval(() => {
      try { res.write(': ping\n\n') } catch { clearInterval(pingInterval) }
    }, 30000)

    // Close after 5 min (Vercel timeout)
    setTimeout(() => {
      clearInterval(pingInterval)
      try { res.end() } catch {}
    }, 290000)

    req.on('close', () => clearInterval(pingInterval))
    return
  }

  // POST mode — handle JSON-RPC requests
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const { id, method, params } = body || {}

    if (method === 'initialize') {
      return res.status(200).json(JSON.parse(jsonRpc(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'actero-mcp', version: '1.0.0' },
      })))
    }

    if (method === 'tools/list') {
      return res.status(200).json(JSON.parse(jsonRpc(id, { tools: TOOLS })))
    }

    if (method === 'tools/call') {
      const toolName = params?.name
      const toolArgs = params?.arguments || {}
      try {
        const result = await executeTool(toolName, toolArgs, clientId)
        return res.status(200).json(JSON.parse(jsonRpc(id, {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        })))
      } catch (err) {
        return res.status(200).json(JSON.parse(jsonRpcError(id, -32000, err.message)))
      }
    }

    // notifications (no response needed)
    if (method === 'notifications/initialized' || method === 'initialized') {
      return res.status(200).json({ jsonrpc: '2.0' })
    }

    return res.status(200).json(JSON.parse(jsonRpcError(id || null, -32601, `Method not found: ${method}`)))
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
