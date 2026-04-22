import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Internal-only: called from n8n workflows. Fail closed if neither the
  // secret nor a valid JWT is provided.
  const internalSecret = process.env.INTERNAL_API_SECRET;
  const hasValidSecret = !!(internalSecret && req.headers['x-internal-secret'] === internalSecret);
  if (!hasValidSecret) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(403).json({ error: 'Accès refusé.' });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(403).json({ error: 'Accès refusé.' });
  }

  const { client_id, ticket_id, customer_name, customer_email, subject, message, escalation_reason } = req.body || {};

  if (!client_id) {
    return res.status(400).json({ error: 'Missing client_id' });
  }

  try {
    // Check if client has escalation_alert enabled
    const { data: prefs } = await supabase
      .from('client_notification_preferences')
      .select('escalation_alert')
      .eq('client_id', client_id)
      .maybeSingle();

    if (prefs && prefs.escalation_alert === false) {
      return res.status(200).json({ message: 'Escalation alerts disabled for this client', sent: false });
    }

    // Get client contact email
    const { data: client } = await supabase
      .from('clients')
      .select('brand_name, contact_email')
      .eq('id', client_id)
      .single();

    if (!client || !client.contact_email) {
      return res.status(200).json({ message: 'No contact email for client', sent: false });
    }

    const safeName = escapeHtml(client.brand_name || 'Client');
    const safeCustomer = escapeHtml(customer_name || customer_email || 'Un client');
    const safeSubject = escapeHtml(subject || 'Sans objet');
    const safeMessage = escapeHtml(message || '');
    const safeReason = escapeHtml(escalation_reason || 'Escalade automatique');

    const emailSubject = `Ticket escalade — Intervention requise`;

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
  <div style="background:#fef3c7;border:1px solid #fbbf24;border-radius:12px;padding:16px;margin-bottom:24px;">
    <p style="font-size:14px;font-weight:700;color:#92400e;margin:0;">Ticket escalade</p>
    <p style="font-size:13px;color:#92400e;margin:4px 0 0 0;">Raison : ${safeReason}</p>
  </div>

  <p style="font-size:15px;color:#666;margin:0 0 16px 0;">Bonjour ${safeName}, un ticket necessite votre intervention :</p>

  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #eee;border-radius:12px;margin:0 0 24px 0;">
    <tr><td style="padding:12px 20px;border-bottom:1px solid #eee;">
      <span style="font-size:13px;color:#888;">Client</span>
      <span style="float:right;font-size:14px;font-weight:600;color:#000;">${safeCustomer}</span>
    </td></tr>
    <tr><td style="padding:12px 20px;border-bottom:1px solid #eee;">
      <span style="font-size:13px;color:#888;">Sujet</span>
      <span style="float:right;font-size:14px;font-weight:600;color:#000;">${safeSubject}</span>
    </td></tr>
    ${ticket_id ? `<tr><td style="padding:12px 20px;border-bottom:1px solid #eee;">
      <span style="font-size:13px;color:#888;">Ticket</span>
      <span style="float:right;font-size:14px;font-weight:600;color:#000;">${escapeHtml(ticket_id)}</span>
    </td></tr>` : ''}
  </table>

  <div style="background:#f9fafb;border:1px solid #eee;border-radius:12px;padding:16px;margin:0 0 24px 0;">
    <p style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:600;margin:0 0 8px 0;">Message du client</p>
    <p style="font-size:14px;color:#333;margin:0;white-space:pre-wrap;">${safeMessage}</p>
  </div>

  <a href="https://actero.fr/client/escalations" style="display:inline-block;background:#000;color:#fff;padding:14px 28px;border-radius:12px;text-decoration:none;font-size:14px;font-weight:700;">Repondre a ce ticket</a>
</td></tr>
<tr><td style="padding:20px 40px 40px 40px;">
  <p style="font-size:12px;color:#999;margin:0;">Actero — Automatisez votre business avec l'IA</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'alerts@actero.fr',
      to: client.contact_email,
      subject: emailSubject,
      html,
    });

    // Log notification
    await supabase.from('client_notifications_log').insert({
      client_id,
      notification_type: 'escalation_alert',
      subject: emailSubject,
    });

    return res.status(200).json({ success: true, sent: true });
  } catch (error) {
    console.error('escalation-alert error:', error);
    return res.status(500).json({ error: error.message });
  }
}

export default withSentry(handler)
