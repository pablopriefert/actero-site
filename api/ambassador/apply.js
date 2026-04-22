import { withSentry } from '../lib/sentry.js'
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp } from '../lib/rate-limit.js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  // crypto-secure: prevents brute-force enumeration of partner codes.
  const bytes = crypto.randomBytes(5);
  let code = 'ACT-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(bytes[i] % chars.length);
  }
  return code;
}

async function handler(req, res) {
  res.setHeader('X-RateLimit-Limit', '5');
  res.setHeader('X-RateLimit-Window', '60');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 5 requests/min per IP
  const ip = getClientIp(req);
  const rl = checkRateLimit(`ambassador_apply:${ip}`, 5, 60_000);
  res.setHeader('X-RateLimit-Remaining', String(rl.remaining));
  if (!rl.allowed) {
    res.setHeader('Retry-After', String(Math.ceil((rl.resetAt - Date.now()) / 1000)));
    return res.status(429).json({ error: 'Trop de tentatives. Merci de reessayer dans un instant.' });
  }

  const { first_name, last_name, email, phone, network_type, message } = req.body || {};

  // Validation
  if (!first_name || typeof first_name !== 'string' || first_name.trim().length < 2) {
    return res.status(400).json({ error: 'Le prénom est requis (minimum 2 caractères).' });
  }
  if (!last_name || typeof last_name !== 'string' || last_name.trim().length < 2) {
    return res.status(400).json({ error: 'Le nom est requis (minimum 2 caractères).' });
  }
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Un email valide est requis.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // Check if already an active ambassador
    const { data: existingAmbassador } = await supabase
      .from('ambassadors')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingAmbassador) {
      return res.status(409).json({ error: 'Cet email est déjà associé à un compte ambassadeur. Connectez-vous.' });
    }

    // STEP 1: Create or find auth user
    let userId;

    // First try to find existing auth user
    const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=100`, {
      headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'apikey': supabaseServiceKey },
    });
    const listData = await listRes.json();
    const existingUser = listData?.users?.find(u => u.email === cleanEmail);

    if (existingUser) {
      userId = existingUser.id;
      // Update role to ambassador
      await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'apikey': supabaseServiceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_metadata: { role: 'ambassador' } }),
      });
      console.log('Found existing auth user:', userId);
    } else {
      // Create new auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        email_confirm: true,
        app_metadata: { role: 'ambassador' },
        user_metadata: { full_name: `${first_name.trim()} ${last_name.trim()}` },
      });

      if (authError) {
        console.error('Auth user creation error:', authError);
        return res.status(500).json({ error: 'Erreur création compte: ' + authError.message });
      }
      userId = authData.user.id;
      console.log('Created new auth user:', userId);
    }

    // STEP 2: Generate unique ambassador code
    let ambassadorCode;
    let codeExists = true;
    while (codeExists) {
      ambassadorCode = generateCode();
      const { data: codeCheck } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('ambassador_code', ambassadorCode)
        .maybeSingle();
      codeExists = !!codeCheck;
    }

    // STEP 3: Create ambassador record (no network_type to avoid check constraint)
    const { data: ambassador, error: insertError } = await supabase
      .from('ambassadors')
      .insert({
        user_id: userId,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: cleanEmail,
        phone: phone?.trim() || null,
        ambassador_code: ambassadorCode,
        status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Ambassador insert error:', JSON.stringify(insertError));
      return res.status(500).json({ error: 'Erreur création ambassadeur: ' + insertError.message });
    }

    // STEP 4: Save application record
    await supabase.from('ambassador_applications').insert({
      first_name: first_name.trim(),
      last_name: last_name.trim(),
      email: cleanEmail,
      phone: phone?.trim() || null,
      network_type: network_type || null,
      message: message?.trim() || null,
      status: 'approved',
    });

    // STEP 5: Create profile
    await supabase.from('profiles').upsert({
      id: userId,
      role: 'ambassador',
    }, { onConflict: 'id' });

    // STEP 6: Generate password setup link
    let setupUrl = 'https://actero.fr/ambassador/login';
    try {
      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: cleanEmail,
        options: { redirectTo: 'https://actero.fr/ambassador/setup-password' },
      });
      if (linkData?.properties?.action_link) {
        setupUrl = linkData.properties.action_link;
      }
    } catch (e) {
      console.error('Magic link generation failed (non-blocking):', e);
    }

    // STEP 7: Send welcome email
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Actero <notifications@actero.fr>';
    if (resendKey) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: fromEmail,
            to: cleanEmail,
            subject: `Bienvenue ${first_name.trim()} ! Votre espace ambassadeur Actero est prêt`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #fff; padding: 40px; border-radius: 16px;">
                <div style="text-align: center; margin-bottom: 32px;">
                  <div style="display: inline-block; background: #10b981; color: #000; font-weight: bold; font-size: 14px; padding: 6px 16px; border-radius: 20px; letter-spacing: 1px;">PROGRAMME AMBASSADEUR</div>
                </div>
                <h1 style="color: #fff; text-align: center; margin-bottom: 8px; font-size: 28px;">Bienvenue ${first_name.trim()} !</h1>
                <p style="color: #9ca3af; text-align: center; margin-bottom: 32px; font-size: 16px;">Votre compte ambassadeur a été créé avec succès.</p>
                <div style="background: #111; border: 1px solid #222; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                  <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Votre code ambassadeur</p>
                  <p style="color: #10b981; font-size: 32px; font-weight: bold; margin: 0; font-family: monospace; letter-spacing: 4px;">${ambassadorCode}</p>
                </div>
                <div style="background: #111; border: 1px solid #222; border-radius: 12px; padding: 24px; margin-bottom: 32px;">
                  <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Votre lien de parrainage</p>
                  <p style="margin: 0;"><a href="https://actero.fr/audit?ref=${ambassadorCode}" style="color: #10b981; font-size: 14px; word-break: break-all;">actero.fr/audit?ref=${ambassadorCode}</a></p>
                </div>
                <p style="color: #d1d5db; text-align: center; margin-bottom: 24px; line-height: 1.6;">Pour accéder à votre espace ambassadeur, créez votre mot de passe :</p>
                <div style="text-align: center; margin-bottom: 32px;">
                  <a href="${setupUrl}" style="display: inline-block; background: #10b981; color: #000; font-weight: bold; font-size: 16px; padding: 14px 40px; border-radius: 12px; text-decoration: none;">Créer mon mot de passe</a>
                </div>
                <div style="border-top: 1px solid #222; padding-top: 24px;">
                  <p style="color: #6b7280; font-size: 13px; text-align: center; line-height: 1.6;">
                    Partagez votre lien à votre réseau professionnel.<br/>
                    Si un contact devient client Actero, vous touchez une récompense.<br/>
                    Zéro effort commercial. On gère tout.
                  </p>
                </div>
              </div>
            `,
          }),
        });
      } catch (emailErr) {
        console.error('Welcome email error (non-blocking):', emailErr);
      }
    }

    console.log('Ambassador created successfully:', ambassadorCode, cleanEmail);
    return res.status(200).json({ success: true, ambassador_code: ambassadorCode });
  } catch (err) {
    console.error('Apply error:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}

export default withSentry(handler)
