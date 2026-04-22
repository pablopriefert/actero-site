import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function generateCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = 'ACT-';
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function generatePassword() {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$';
  let pw = '';
  for (let i = 0; i < 14; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pw;
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Admin check: require authenticated admin user (JWT-based only)
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' });
  const isAdmin = user.app_metadata?.role === 'admin' || user.email?.endsWith('@actero.fr');
  if (!isAdmin) return res.status(403).json({ error: 'Acces refuse' });

  const { application_id, first_name, last_name, email, phone, network_type, siret } = req.body;

  try {
    let applicantData = {};

    // If from an application, fetch it
    if (application_id) {
      const { data: app, error: appError } = await supabase
        .from('ambassador_applications')
        .select('*')
        .eq('id', application_id)
        .single();

      if (appError || !app) {
        return res.status(404).json({ error: 'Candidature non trouvee' });
      }

      applicantData = {
        first_name: app.first_name,
        last_name: app.last_name,
        email: app.email,
        phone: app.phone,
        network_type: app.network_type,
      };

      // Mark application as approved
      await supabase
        .from('ambassador_applications')
        .update({ status: 'approved' })
        .eq('id', application_id);
    } else {
      applicantData = { first_name, last_name, email, phone, network_type };
    }

    if (!applicantData.email || !applicantData.first_name || !applicantData.last_name) {
      return res.status(400).json({ error: 'Donnees manquantes (first_name, last_name, email)' });
    }

    // Generate unique ambassador code
    let ambassadorCode;
    let codeExists = true;
    while (codeExists) {
      ambassadorCode = generateCode();
      const { data: existing } = await supabase
        .from('ambassadors')
        .select('id')
        .eq('ambassador_code', ambassadorCode)
        .maybeSingle();
      codeExists = !!existing;
    }

    // Create Supabase auth user
    const tempPassword = generatePassword();
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: applicantData.email,
      password: tempPassword,
      email_confirm: true,
      app_metadata: { role: 'ambassador' },
    });

    if (authError) {
      console.error('Auth user creation error:', authError);
      return res.status(500).json({ error: 'Erreur creation compte: ' + authError.message });
    }

    // Create ambassador record
    const { data: ambassador, error: insertError } = await supabase
      .from('ambassadors')
      .insert({
        user_id: authData.user.id,
        first_name: applicantData.first_name,
        last_name: applicantData.last_name,
        email: applicantData.email,
        phone: applicantData.phone || null,
        network_type: applicantData.network_type || null,
        siret: siret || null,
        ambassador_code: ambassadorCode,
        status: 'active',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Ambassador insert error:', insertError);
      // Clean up auth user if ambassador insert fails
      await supabase.auth.admin.deleteUser(authData.user.id);
      return res.status(500).json({ error: 'Erreur creation ambassadeur' });
    }

    // Send welcome email via Resend
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
            to: applicantData.email,
            subject: 'Bienvenue dans le programme Ambassadeur Actero !',
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #fff; padding: 40px; border-radius: 16px;">
                <h1 style="color: #10b981; margin-bottom: 24px;">Bienvenue ${applicantData.first_name} !</h1>
                <p style="color: #d1d5db; line-height: 1.6;">Votre compte ambassadeur Actero a ete cree avec succes.</p>
                <div style="background: #111; border: 1px solid #333; border-radius: 12px; padding: 24px; margin: 24px 0;">
                  <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 14px;">Vos identifiants :</p>
                  <p style="color: #fff; margin: 0 0 4px 0;"><strong>Email :</strong> ${applicantData.email}</p>
                  <p style="color: #fff; margin: 0 0 16px 0;"><strong>Mot de passe :</strong> ${tempPassword}</p>
                  <p style="color: #9ca3af; margin: 0 0 8px 0; font-size: 14px;">Votre code ambassadeur :</p>
                  <p style="color: #10b981; font-size: 24px; font-weight: bold; margin: 0; font-family: monospace;">${ambassadorCode}</p>
                </div>
                <p style="color: #d1d5db; line-height: 1.6;">Votre lien de parrainage :<br/>
                  <a href="https://actero.fr/audit?ref=${ambassadorCode}" style="color: #10b981;">https://actero.fr/audit?ref=${ambassadorCode}</a>
                </p>
                <p style="color: #6b7280; font-size: 14px; margin-top: 32px;">Nous vous recommandons de changer votre mot de passe lors de votre premiere connexion.</p>
                <p style="color: #6b7280; font-size: 14px;">— L'equipe Actero</p>
              </div>
            `,
          }),
        });
      } catch (emailErr) {
        console.error('Welcome email error (non-blocking):', emailErr);
      }
    }

    return res.status(200).json({
      success: true,
      ambassador,
      credentials: { email: applicantData.email, password: tempPassword },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
}

export default withSentry(handler)
