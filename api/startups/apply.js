import { withSentry } from '../lib/sentry.js'
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const { boutique_name, url, email, revenue, platform, motivation } = req.body || {};

    // Validate required fields
    if (!boutique_name || !url || !email || !revenue || !platform || !motivation) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis.'
      });
    }

    // Store application in Supabase
    const supabase = getSupabase();
    if (supabase) {
      const { error: dbError } = await supabase
        .from('startup_applications')
        .insert({
          boutique_name,
          url,
          email,
          revenue,
          platform,
          motivation,
          status: 'pending',
        });
      if (dbError) {
        console.error('[startups/apply] DB insert error:', dbError);
        // Continue anyway — email notification is the fallback
      }
    } else {
      console.warn('[startups/apply] Supabase not configured, skipping DB storage');
    }

    // Send notification email to startups@actero.fr
    if (resend) {
      await resend.emails.send({
        from: 'Actero Startups <noreply@actero.fr>',
        to: ['startups@actero.fr'],
        subject: `Nouvelle candidature Startups — ${escapeHtml(boutique_name)}`,
        html: `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;background:#f8f8f8;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="padding:40px;">
          <div style="font-size:22px;font-weight:700;color:#003725;letter-spacing:-0.5px;margin-bottom:24px;">Nouvelle candidature Startups</div>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:8px 0;font-weight:600;color:#262626;font-size:14px;">Boutique</td><td style="padding:8px 0;color:#716D5C;font-size:14px;">${escapeHtml(boutique_name)}</td></tr>
            <tr><td style="padding:8px 0;font-weight:600;color:#262626;font-size:14px;">URL</td><td style="padding:8px 0;color:#716D5C;font-size:14px;"><a href="${escapeHtml(url)}" style="color:#0E653A;">${escapeHtml(url)}</a></td></tr>
            <tr><td style="padding:8px 0;font-weight:600;color:#262626;font-size:14px;">Email</td><td style="padding:8px 0;color:#716D5C;font-size:14px;"><a href="mailto:${escapeHtml(email)}" style="color:#0E653A;">${escapeHtml(email)}</a></td></tr>
            <tr><td style="padding:8px 0;font-weight:600;color:#262626;font-size:14px;">CA annuel</td><td style="padding:8px 0;color:#716D5C;font-size:14px;">${escapeHtml(revenue)}</td></tr>
            <tr><td style="padding:8px 0;font-weight:600;color:#262626;font-size:14px;">Plateforme</td><td style="padding:8px 0;color:#716D5C;font-size:14px;">${escapeHtml(platform)}</td></tr>
            <tr><td style="padding:8px 0;font-weight:600;color:#262626;font-size:14px;vertical-align:top;">Motivation</td><td style="padding:8px 0;color:#716D5C;font-size:14px;">${escapeHtml(motivation)}</td></tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
      });
    } else {
      console.log('[startups/apply] Resend not configured, logging application:', {
        boutique_name, url, email, revenue, platform, motivation
      });
    }

    // Send confirmation email to applicant
    if (resend) {
      await resend.emails.send({
        from: 'Actero <noreply@actero.fr>',
        to: [email],
        subject: 'Candidature Actero for Startups bien reçue',
        html: `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;background:#f8f8f8;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="padding:40px;">
          <div style="font-size:22px;font-weight:700;color:#003725;letter-spacing:-0.5px;margin-bottom:16px;">Actero for Startups</div>
          <p style="color:#262626;font-size:15px;line-height:1.6;margin:0 0 16px;">Bonjour,</p>
          <p style="color:#716D5C;font-size:15px;line-height:1.6;margin:0 0 16px;">Nous avons bien reçu votre candidature pour <strong>${escapeHtml(boutique_name)}</strong>. Notre equipe l'examine et vous repondra sous 48 heures.</p>
          <p style="color:#716D5C;font-size:15px;line-height:1.6;margin:0 0 24px;">En attendant, n'hesitez pas a decouvrir notre plateforme sur <a href="https://actero.fr" style="color:#0E653A;font-weight:600;">actero.fr</a>.</p>
          <p style="color:#262626;font-size:15px;line-height:1.6;margin:0;">L'equipe Actero</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Candidature reçue ! Nous reviendrons vers vous sous 48h.'
    });
  } catch (error) {
    console.error('[startups/apply] Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Une erreur est survenue. Veuillez réessayer.'
    });
  }
}

export default withSentry(handler)
