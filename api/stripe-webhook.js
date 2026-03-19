import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Disable Vercel body parsing — Stripe needs the raw body
export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * After payment: create client account, invite user, link everything
 */
async function onboardClientAfterPayment(funnelClient) {
  const { company_name, email, monthly_price, slug } = funnelClient;

  console.log(`[ONBOARD] Starting onboarding for "${company_name}" (${email})`);

  // 1. Create client in "clients" table
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert([{ brand_name: company_name }])
    .select()
    .single();

  if (clientError) {
    console.error('[ONBOARD] Failed to create client:', clientError);
    return;
  }

  console.log(`[ONBOARD] Client created: ${client.id}`);

  // 2. Check if user already exists in auth
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingUser = existingUsers?.users?.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );

  let userId;

  if (existingUser) {
    // User already exists — just link them
    userId = existingUser.id;
    console.log(`[ONBOARD] User already exists: ${userId}`);
  } else {
    // 3. Invite user via Supabase Auth Admin API
    // This sends an invite email with a link to set their password
    const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo: 'https://actero.fr/setup-password',
        data: {
          client_id: client.id,
          brand_name: company_name,
        },
      }
    );

    if (inviteError) {
      console.error('[ONBOARD] Failed to invite user:', inviteError);
      return;
    }

    userId = inviteData.user.id;
    console.log(`[ONBOARD] User invited: ${userId}`);
  }

  // 4. Link user to client in client_users
  const { error: linkError } = await supabase
    .from('client_users')
    .upsert({
      user_id: userId,
      client_id: client.id,
      role: 'owner',
    }, { onConflict: 'user_id,client_id' });

  if (linkError) {
    console.error('[ONBOARD] Failed to link user:', linkError);
  }

  // 5. Create client_settings with pricing from funnel data
  const { error: settingsError } = await supabase
    .from('client_settings')
    .upsert({
      client_id: client.id,
      hourly_cost: funnelClient.hourly_cost || 0,
      avg_ticket_time_min: funnelClient.avg_ticket_time_min || 5,
      actero_monthly_price: funnelClient.actero_monthly_price || monthly_price || 0,
      currency: 'EUR',
    }, { onConflict: 'client_id' });

  if (settingsError) {
    console.error('[ONBOARD] Failed to create settings:', settingsError);
  }

  // 6. Update funnel_clients with the new client_id reference
  await supabase
    .from('funnel_clients')
    .update({
      status: 'paid',
      onboarded_client_id: client.id,
    })
    .eq('slug', slug);

  console.log(`[ONBOARD] Onboarding complete for "${company_name}". Client will receive invite email.`);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;

  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
    } else {
      event = JSON.parse(rawBody.toString());
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const clientSlug = session.metadata?.client;

      if (clientSlug) {
        // 1. Update funnel_clients with Stripe info
        const { error: updateError } = await supabase
          .from('funnel_clients')
          .update({
            status: 'paid',
            stripe_session_id: session.id,
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            paid_at: new Date().toISOString(),
          })
          .eq('slug', clientSlug);

        if (updateError) {
          console.error('Supabase update error:', updateError);
        }

        // 2. Fetch funnel client data and auto-onboard
        const { data: funnelClient, error: fetchError } = await supabase
          .from('funnel_clients')
          .select('*')
          .eq('slug', clientSlug)
          .single();

        if (fetchError || !funnelClient) {
          console.error('Failed to fetch funnel client:', fetchError);
        } else {
          await onboardClientAfterPayment(funnelClient);
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      const { error } = await supabase
        .from('funnel_clients')
        .update({ status: 'canceled' })
        .eq('stripe_subscription_id', subscription.id);

      if (error) console.error('Supabase cancel update error:', error);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log('Payment failed for invoice:', invoice.id);
      break;
    }

    default:
      break;
  }

  return res.status(200).json({ received: true });
}
