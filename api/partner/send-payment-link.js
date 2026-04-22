import { withSentry } from '../lib/sentry.js'
import Stripe from 'stripe';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkAdmin(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return false;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;
  return user.app_metadata?.role === 'admin' || user.email?.endsWith('@actero.fr');
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isAdmin = await checkAdmin(req);
  if (!isAdmin) return res.status(403).json({ error: 'Acces refuse' });

  const { partner_email, partner_name, amount_eur, description } = req.body;

  if (!partner_email || !amount_eur) {
    return res.status(400).json({ error: 'Email et montant requis' });
  }

  try {
    // Create a Stripe Checkout Session (one-time payment)
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: partner_email,
      line_items: [{
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(amount_eur * 100),
          product_data: {
            name: description || 'Commission partenaire Actero',
          },
        },
        quantity: 1,
      }],
      success_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://actero.fr'}/success?partner=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://actero.fr'}/cancel`,
      metadata: {
        type: 'partner_payment',
        partner_email,
      },
    });

    // Send email with payment link
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Actero <onboarding@resend.dev>',
      to: [partner_email],
      subject: 'Actero — Lien de paiement',
      html: `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#F9F7F1;font-family:-apple-system,BlinkMacSystemFont,'DM Sans','Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F9F7F1;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E5E7EB;">
        <tr><td style="padding:32px 32px 0 32px;">
          <div style="font-size:20px;font-weight:700;color:#262626;letter-spacing:-0.5px;">Actero</div>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <h1 style="font-size:22px;font-weight:700;color:#262626;margin:0 0 16px 0;">
            ${partner_name ? `Bonjour ${partner_name},` : 'Bonjour,'}
          </h1>
          <p style="font-size:15px;color:#716D5C;line-height:1.7;margin:0 0 24px 0;">
            Voici votre lien de paiement pour un montant de <strong style="color:#262626;">${amount_eur} EUR</strong>.
          </p>
          <a href="${session.url}"
             style="display:inline-block;background-color:#0E653A;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:999px;">
            Proceder au paiement
          </a>
          <p style="font-size:13px;color:#716D5C;line-height:1.6;margin:24px 0 0 0;">
            Ce lien est valable 24 heures. Paiement securise par Stripe.
          </p>
        </td></tr>
        <tr><td style="padding:20px 32px;background-color:#F9F7F1;border-top:1px solid #E5E7EB;">
          <p style="font-size:11px;color:#716D5C;margin:0;text-align:center;">Actero — actero.fr</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    return res.status(200).json({
      success: true,
      checkout_url: session.url,
      message: `Lien envoye a ${partner_email}`,
    });
  } catch (err) {
    console.error('Partner payment link error:', err);
    return res.status(500).json({ error: err.message });
  }
}

export default withSentry(handler)
