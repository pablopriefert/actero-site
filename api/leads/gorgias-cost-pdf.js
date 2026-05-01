/**
 * POST /api/leads/gorgias-cost-pdf
 *
 * Captures a lead from the Gorgias cost calculator. Only persists to
 * Supabase — the marketing follow-up email is handled out-of-band (no
 * external ESP push from this endpoint anymore).
 *
 * Body: { email, tickets, aiPercent, source }
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, tickets, aiPercent, source } = req.body || {}

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'invalid_email' })
  }
  const ticketsNum = Number(tickets)
  const aiPercentNum = Number(aiPercent)
  if (!Number.isFinite(ticketsNum) || ticketsNum < 1 || ticketsNum > 100000) {
    return res.status(400).json({ error: 'invalid_tickets' })
  }
  if (!Number.isFinite(aiPercentNum) || aiPercentNum < 0 || aiPercentNum > 100) {
    return res.status(400).json({ error: 'invalid_ai_percent' })
  }

  const payload = {
    email,
    tickets: ticketsNum,
    ai_percent: aiPercentNum,
    source: typeof source === 'string' ? source.slice(0, 64) : 'unknown',
    ip: req.headers['x-forwarded-for'] || null,
    user_agent: (req.headers['user-agent'] || '').slice(0, 256),
    created_at: new Date().toISOString(),
  }

  // Persist to Supabase (best-effort — table is allowed to fail without
  // breaking the user flow). Schema:
  //   id uuid pk · email text · tickets int · ai_percent int · source text
  //   ip text · user_agent text · created_at timestamptz
  try {
    await supabase.from('cost_calculator_leads').insert(payload)
  } catch (err) {
    console.error('cost_calculator_leads insert failed:', err)
  }

  return res.status(200).json({ ok: true })
}
