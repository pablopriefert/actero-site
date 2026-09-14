/**
 * GET /api/credits/balance — returns the client's credit balance + recent transactions.
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })

  // Resolve the target client. Prefer an explicit client_id (verified against
  // the caller) so multi-client users and owners without a client_users row
  // both work; fall back to the caller's first membership otherwise.
  const requested = req.query?.client_id || null
  let clientId = null
  if (requested) {
    const { data: link } = await supabase
      .from('client_users').select('client_id')
      .eq('user_id', user.id).eq('client_id', requested).maybeSingle()
    if (link) clientId = requested
    else {
      const { data: owned } = await supabase
        .from('clients').select('id')
        .eq('id', requested).eq('owner_user_id', user.id).maybeSingle()
      if (owned) clientId = requested
    }
  } else {
    const { data: link } = await supabase
      .from('client_users').select('client_id').eq('user_id', user.id).limit(1).maybeSingle()
    clientId = link?.client_id || null
    if (!clientId) {
      const { data: owned } = await supabase
        .from('clients').select('id').eq('owner_user_id', user.id).limit(1).maybeSingle()
      clientId = owned?.id || null
    }
  }
  if (!clientId) return res.status(403).json({ error: 'Aucun client associé' })

  const [balanceRes, txRes] = await Promise.all([
    supabase.from('client_credits').select('*').eq('client_id', clientId).maybeSingle(),
    supabase
      .from('credit_transactions')
      .select('id, type, amount, balance_after, description, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(30),
  ])

  return res.status(200).json({
    balance: balanceRes.data?.balance || 0,
    total_purchased: balanceRes.data?.total_purchased || 0,
    total_used: balanceRes.data?.total_used || 0,
    transactions: txRes.data || [],
  })
}

export default withSentry(handler)
