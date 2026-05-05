import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '../lib/rate-limit.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 5 signups per IP per hour
  const ip = getClientIp(req);
  const rl = checkRateLimit(`signup:${ip}`, 5, 60 * 60 * 1000);
  if (!rl.allowed) {
    return res.status(429).json({ error: 'Trop de tentatives. Réessayez plus tard.' });
  }

  const { email, password, brand_name, shopify_url, referral_code, acquisition_source } = req.body || {};

  // --- Validation ---
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Email invalide.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 8 caractères.' });
  }
  if (!brand_name || !brand_name.trim()) {
    return res.status(400).json({ error: 'Le nom de la boutique est requis.' });
  }

  let userId = null;
  let clientId = null;

  try {
    // 1. Create user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { brand_name, plan: 'free' },
    });

    if (authError) {
      // User already exists
      if (authError.message?.includes('already') || authError.status === 422) {
        return res.status(409).json({ error: 'Un compte existe déjà avec cet email.' });
      }
      console.error('[SIGNUP] Auth error:', authError);
      return res.status(500).json({ error: 'Erreur lors de la création du compte.' });
    }

    userId = authData.user.id;

    // 2. Create client row (always Free)
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .insert([{
        brand_name: brand_name.trim(),
        contact_email: email,
        owner_user_id: userId,
        plan: 'free',
        status: 'active',
        ...(shopify_url && { shopify_url: shopify_url.trim() }),
        ...(acquisition_source && typeof acquisition_source === 'object' && { acquisition_source }),
      }])
      .select()
      .single();

    if (clientError) {
      console.error('[SIGNUP] Client creation error:', clientError);
      throw new Error('Failed to create client');
    }

    clientId = client.id;

    // 3. Create client_settings
    const { error: settingsError } = await supabase
      .from('client_settings')
      .insert([{
        client_id: clientId,
        hourly_cost: 25,
      }]);

    if (settingsError) {
      console.error('[SIGNUP] Settings creation error:', settingsError);
    }

    // 4. Create client_users (owner)
    const { error: linkError } = await supabase
      .from('client_users')
      .insert([{
        client_id: clientId,
        user_id: userId,
        role: 'owner',
      }]);

    if (linkError) {
      console.error('[SIGNUP] Client-user link error:', linkError);
    }

    // 5. Process referral code if present
    let referralApplied = false;
    if (referral_code) {
      try {
        const code = referral_code.toUpperCase();

        // Verify the referrer exists
        const { data: referrer } = await supabase
          .from('clients')
          .select('id, brand_name')
          .eq('referral_code', code)
          .maybeSingle();

        if (referrer) {
          // Mark the client as having a free first month
          await supabase
            .from('clients')
            .update({ referral_first_month_free: true, referred_by_client_id: referrer.id })
            .eq('id', clientId);

          // Update the referral record (or create one) to link the referee
          const { data: existingRef } = await supabase
            .from('referrals')
            .select('id')
            .eq('referral_code', code)
            .in('status', ['clicked'])
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (existingRef) {
            await supabase
              .from('referrals')
              .update({
                status: 'signed_up',
                referee_client_id: clientId,
                signed_up_at: new Date().toISOString(),
              })
              .eq('id', existingRef.id);
          } else {
            // Direct signup with referral code (no prior click tracked)
            await supabase
              .from('referrals')
              .insert({
                referrer_client_id: referrer.id,
                referee_client_id: clientId,
                referral_code: code,
                status: 'signed_up',
                referral_link: `https://actero.fr/r/${code}`,
                signed_up_at: new Date().toISOString(),
                created_at: new Date().toISOString(),
              });
          }

          referralApplied = true;
          console.log(`[SIGNUP] Referral applied: code=${code}, referrer=${referrer.id}, referee=${clientId}`);
        }
      } catch (refErr) {
        console.error('[SIGNUP] Referral processing error (non-blocking):', refErr);
      }
    }

    // 6. Send welcome email (non-blocking)
    try {
      const { sendWelcomeEmail } = await import('../lib/welcome-email.js');
      sendWelcomeEmail({
        email,
        brand_name: brand_name.trim(),
        has_referral: referralApplied,
      }).then((r) => {
        if (r.sent) console.log(`[SIGNUP] Welcome email sent to ${email}`);
      });
    } catch (welcomeErr) {
      console.error('[SIGNUP] Welcome email error:', welcomeErr.message);
    }

    // 6b. Notify internal team via Slack (non-blocking)
    try {
      const { notifySignup } = await import('../lib/notify-signup.js');
      notifySignup({
        email,
        brand_name: brand_name.trim(),
        acquisition_source,
      }).catch(() => { /* silent */ });
    } catch (notifyErr) {
      console.error('[SIGNUP] Notify error:', notifyErr.message);
    }

    // 6c. Push event to Lightfield CRM (non-blocking, fire-and-forget).
    // Creates Account + Contact + Opportunity stage "Trial Activated".
    try {
      const { pushSignupToLightfield } = await import('../lib/lightfield.js');
      // acquisition_source on /signup can be either a string ('linkedin') or
      // a JSON object captured client-side ({ source: 'linkedin', campaign: '...' }).
      const utmSource = typeof acquisition_source === 'string'
        ? acquisition_source
        : acquisition_source?.source || 'direct';
      const utmCampaign = typeof acquisition_source === 'object'
        ? acquisition_source?.campaign || ''
        : '';
      pushSignupToLightfield({
        client_id: clientId,
        email,
        name: brand_name.trim(),
        shop_domain: shopify_url ? shopify_url.trim().replace(/^https?:\/\//, '').replace(/\/$/, '') : '',
        company_name: brand_name.trim(),
        utm_source: utmSource,
        utm_campaign: utmCampaign,
      });
    } catch (lfErr) {
      console.error('[SIGNUP] Lightfield push error:', lfErr.message);
    }

    // 7. Redirect to dashboard — Free plan auto-provisioned. Upsell from sidebar.
    return res.status(200).json({
      success: true,
      referral_applied: referralApplied,
      redirect: '/client',
    });

  } catch (err) {
    console.error('[SIGNUP] Unexpected error:', err);

    // Cleanup on failure
    try {
      if (clientId) {
        await supabase.from('client_users').delete().eq('client_id', clientId);
        await supabase.from('client_settings').delete().eq('client_id', clientId);
        await supabase.from('clients').delete().eq('id', clientId);
      }
      if (userId) {
        await supabase.auth.admin.deleteUser(userId);
      }
    } catch (cleanupErr) {
      console.error('[SIGNUP] Cleanup error:', cleanupErr);
    }

    return res.status(500).json({ error: 'Erreur interne. Veuillez réessayer.' });
  }
}

export default withSentry(handler)
