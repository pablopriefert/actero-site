import Stripe from 'stripe';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

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
  const { company_name, email, monthly_price, slug, client_type } = funnelClient;

  console.log(`[ONBOARD] Starting onboarding for "${company_name}" (${email})`);

  // 1. Create client in "clients" table
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert([{ brand_name: company_name, client_type: client_type || 'ecommerce' }])
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
      hourly_cost: funnelClient.hourly_cost || (funnelClient.client_type === 'immobilier' ? 30 : 25),
      avg_ticket_time_min: funnelClient.avg_ticket_time_min || (funnelClient.client_type === 'immobilier' ? 8 : 5),
      actero_monthly_price: monthly_price || 0,
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

  return client.id;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let event;

  try {
    const rawBody = await getRawBody(req);
    const sig = req.headers['stripe-signature'];

    if (!endpointSecret) {
      console.error('STRIPE_WEBHOOK_SECRET is not configured — rejecting webhook');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }
    event = stripe.webhooks.constructEvent(rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const clientSlug = session.metadata?.client;
      let funnelClient = null;
      let onboardedClientId = null;

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
        const { data: fetchedClient, error: fetchError } = await supabase
          .from('funnel_clients')
          .select('*')
          .eq('slug', clientSlug)
          .single();

        funnelClient = fetchedClient;
        if (fetchError || !funnelClient) {
          console.error('Failed to fetch funnel client:', fetchError);
        } else {
          onboardedClientId = await onboardClientAfterPayment(funnelClient);
        }
      }

      // 3. Handle referral validation if referral_code is in metadata
      const referralCode = session.metadata?.referral_code;
      if (referralCode) {
        try {
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://actero.fr';
          await fetch(`${siteUrl}/api/referral/validate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
            },
            body: JSON.stringify({
              referral_code: referralCode,
              stripe_customer_id: session.customer,
            }),
          });
          console.log(`[REFERRAL] Validation triggered for code: ${referralCode}`);
        } catch (refErr) {
          console.error('[REFERRAL] Validation call failed:', refErr.message);
        }
      }

      // 4. Dispatch vers n8n — séquence onboarding Customer.io
      try {
        await fetch('https://n8n.srv1403284.hstgr.cloud/webhook/onboarding-stripe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            customer_email: funnelClient?.email || session.customer_details?.email || session.customer_email,
            customer_name: session.customer_details?.name || funnelClient?.company_name || '',
            company_name: funnelClient?.company_name || session.metadata?.company_name || '',
            website: funnelClient?.website || session.metadata?.website || '',
            plan: funnelClient?.plan || session.metadata?.plan || 'starter',
            vertical: funnelClient?.client_type || session.metadata?.vertical || 'ecommerce',
            setup_amount: session.amount_total ? session.amount_total / 100 : 0,
            client_id: onboardedClientId || null,
            paid_at: new Date().toISOString(),
          }),
        });
        console.log('[n8n] Onboarding dispatch OK');
      } catch (err) {
        console.error('[n8n] Onboarding dispatch failed:', err.message);
      }

      // 5. Email post-paiement — confirmation + lien Shopify (e-commerce uniquement)
      const clientEmail = funnelClient?.email || session.customer_details?.email || session.customer_email;
      const clientCompany = funnelClient?.company_name || session.customer_details?.name || '';
      const clientType = funnelClient?.client_type || 'ecommerce';

      if (clientEmail) {
        try {
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'Actero <onboarding@resend.dev>',
            to: [clientEmail],
            subject: 'Bienvenue chez Actero — Votre paiement est confirmé ✓',
            html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f8f8;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="padding:40px 40px 0 40px;">
          <div style="font-size:22px;font-weight:700;color:#000;letter-spacing:-0.5px;">Actero</div>
        </td></tr>
        <tr><td style="padding:32px 40px;">
          <h1 style="font-size:24px;font-weight:700;color:#000;margin:0 0 20px 0;line-height:1.3;">
            Paiement confirmé 🎉
          </h1>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 16px 0;">
            Bonjour${clientCompany ? ' ' + clientCompany : ''},
          </p>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 16px 0;">
            Votre paiement a bien été reçu. Votre compte Actero est en cours de configuration — vous recevrez un email d'invitation pour définir votre mot de passe dans quelques instants.
          </p>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 24px 0;">
            Notre équipe va préparer le déploiement de vos agents IA. Vous serez opérationnel sous 24-48h.
          </p>
        </td></tr>
        <tr><td style="padding:0 40px 32px 40px;">
          <div style="background-color:#fafafa;border:1px solid #eee;border-radius:12px;padding:16px 20px;">
            <p style="font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin:0 0 10px 0;">Prochaines étapes</p>
            <p style="font-size:14px;color:#444;line-height:1.8;margin:0;">
              1. Vous recevez un email pour créer votre mot de passe<br>
              2. Notre équipe vous contacte pour le setup<br>
              3. Vos agents IA sont déployés sous 24-48h<br>
              4. Accédez à votre dashboard de suivi en temps réel
            </p>
          </div>
        </td></tr>
        <tr><td style="padding:0 40px 40px 40px;">
          <p style="font-size:14px;color:#444;line-height:1.7;margin:0;">À très vite,</p>
          <p style="font-size:14px;font-weight:700;color:#000;margin:8px 0 0 0;">L'équipe Actero</p>
        </td></tr>
        <tr><td style="padding:20px 40px;background-color:#fafafa;border-top:1px solid #eee;">
          <p style="font-size:11px;color:#aaa;margin:0;text-align:center;line-height:1.5;">Cet email a été envoyé par Actero · actero.fr</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
          });
          console.log('[RESEND] Post-payment email sent to', clientEmail);
        } catch (emailErr) {
          console.error('[RESEND] Post-payment email failed:', emailErr.message);
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
