import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildReportHtml({ brand_name, period, stats }) {
  const safeName = escapeHtml(brand_name);
  const safePeriod = escapeHtml(period);
  return `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f8f8f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f8f8;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr><td style="padding:40px 40px 0 40px;">
          <div style="font-size:22px;font-weight:700;color:#000;letter-spacing:-0.5px;">Actero</div>
        </td></tr>

        <tr><td style="padding:32px 40px;">
          <h1 style="font-size:22px;font-weight:700;color:#000;margin:0 0 8px 0;">Rapport mensuel — ${safePeriod}</h1>
          <p style="font-size:15px;color:#666;margin:0 0 28px 0;">Voici les performances de vos automatisations ce mois-ci, ${safeName}.</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px 0;">
            <tr>
              <td width="50%" style="padding:16px;background:#f0fdf4;border-radius:12px 0 0 12px;">
                <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Temps économisé</div>
                <div style="font-size:28px;font-weight:800;color:#059669;margin-top:4px;">${stats.time_saved}h</div>
              </td>
              <td width="50%" style="padding:16px;background:#fffbeb;border-radius:0 12px 12px 0;">
                <div style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:1px;font-weight:600;">ROI généré</div>
                <div style="font-size:28px;font-weight:800;color:#d97706;margin-top:4px;">${stats.roi.toLocaleString('fr-FR')}€</div>
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa;border:1px solid #eee;border-radius:12px;margin:0 0 28px 0;">
            <tr>
              <td style="padding:16px 20px;border-bottom:1px solid #eee;">
                <span style="font-size:14px;color:#666;">Actions IA exécutées</span>
                <span style="float:right;font-size:14px;font-weight:700;color:#000;">${stats.tasks_executed}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px;border-bottom:1px solid #eee;">
                <span style="font-size:14px;color:#666;">Tickets résolus</span>
                <span style="float:right;font-size:14px;font-weight:700;color:#000;">${stats.tickets_resolved || 0}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px;">
                <span style="font-size:14px;color:#666;">Paniers récupérés</span>
                <span style="float:right;font-size:14px;font-weight:700;color:#000;">${stats.carts_recovered || 0}</span>
              </td>
            </tr>
          </table>

          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:4px 0 28px 0;">
              <a href="https://actero.fr/login" style="display:inline-block;background-color:#000;color:#fff;font-size:16px;font-weight:700;text-decoration:none;padding:16px 40px;border-radius:12px;">
                Voir mon dashboard
              </a>
            </td></tr>
          </table>
        </td></tr>

        <tr><td style="padding:0 40px 40px 40px;">
          <p style="font-size:14px;color:#444;margin:0;">Merci pour votre confiance,</p>
          <p style="font-size:14px;font-weight:700;color:#000;margin:8px 0 0 0;">L'équipe Actero</p>
        </td></tr>

        <tr><td style="padding:20px 40px;background-color:#fafafa;border-top:1px solid #eee;">
          <p style="font-size:11px;color:#aaa;margin:0;text-align:center;">Actero · actero.fr · Rapport automatique mensuel</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Internal/admin-only: triggers monthly report emails
  const internalSecret = process.env.INTERNAL_API_SECRET;
  if (internalSecret && req.headers['x-internal-secret'] !== internalSecret) {
    // Also allow admin users via JWT
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(403).json({ error: 'Accès refusé.' });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(403).json({ error: 'Accès refusé.' });
    const isAdmin = user.app_metadata?.role === 'admin' || user.email?.endsWith('@actero.fr');
    if (!isAdmin) return res.status(403).json({ error: 'Accès refusé.' });
  }

  const { client_id } = req.body;
  if (!client_id) {
    return res.status(400).json({ error: 'Missing client_id' });
  }

  try {
    // Get client info
    const { data: client } = await supabase
      .from('clients')
      .select('id, brand_name, contact_email')
      .eq('id', client_id)
      .single();

    if (!client) return res.status(404).json({ error: 'Client not found' });

    // Get client user email
    const { data: clientUser } = await supabase
      .from('client_users')
      .select('user_id')
      .eq('client_id', client_id)
      .limit(1)
      .single();

    let recipientEmail = client.contact_email;
    if (!recipientEmail && clientUser) {
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const user = users?.find(u => u.id === clientUser.user_id);
      recipientEmail = user?.email;
    }

    if (!recipientEmail) return res.status(400).json({ error: 'No email found for client' });

    // Get this month's metrics
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const period = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

    const { data: metrics = [] } = await supabase
      .from('metrics_daily')
      .select('*')
      .eq('client_id', client_id)
      .gte('date', startOfMonth.split('T')[0]);

    const { data: events = [] } = await supabase
      .from('automation_events')
      .select('event_category')
      .eq('client_id', client_id)
      .gte('created_at', startOfMonth);

    const stats = {
      time_saved: Math.round(metrics.reduce((s, m) => s + (Number(m.time_saved_minutes) || 0), 0) / 60),
      roi: Math.round(metrics.reduce((s, m) => s + (Number(m.estimated_roi) || 0), 0)),
      tasks_executed: metrics.reduce((s, m) => s + (Number(m.tasks_executed) || 0), 0),
      tickets_resolved: events.filter(e => e.event_category === 'ticket_resolved').length,
      carts_recovered: events.filter(e => e.event_category === 'cart_recovered').length,
    };

    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Actero <onboarding@resend.dev>',
      to: [recipientEmail],
      subject: `Rapport Actero — ${period}`,
      html: buildReportHtml({ brand_name: client.brand_name, period, stats }),
    });

    if (error) throw error;

    return res.status(200).json({ success: true, sent_to: recipientEmail, stats });
  } catch (error) {
    console.error('Monthly report error:', error);
    return res.status(500).json({ error: error.message });
  }
}
