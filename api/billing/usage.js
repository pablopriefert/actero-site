import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // --- Auth ---
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise.' });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise.' });

  const clientId = req.query?.client_id;
  if (!clientId) {
    return res.status(400).json({ error: 'Missing client_id' });
  }

  // --- Verify access ---
  const isAdmin = user.app_metadata?.role === 'admin' || user.email?.endsWith('@actero.fr');
  if (!isAdmin) {
    const { data: link } = await supabaseAdmin
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('client_id', clientId)
      .maybeSingle();
    if (!link) return res.status(403).json({ error: 'Acces refuse.' });
  }

  try {
    // Load client
    const { data: client, error: clientErr } = await supabaseAdmin
      .from('clients')
      .select('plan, trial_ends_at')
      .eq('id', clientId)
      .single();

    if (clientErr || !client) {
      return res.status(404).json({ error: 'Client introuvable.' });
    }

    const plan = client.plan || 'free';
    const period = new Date().toISOString().slice(0, 7); // "2026-04"

    // Load usage counters for current month
    const { data: usage } = await supabaseAdmin
      .from('usage_counters')
      .select('tickets_used, voice_minutes_used, overage_tickets')
      .eq('client_id', clientId)
      .eq('period', period)
      .maybeSingle();

    const ticketsUsed = usage?.tickets_used || 0;
    const voiceMinutesUsed = usage?.voice_minutes_used || 0;
    const overageTickets = usage?.overage_tickets || 0;

    // Plan limits (inline to avoid importing frontend plans.js)
    const LIMITS = {
      free: { tickets: 50, voice: 0, overage_rate: 0 },
      starter: { tickets: 1000, voice: 0, overage_rate: 0.10 },
      pro: { tickets: 5000, voice: 200, overage_rate: 0.10 },
      enterprise: { tickets: Infinity, voice: Infinity, overage_rate: 0 },
    };

    const limits = LIMITS[plan] || LIMITS.free;
    const overageCost = overageTickets * limits.overage_rate;

    // Next billing: first of next month (approximation)
    const now = new Date();
    const nextBilling = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      .toISOString()
      .slice(0, 10);

    return res.status(200).json({
      plan,
      period,
      tickets_used: ticketsUsed,
      tickets_limit: limits.tickets === Infinity ? -1 : limits.tickets,
      voice_minutes_used: voiceMinutesUsed,
      voice_minutes_limit: limits.voice === Infinity ? -1 : limits.voice,
      overage_tickets: overageTickets,
      overage_cost: Math.round(overageCost * 100) / 100,
      trial_ends_at: client.trial_ends_at || null,
      next_billing_date: nextBilling,
    });
  } catch (error) {
    console.error('Billing usage error:', error);
    return res.status(500).json({ error: 'Erreur interne.' });
  }
}
