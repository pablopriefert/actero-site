import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { isActeroAdmin } from '../lib/admin-auth.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Internal/cron-only endpoint. Fail closed if secret is missing from the
  // request (but still allow Vercel Cron + admin JWT as fallbacks).
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const hasValidSecret = !!(internalSecret && req.headers['x-internal-secret'] === internalSecret);
  if (!hasValidSecret) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) return res.status(403).json({ error: 'Accès refusé.' });
      const isAdmin = await isActeroAdmin(user, supabase);
      if (!isAdmin) return res.status(403).json({ error: 'Accès refusé.' });
    } else if (!req.headers['x-vercel-cron-signature']) {
      return res.status(403).json({ error: 'Accès refusé.' });
    }
  }

  try {
    // 1. Get clients with daily_summary enabled
    const { data: prefs, error: prefsError } = await supabase
      .from('client_notification_preferences')
      .select('client_id')
      .eq('daily_summary', true);

    if (prefsError) throw prefsError;
    if (!prefs || prefs.length === 0) {
      return res.status(200).json({ message: 'No clients with daily summary enabled', sent: 0 });
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
    const endOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1).toISOString();

    let sentCount = 0;

    for (const pref of prefs) {
      const clientId = pref.client_id;

      // Fetch client info
      const { data: client } = await supabase
        .from('clients')
        .select('brand_name, contact_email')
        .eq('id', clientId)
        .single();

      if (!client || !client.contact_email) continue;

      // Fetch yesterday's events
      const { data: events } = await supabase
        .from('automation_events')
        .select('event_category, time_saved_seconds, revenue_amount')
        .eq('client_id', clientId)
        .gte('created_at', startOfYesterday)
        .lt('created_at', endOfYesterday);

      if (!events || events.length === 0) continue;

      // Aggregate
      const totalEvents = events.length;
      const ticketsResolved = events.filter(e => e.event_category === 'ticket_resolved').length;
      const cartsRecovered = events.filter(e => e.event_category === 'cart_recovered').length;
      const timeSavedMin = Math.round(events.reduce((sum, e) => sum + (e.time_saved_seconds || 0), 0) / 60);
      const revenue = events.reduce((sum, e) => sum + (Number(e.revenue_amount) || 0), 0);
      const timeSavedH = (timeSavedMin / 60).toFixed(1);

      const safeName = escapeHtml(client.brand_name || 'Client');
      const subject = `Hier avec Actero : ${totalEvents} actions, ${timeSavedH}h economisees`;

      const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
<tr><td style="padding:40px 40px 0 40px;">
  <div style="font-size:22px;font-weight:700;color:#000;">Actero</div>
</td></tr>
<tr><td style="padding:32px 40px;">
  <h1 style="font-size:20px;font-weight:700;color:#000;margin:0 0 8px 0;">Resume de la veille</h1>
  <p style="font-size:15px;color:#666;margin:0 0 28px 0;">Bonjour ${safeName}, voici le resume de l'activite de votre IA hier :</p>

  <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px 0;">
    <tr>
      <td width="50%" style="padding:16px;background:#f0fdf4;border-radius:12px 0 0 12px;">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Actions IA</div>
        <div style="font-size:28px;font-weight:800;color:#059669;margin-top:4px;">${totalEvents}</div>
      </td>
      <td width="50%" style="padding:16px;background:#eff6ff;border-radius:0 12px 12px 0;">
        <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Temps economise</div>
        <div style="font-size:28px;font-weight:800;color:#2563eb;margin-top:4px;">${timeSavedH}h</div>
      </td>
    </tr>
  </table>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #eee;border-radius:12px;margin:0 0 24px 0;">
    ${ticketsResolved > 0 ? `<tr><td style="padding:12px 20px;border-bottom:1px solid #eee;"><span style="font-size:14px;color:#666;">Tickets resolus</span><span style="float:right;font-weight:700;color:#000;">${ticketsResolved}</span></td></tr>` : ''}
    ${cartsRecovered > 0 ? `<tr><td style="padding:12px 20px;border-bottom:1px solid #eee;"><span style="font-size:14px;color:#666;">Paniers recuperes</span><span style="float:right;font-weight:700;color:#000;">${cartsRecovered}</span></td></tr>` : ''}
    ${revenue > 0 ? `<tr><td style="padding:12px 20px;"><span style="font-size:14px;color:#666;">Revenus generes</span><span style="float:right;font-weight:700;color:#059669;">${revenue.toLocaleString('fr-FR')}EUR</span></td></tr>` : ''}
  </table>

  <a href="https://actero.fr/client" style="display:inline-block;background:#000;color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-size:14px;font-weight:700;">Voir le detail dans votre dashboard</a>
</td></tr>
<tr><td style="padding:20px 40px 40px 40px;">
  <p style="font-size:12px;color:#999;margin:0;">Actero — Automatisez votre business avec l'IA</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

      try {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'notifications@actero.fr',
          to: client.contact_email,
          subject,
          html,
        });

        // Log notification
        await supabase.from('client_notifications_log').insert({
          client_id: clientId,
          notification_type: 'daily_summary',
          subject,
        });

        sentCount++;
      } catch (emailErr) {
        console.error(`Email failed for ${clientId}:`, emailErr.message);
      }
    }

    return res.status(200).json({ message: `Sent ${sentCount} daily summaries`, sent: sentCount });
  } catch (error) {
    console.error('daily-summary error:', error);
    return res.status(500).json({ error: error.message });
  }
}

export default withSentry(handler)
