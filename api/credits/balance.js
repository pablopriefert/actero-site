/**
 * GET /api/credits/balance — returns the client's credit balance + recent transactions.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return res.status(401).json({ error: 'Non autorisé' })

  const { data: link } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!link?.client_id) return res.status(403).json({ error: 'Aucun client associé' })

  const clientId = link.client_id

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
