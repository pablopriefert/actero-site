import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Send email via client's own SMTP (their custom email address).
 * Returns { sent: true, from: 'xxx@xxx.com' } or { sent: false, error: '...' }
 */
async function sendViaSMTP(smtpConfig, { to, subject, html, brandName }) {
  const nodemailer = await import('nodemailer').then(m => m.default || m);
  const transporter = nodemailer.createTransport({
    host: smtpConfig.smtp_host,
    port: parseInt(smtpConfig.smtp_port) || 587,
    secure: smtpConfig.use_ssl === true || parseInt(smtpConfig.smtp_port) === 465,
    auth: {
      user: smtpConfig.username,
      pass: smtpConfig.password,
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 8000,
    greetingTimeout: 5000,
  });

  const fromEmail = smtpConfig.email || smtpConfig.username;
  const fromDisplay = brandName ? `${brandName} <${fromEmail}>` : fromEmail;

  await transporter.sendMail({
    from: fromDisplay,
    to,
    subject,
    html,
  });

  return { sent: true, from: fromEmail };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise.' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise.' });

  const { conversation_id, response, add_to_kb } = req.body || {};
  if (!conversation_id || !response) {
    return res.status(400).json({ error: 'Missing conversation_id or response' });
  }

  try {
    // 1. Fetch conversation
    const { data: conversation, error: fetchError } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('id', conversation_id)
      .single();

    if (fetchError) throw fetchError;
    if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

    // 2. Get client info + SMTP config
    const [clientRes, smtpRes] = await Promise.all([
      supabase.from('clients').select('brand_name, contact_email').eq('id', conversation.client_id).single(),
      supabase.from('client_integrations')
        .select('extra_config, api_key')
        .eq('client_id', conversation.client_id)
        .eq('provider', 'smtp_imap')
        .eq('status', 'active')
        .maybeSingle(),
    ]);

    const brandName = clientRes.data?.brand_name || 'Support';
    const smtpConfig = smtpRes.data?.extra_config || null;
    // Merge password from api_key field if stored there
    if (smtpConfig && smtpRes.data?.api_key && !smtpConfig.password) {
      smtpConfig.password = smtpRes.data.api_key;
    }

    const isRealEmail = conversation.customer_email && !conversation.customer_email.includes('@anonymous.actero.fr');
    let emailResult = { sent: false };
    let sentVia = null;

    // 3. Send email if customer has a real email
    if (isRealEmail) {
      const subject = `Re: ${conversation.subject || 'Votre demande'}`;
      const escapedResponse = String(response)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/\n/g, '<br>');

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 20px;">
          <p style="color: #262626; font-size: 15px; line-height: 1.6;">
            ${conversation.customer_name ? `Bonjour ${conversation.customer_name},` : 'Bonjour,'}
          </p>
          <p style="color: #262626; font-size: 15px; line-height: 1.6;">
            ${escapedResponse}
          </p>
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">${brandName} — Service client</p>
        </div>
      `;

      // Priority 1: Client's own SMTP
      if (smtpConfig?.smtp_host && smtpConfig?.username && smtpConfig?.password) {
        try {
          emailResult = await sendViaSMTP(smtpConfig, {
            to: conversation.customer_email,
            subject, html, brandName,
          });
          sentVia = 'smtp';
        } catch (smtpErr) {
          console.error('[escalation] SMTP send failed:', smtpErr.message);
        }
      }
      // No SMTP configured → email won't be sent (client must configure SMTP/IMAP)
      if (!emailResult.sent && !smtpConfig?.smtp_host) {
        console.log('[escalation] No SMTP configured — email not sent. Client must connect SMTP/IMAP integration.');
      }
    }

    // 4. Update conversation
    const { error: updateError } = await supabase
      .from('ai_conversations')
      .update({
        human_response: response,
        human_responded_at: new Date().toISOString(),
        status: 'resolved',
      })
      .eq('id', conversation_id);

    if (updateError) throw updateError;

    // 5. Add to KB if requested
    if (add_to_kb) {
      await supabase.from('client_knowledge_base').insert({
        client_id: conversation.client_id,
        category: 'faq',
        title: conversation.subject || 'Question client',
        content: `Q: ${conversation.customer_message}\nR: ${response}`,
      });
      fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/sync-brand-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: conversation.client_id }),
      }).catch(() => {});
    }

    // 6. Track event
    await supabase.from('automation_events').insert({
      client_id: conversation.client_id,
      event_category: 'ticket_human_resolved',
      event_type: 'escalation_response',
      description: `Reponse humaine a ${conversation.customer_name || conversation.customer_email || 'un client'}${emailResult.sent ? ` — email envoye via ${sentVia} depuis ${emailResult.from}` : ''}`,
      metadata: {
        email_sent: emailResult.sent,
        sent_via: sentVia,
        sent_from: emailResult.from,
        customer_email: conversation.customer_email,
      },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      email_sent: emailResult.sent,
      sent_via: sentVia,
      sent_from: emailResult.from || null,
      customer_email: isRealEmail ? conversation.customer_email : null,
    });
  } catch (error) {
    console.error('escalation/respond error:', error);
    return res.status(500).json({ error: error.message });
  }
}
