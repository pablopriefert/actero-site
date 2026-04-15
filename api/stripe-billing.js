import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from './lib/admin-auth.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Admin-only: exposes all Stripe billing data
  const adminUser = await requireAdmin(req, res, supabase);
  if (!adminUser) return;

  try {
    // Fetch active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      limit: 100,
      status: 'all',
      expand: ['data.customer', 'data.items.data.price'],
    });

    // Fetch recent invoices
    const invoices = await stripe.invoices.list({
      limit: 50,
      expand: ['data.customer'],
    });

    // Fetch balance
    const balance = await stripe.balance.retrieve();

    // Compute MRR
    const activeSubs = subscriptions.data.filter(s => s.status === 'active');
    const mrr = activeSubs.reduce((sum, sub) => {
      const amount = sub.items.data.reduce((s, item) => {
        if (item.price.recurring?.interval === 'month') return s + item.price.unit_amount;
        if (item.price.recurring?.interval === 'year') return s + Math.round(item.price.unit_amount / 12);
        return s;
      }, 0);
      return sum + amount;
    }, 0);

    // Format data
    const formattedSubs = subscriptions.data.map(sub => ({
      id: sub.id,
      status: sub.status,
      customer_name: sub.customer?.name || sub.customer?.email || 'Inconnu',
      customer_email: sub.customer?.email,
      current_period_start: sub.current_period_start,
      current_period_end: sub.current_period_end,
      created: sub.created,
      cancel_at_period_end: sub.cancel_at_period_end,
      amount: sub.items.data.reduce((s, item) => s + (item.price.unit_amount || 0), 0),
      interval: sub.items.data[0]?.price?.recurring?.interval || 'month',
    }));

    const formattedInvoices = invoices.data.map(inv => ({
      id: inv.id,
      number: inv.number,
      customer_name: inv.customer?.name || inv.customer?.email || 'Inconnu',
      customer_email: inv.customer?.email,
      amount_due: inv.amount_due,
      amount_paid: inv.amount_paid,
      status: inv.status,
      created: inv.created,
      due_date: inv.due_date,
      hosted_invoice_url: inv.hosted_invoice_url,
    }));

    const availableBalance = balance.available.reduce((sum, b) => sum + b.amount, 0);
    const pendingBalance = balance.pending.reduce((sum, b) => sum + b.amount, 0);

    return res.status(200).json({
      mrr: mrr / 100,
      activeSubscriptions: activeSubs.length,
      totalSubscriptions: subscriptions.data.length,
      availableBalance: availableBalance / 100,
      pendingBalance: pendingBalance / 100,
      subscriptions: formattedSubs,
      invoices: formattedInvoices,
    });
  } catch (error) {
    console.error('Stripe billing error:', error);
    return res.status(500).json({ error: error.message });
  }
}
