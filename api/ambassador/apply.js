import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'ACT-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default async function handler(req, res) {
  res.setHeader('X-RateLimit-Limit', '10');
  res.setHeader('X-RateLimit-Window', '3600');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
  if (phone && !/^[+\d\s()-]{6,20}$/.test(phone)) {
    return res.status(400).json({ error: 'Numéro de téléphone invalide.' });
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    // Check for duplicate application
    const { data: existing } = await supabase
      .from('ambassador_applications')
      .select('id, status')
      .eq('email', cleanEmail)
      .neq('status', 'rejected')
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Une candidature avec cet email existe déjà.' });
    }

    // Check if already an ambassador
    const { data: existingAmbassador } = await supabase
      .from('ambassadors')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existingAmbassador) {
      return res.status(409).json({ error: 'Cet email est déjà associé à un compte ambassadeur. Connectez-vous.' });
    }

    // 1. Save application
    const { data: application, error: appError } = await supabase
      .from('ambassador_applications')
      .insert({
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: cleanEmail,
        phone: phone?.trim() || null,
        network_type: network_type || null,
        message: message?.trim() || null,
        status: 'approved',
      })
      .select()
      .single();

    if (appError) {
      console.error('Insert application error:', appError);
      return res.status(500).json({ error: 'Erreur lors de la soumission.' });
    }

    // 2. Generate unique ambassador code
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

    // 3. Create Supabase auth user (or get existing)
    let userId;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      email_confirm: true,
      app_metadata: { role: 'ambassador' },
      user_metadata: { full_name: `${first_name.trim()} ${last_name.trim()}` },
    });

    if (authError) {
      // If user already exists in auth, find them via REST API
      if (authError.message?.includes('already') || authError.message?.includes('exists') || authError.message?.includes('unique') || authError.message?.includes('registered')) {
        // Direct REST call to find user by email
        const listRes = await fetch(`${supabaseUrl}/auth/v1/admin/users?page=1&per_page=50`, {
          headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'apikey': supabaseServiceKey },
        });
        const listData = await listRes.json();
        const existingUser = listData?.users?.find(u => u.email === cleanEmail);

        if (existingUser) {
          userId = existingUser.id;
          // Update role
          await fetch(`${supabaseUrl}/auth/v1/admin/users/${userId}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${supabaseServiceKey}`, 'apikey': supabaseServiceKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ app_metadata: { role: 'ambassador' } }),
          });
        } else {
          console.error('Auth user not found after conflict:', authError);
          return res.status(500).json({ error: 'Erreur création compte.' });
        }
      } else {
        console.error('Auth user creation error:', authError);
        return res.status(500).json({ error: 'Erreur création compte: ' + authError.message });
      }
    } else {
      userId = authData.user.id;
    }

    // 4. Create ambassador record
    const { data: ambassador, error: insertError } = await supabase
      .from('ambassadors')
      .insert({
        user_id: userId,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: cleanEmail,
        phone: phone?.trim() || null,
        network_type: network_type || null,
        ambassador_code: ambassadorCode,
        status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Ambassador insert error:', insertError);
      // Only delete user if we just created it
      if (authData?.user?.id) await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: 'Erreur création ambassadeur' });
    }

    // 5. Generate password setup link
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: cleanEmail,
      options: {
        redirectTo: 'https://actero.fr/ambassador/setup-password',
      },
    });

    const setupUrl = linkData?.properties?.action_link || 'https://actero.fr/ambassador/login';

    // 6. Send welcome email with password setup CTA
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Actero <notifications@actero.fr>';
    if (resendKey) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
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

                <p style="color: #d1d5db; text-align: center; margin-bottom: 24px; line-height: 1.6;">Pour accéder à votre espace ambassadeur, commencez par créer votre mot de passe :</p>

                <div style="text-align: center; margin-bottom: 32px;">
                  <a href="${setupUrl}" style="display: inline-block; background: #10b981; color: #000; font-weight: bold; font-size: 16px; padding: 14px 40px; border-radius: 12px; text-decoration: none; letter-spacing: 0.5px;">Créer mon mot de passe</a>
                </div>

                <div style="border-top: 1px solid #222; padding-top: 24px; margin-top: 16px;">
                  <p style="color: #6b7280; font-size: 13px; text-align: center; line-height: 1.6;">
                    Partagez votre lien à votre réseau professionnel.<br/>
                    Si un contact devient client Actero, vous touchez une récompense.<br/>
                    Zéro effort commercial. On gère tout.
                  </p>
                </div>

                <p style="color: #4b5563; font-size: 12px; text-align: center; margin-top: 24px;">— L'équipe Actero</p>
              </div>
            `,
          }),
        });
      } catch (emailErr) {
        console.error('Welcome email error (non-blocking):', emailErr);
      }
    }

    // 7. Create profile for ambassador
    await supabase.from('profiles').upsert({
      id: userId,
      role: 'ambassador',
    }, { onConflict: 'id' });

    return res.status(200).json({ success: true, application_id: application.id });
  } catch (err) {
    console.error('Apply error:', err);
    return res.status(500).json({ error: 'Erreur serveur.' });
  }
}
