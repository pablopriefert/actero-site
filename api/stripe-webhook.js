import Stripe from 'stripe';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { finalizeInstall as finalizeMarketplaceInstall } from './marketplace/install.js';

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
      hourly_cost: funnelClient.hourly_cost || 25,
      avg_ticket_time_min: funnelClient.avg_ticket_time_min || 5,
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

      // --- Credit pack purchase ---
      if (session.metadata?.type === 'credit_purchase' && session.metadata?.client_id) {
        try {
          const clientId = session.metadata.client_id;
          const credits = parseInt(session.metadata.credits, 10) || 0;

          if (credits > 0) {
            // Upsert balance row, then increment atomically
            await supabase.from('client_credits')
              .upsert({ client_id: clientId, balance: 0 }, { onConflict: 'client_id', ignoreDuplicates: true });

            // Read → add → write (+ log)
            const { data: current } = await supabase
              .from('client_credits')
              .select('balance, total_purchased')
              .eq('client_id', clientId)
              .maybeSingle();

            const newBalance = (current?.balance || 0) + credits;
            const newPurchased = (current?.total_purchased || 0) + credits;

            await supabase.from('client_credits').update({
              balance: newBalance,
              total_purchased: newPurchased,
              updated_at: new Date().toISOString(),
            }).eq('client_id', clientId);

            await supabase.from('credit_transactions').insert({
              client_id: clientId,
              type: 'purchase',
              amount: credits,
              balance_after: newBalance,
              description: `Achat de ${credits.toLocaleString('fr-FR')} crédits`,
              stripe_session_id: session.id,
              stripe_payment_intent: session.payment_intent,
            });

            console.log(`[CREDITS] +${credits} credits added to client ${clientId} (balance: ${newBalance})`);
          }
        } catch (err) {
          console.error('[CREDITS] Failed to add credits:', err);
        }
        return res.status(200).json({ received: true });
      }

      // --- SaaS self-service signup ---
      if (session.metadata?.kind === 'saas_signup' && session.metadata?.client_id) {
        try {
          const clientId = session.metadata.client_id;
          const updateData = {
            stripe_customer_id: session.customer,
          };

          // Set trial_ends_at from subscription trial_end if available
          if (session.subscription) {
            try {
              const subscription = await stripe.subscriptions.retrieve(session.subscription);
              if (subscription.trial_end) {
                updateData.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString();
              }
              updateData.stripe_subscription_id = subscription.id;
            } catch (subErr) {
              console.error('[SAAS_SIGNUP] Failed to retrieve subscription:', subErr.message);
            }
          }

          const { error: updateErr } = await supabase
            .from('clients')
            .update(updateData)
            .eq('id', clientId);

          if (updateErr) {
            console.error('[SAAS_SIGNUP] Failed to update client:', updateErr);
          } else {
            console.log(`[SAAS_SIGNUP] Client ${clientId} updated with Stripe info`);
          }
        } catch (saasErr) {
          console.error('[SAAS_SIGNUP] Handling failed:', saasErr);
        }
        return res.status(200).json({ received: true });
      }

      // --- In-dashboard upgrade (from /api/billing/upgrade) ---
      // Update client.plan immediately to avoid the lag until subscription.updated arrives
      if (session.metadata?.actero_client_id && session.metadata?.upgrade_to) {
        try {
          const clientId = session.metadata.actero_client_id;
          const newPlan = session.metadata.upgrade_to;
          const updateData = {
            plan: newPlan,
            stripe_customer_id: session.customer,
            status: 'active',
          };
          if (session.subscription) {
            try {
              const subscription = await stripe.subscriptions.retrieve(session.subscription);
              updateData.stripe_subscription_id = subscription.id;
              if (subscription.trial_end) {
                updateData.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString();
              }
            } catch (subErr) {
              console.error('[UPGRADE] Failed to retrieve subscription:', subErr.message);
            }
          }
          await supabase.from('clients').update(updateData).eq('id', clientId);
          console.log(`[UPGRADE] Client ${clientId} upgraded to ${newPlan}`);
        } catch (upErr) {
          console.error('[UPGRADE] Update failed:', upErr.message);
        }
        // Don't return — let other handlers (referrals, etc.) also run if needed
      }

      // --- Marketplace template purchase ---
      if (session.metadata?.template_id && session.metadata?.buyer_client_id) {
        try {
          const templateId = session.metadata.template_id;
          const buyerClientId = session.metadata.buyer_client_id;
          const creatorClientId = session.metadata.creator_client_id || null;
          const paidAmount = session.amount_total ? session.amount_total / 100 : 0;

          // Idempotency: skip if already installed
          const { data: existingInstall } = await supabase
            .from('marketplace_installs')
            .select('id')
            .eq('template_id', templateId)
            .eq('client_id', buyerClientId)
            .eq('status', 'active')
            .maybeSingle();

          if (existingInstall) {
            console.log('[MARKETPLACE] Install already exists, skipping:', existingInstall.id);
            return res.status(200).json({ received: true });
          }

          const { data: template, error: tplErr } = await supabase
            .from('marketplace_templates')
            .select('*')
            .eq('id', templateId)
            .maybeSingle();

          if (tplErr || !template) {
            console.error('[MARKETPLACE] Template not found:', tplErr);
            return res.status(200).json({ received: true });
          }

          const install = await finalizeMarketplaceInstall({
            template,
            client_id: buyerClientId,
            paid_amount: paidAmount,
          });

          console.log('[MARKETPLACE] Install finalized:', install.id);

          // Pay the creator via Stripe Connect (mocked — real impl needs creator stripe_account_id)
          try {
            const commission = Number((paidAmount * 0.2).toFixed(2));
            const payout = Number((paidAmount - commission).toFixed(2));

            if (creatorClientId) {
              const { data: creator } = await supabase
                .from('clients')
                .select('id, brand_name, stripe_connect_account_id')
                .eq('id', creatorClientId)
                .maybeSingle();

              if (creator?.stripe_connect_account_id && payout > 0) {
                // Real Stripe Connect transfer
                const transfer = await stripe.transfers.create({
                  amount: Math.round(payout * 100),
                  currency: 'eur',
                  destination: creator.stripe_connect_account_id,
                  metadata: {
                    template_id: templateId,
                    buyer_client_id: buyerClientId,
                    install_id: install.id,
                  },
                });
                console.log('[MARKETPLACE] Stripe transfer created:', transfer.id);
              } else {
                // Mock mode: just log — creator has no Stripe Connect yet
                console.log(
                  `[MARKETPLACE][MOCK] Would pay creator ${creatorClientId} = ${payout} EUR (commission ${commission} EUR)`
                );
              }
            }
          } catch (payErr) {
            console.error('[MARKETPLACE] Creator payout failed:', payErr.message);
          }
        } catch (mpErr) {
          console.error('[MARKETPLACE] Install handling failed:', mpErr);
        }
        return res.status(200).json({ received: true });
      }

      // --- Actero Partners certification payment ---
      if (session.metadata?.kind === 'partner_certification' && session.metadata?.application_id) {
        try {
          const applicationId = session.metadata.application_id;
          const { data: application, error: appErr } = await supabase
            .from('partner_applications')
            .select('*')
            .eq('id', applicationId)
            .maybeSingle();

          if (appErr || !application) {
            console.error('[PARTNERS] Application not found:', appErr);
            return res.status(200).json({ received: true });
          }

          // Idempotency: if already certified, skip
          const { data: existingPartner } = await supabase
            .from('partners')
            .select('id')
            .eq('application_id', applicationId)
            .maybeSingle();
          if (existingPartner) {
            console.log('[PARTNERS] Partner already exists, skipping:', existingPartner.id);
            return res.status(200).json({ received: true });
          }

          // Mark application as paid
          await supabase
            .from('partner_applications')
            .update({
              status: 'paid',
              stripe_session_id: session.id,
            })
            .eq('id', applicationId);

          // Find or invite user by email
          let partnerUserId = application.user_id;
          if (!partnerUserId) {
            const { data: existingUsers } = await supabase.auth.admin.listUsers();
            const existingUser = existingUsers?.users?.find(
              (u) => u.email?.toLowerCase() === application.email.toLowerCase()
            );
            if (existingUser) {
              partnerUserId = existingUser.id;
            } else {
              const { data: invited, error: inviteErr } =
                await supabase.auth.admin.inviteUserByEmail(application.email, {
                  redirectTo: 'https://actero.fr/setup-password',
                  data: {
                    partner_application_id: applicationId,
                    full_name: application.full_name || `${application.first_name} ${application.last_name}`,
                  },
                });
              if (inviteErr) {
                console.error('[PARTNERS] Failed to invite user:', inviteErr);
              } else {
                partnerUserId = invited?.user?.id || null;
              }
            }
          }

          // Generate slug + referral code
          const baseName = (application.full_name || `${application.first_name} ${application.last_name}`)
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          let slug = baseName || `partner-${applicationId.slice(0, 8)}`;
          // Ensure slug is unique
          const { data: slugTaken } = await supabase
            .from('partners')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();
          if (slugTaken) slug = `${slug}-${applicationId.slice(0, 6)}`;

          const referralCode = `P${Math.random().toString(36).slice(2, 8).toUpperCase()}${applicationId.slice(0, 4).toUpperCase()}`;

          const { data: newPartner, error: partnerErr } = await supabase
            .from('partners')
            .insert([
              {
                user_id: partnerUserId,
                application_id: applicationId,
                slug,
                full_name: application.full_name || `${application.first_name} ${application.last_name}`,
                company_name: application.company_name,
                website: application.website,
                linkedin: application.linkedin,
                referral_code: referralCode,
                bio: application.pitch || null,
                is_public: true,
              },
            ])
            .select()
            .single();

          if (partnerErr) {
            console.error('[PARTNERS] Failed to create partner:', partnerErr);
          } else {
            await supabase
              .from('partner_applications')
              .update({
                status: 'certified',
                certified_at: new Date().toISOString(),
                user_id: partnerUserId,
              })
              .eq('id', applicationId);
            console.log('[PARTNERS] Partner certified:', newPartner.id, newPartner.slug);
          }
        } catch (err) {
          console.error('[PARTNERS] Certification handling failed:', err);
        }
        return res.status(200).json({ received: true });
      }

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

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      try {
        const clientId = subscription.metadata?.client_id;
        if (clientId) {
          const updateData = {};
          // Detect plan change via price lookup
          const priceId = subscription.items?.data?.[0]?.price?.id;
          if (priceId) {
            const priceToplan = {};
            if (process.env.STRIPE_PRICE_STARTER_MONTHLY) priceToplan[process.env.STRIPE_PRICE_STARTER_MONTHLY] = 'starter';
            if (process.env.STRIPE_PRICE_STARTER_ANNUAL) priceToplan[process.env.STRIPE_PRICE_STARTER_ANNUAL] = 'starter';
            if (process.env.STRIPE_PRICE_PRO_MONTHLY) priceToplan[process.env.STRIPE_PRICE_PRO_MONTHLY] = 'pro';
            if (process.env.STRIPE_PRICE_PRO_ANNUAL) priceToplan[process.env.STRIPE_PRICE_PRO_ANNUAL] = 'pro';
            const newPlan = priceToplan[priceId];
            if (newPlan) updateData.plan = newPlan;
          }
          // Update trial_ends_at if trial changed
          if (subscription.trial_end) {
            updateData.trial_ends_at = new Date(subscription.trial_end * 1000).toISOString();
          }
          // Detect cancellation
          if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
            updateData.status = 'inactive';
          } else if (subscription.status === 'active') {
            updateData.status = 'active';
          }

          if (Object.keys(updateData).length > 0) {
            await supabase.from('clients').update(updateData).eq('id', clientId);
            console.log(`[SUB_UPDATED] Client ${clientId} updated:`, updateData);
          }

          // Sync Stripe Entitlements
          try {
            const { syncEntitlementsFromStripe } = await import('./lib/entitlements.js');
            await syncEntitlementsFromStripe(supabase, stripe, clientId, subscription.customer);
            console.log(`[SUB_UPDATED] Entitlements synced for ${clientId}`);
          } catch (entErr) {
            console.error('[SUB_UPDATED] Entitlements sync failed:', entErr.message);
          }
        }
      } catch (err) {
        console.error('[SUB_UPDATED] Error:', err.message);
      }
      break;
    }

    case 'customer.subscription.trial_will_end': {
      // Fires 3 days before trial ends
      const subscription = event.data.object;
      try {
        const clientId = subscription.metadata?.client_id;
        const customerEmail = subscription.customer ? null : null;
        // Retrieve customer email
        let email = null;
        if (subscription.customer) {
          const customer = await stripe.customers.retrieve(subscription.customer);
          email = customer.email;
        }
        if (email) {
          const trialEnd = subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
            : 'bientôt';

          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'Actero <onboarding@resend.dev>',
            to: [email],
            subject: 'Votre essai Actero se termine bientôt',
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
            Votre essai se termine le ${trialEnd}
          </h1>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 16px 0;">
            Votre période d'essai gratuit Actero touche à sa fin. Pour continuer à bénéficier de vos agents IA et de toutes les fonctionnalités, aucune action n'est requise — votre abonnement démarrera automatiquement.
          </p>
          <p style="font-size:15px;color:#444;line-height:1.7;margin:0 0 24px 0;">
            Si vous souhaitez annuler, rendez-vous dans votre dashboard avant la fin de l'essai.
          </p>
          <a href="https://actero.fr/client/overview" style="display:inline-block;background-color:#0F5F35;color:#fff;font-size:15px;font-weight:600;padding:12px 28px;border-radius:12px;text-decoration:none;">Accéder à mon dashboard</a>
        </td></tr>
        <tr><td style="padding:20px 40px 40px 40px;">
          <p style="font-size:14px;color:#444;line-height:1.7;margin:0;">À très vite,</p>
          <p style="font-size:14px;font-weight:700;color:#000;margin:8px 0 0 0;">L'équipe Actero</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
          });
          console.log(`[TRIAL_REMINDER] Email sent to ${email} (client: ${clientId})`);
        }
      } catch (err) {
        console.error('[TRIAL_REMINDER] Error:', err.message);
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

      // Also handle SaaS clients
      const { data: saasClient } = await supabase
        .from('clients')
        .select('id')
        .eq('stripe_subscription_id', subscription.id)
        .maybeSingle()

      if (saasClient) {
        await supabase.from('clients').update({
          plan: 'free',
          status: 'canceled',
          stripe_subscription_id: null,
        }).eq('id', saasClient.id)

        // Clear Stripe entitlements (client falls back to Free plan features)
        await supabase
          .from('client_entitlements')
          .delete()
          .eq('client_id', saasClient.id)
          .eq('source', 'stripe')

        console.log(`[stripe-webhook] SaaS client ${saasClient.id} subscription canceled, downgraded to free`)
      }
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
