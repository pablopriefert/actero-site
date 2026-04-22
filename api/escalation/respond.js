import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Send email via SMTP using nodemailer (loaded dynamically to avoid bundle issues).
 */
async function sendViaSMTP(smtpConfig, { to, subject, html, brandName, inReplyTo, references }) {
  // Dynamic require to avoid Vercel bundling issues
  let nodemailer;
  try {
    nodemailer = (await import('nodemailer')).default;
  } catch (e1) {
    try {
      nodemailer = require('nodemailer');
    } catch (e2) {
      throw new Error('nodemailer not available: ' + e1.message);
    }
  }

  const transporter = nodemailer.createTransport({
    host: smtpConfig.smtp_host,
    port: parseInt(smtpConfig.smtp_port) || 587,
    secure: parseInt(smtpConfig.smtp_port) === 465,
    auth: {
      user: smtpConfig.username,
      pass: smtpConfig.password,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 8000,
    greetingTimeout: 5000,
    socketTimeout: 8000,
  });

  const fromEmail = smtpConfig.email || smtpConfig.username;
  const fromDisplay = brandName ? `${brandName} <${fromEmail}>` : fromEmail;

  // Threading headers — make the reply land in the customer's existing thread.
  const extraHeaders = {};
  if (inReplyTo) extraHeaders['In-Reply-To'] = inReplyTo;
  if (references) extraHeaders['References'] = references;

  const info = await transporter.sendMail({
    from: fromDisplay,
    to,
    subject,
    html,
    headers: Object.keys(extraHeaders).length ? extraHeaders : undefined,
    inReplyTo: inReplyTo || undefined,
    references: references || undefined,
  });
  return { sent: true, from: fromEmail, messageId: info.messageId };
}

// Clean email subject mapping
const SUBJECT_MAP = {
  autre: 'Votre demande',
  general: 'Votre demande',
  suivi_commande: 'Suivi de votre commande',
  order_tracking: 'Suivi de votre commande',
  retour_produit: 'Votre retour produit',
  return_exchange: 'Votre retour produit',
  remboursement: 'Votre demande de remboursement',
  question_produit: 'Votre question',
  product_info: 'Votre question produit',
  reclamation: 'Suite a votre reclamation',
  billing: 'Votre demande facturation',
  livraison: 'Votre livraison',
  'Demande client': 'Votre demande',
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorise.' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorise.' });

  const { conversation_id, response, add_to_kb, audio_url } = req.body || {};
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
    if (smtpConfig && smtpRes.data?.api_key) {
      smtpConfig.password = smtpRes.data.api_key;
    }

    const isRealEmail = conversation.customer_email && !conversation.customer_email.includes('@anonymous.actero.fr');
    let emailResult = { sent: false, error: null };
    let sentVia = null;

    // 3. Send email via client's SMTP
    if (isRealEmail && smtpConfig?.smtp_host && smtpConfig?.username && smtpConfig?.password) {
      const rawSubject = conversation.subject || 'Votre demande'
      const cleanSubject = SUBJECT_MAP[rawSubject.toLowerCase()] || SUBJECT_MAP[rawSubject] || (rawSubject.length > 3 && !rawSubject.match(/^[a-z_]+$/) ? rawSubject : 'Votre demande')
      const subject = `${brandName} — ${cleanSubject}`;

      const escapedResponse = String(response)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/\n/g, '<br>');

      // Audio block — only inserted if the reply was synthesized and uploaded.
      // Gmail/Outlook strip <audio> tags, so we render a styled "play" card
      // with a direct link (works everywhere).
      const audioBlock = audio_url
        ? `
          <div style="margin:20px 0;padding:16px 18px;background:#f9f7f1;border:1px solid #e5e5e5;border-radius:12px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
              <span style="display:inline-flex;width:28px;height:28px;align-items:center;justify-content:center;background:#0E653A;border-radius:50%;color:#fff;font-size:14px;">🎙</span>
              <strong style="color:#262626;font-size:14px;">Message vocal de ${brandName}</strong>
            </div>
            <p style="margin:0 0 10px 0;color:#666;font-size:13px;line-height:1.5;">
              Nous avons aussi enregistré une réponse audio pour vous.
            </p>
            <a href="${audio_url}" style="display:inline-block;padding:8px 14px;background:#0E653A;color:#fff;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600;">
              ▶ Écouter la réponse
            </a>
            <audio controls style="display:block;width:100%;margin-top:10px;" src="${audio_url}"></audio>
          </div>
        `
        : '';

      const html = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 20px;">
          <p style="color: #262626; font-size: 15px; line-height: 1.6;">${conversation.customer_name ? `Bonjour ${conversation.customer_name},` : 'Bonjour,'}</p>
          <p style="color: #262626; font-size: 15px; line-height: 1.6;">${escapedResponse}</p>
          ${audioBlock}
          <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">${brandName} — Service client</p>
        </div>
      `;

      try {
        // Build threading — reuse customer's Message-ID to keep the convo in one thread
        const inReplyTo = conversation.email_message_id || null;
        const references = conversation.email_references
          ? `${conversation.email_references} ${conversation.email_message_id || ''}`.trim()
          : conversation.email_message_id || null;

        emailResult = await sendViaSMTP(smtpConfig, {
          to: conversation.customer_email, subject, html, brandName,
          inReplyTo, references,
        });
        sentVia = 'smtp';
        console.log(`[escalation] Email sent via SMTP from ${emailResult.from} to ${conversation.customer_email}`);
      } catch (smtpErr) {
        console.error('[escalation] SMTP send failed:', smtpErr.message);
        emailResult = { sent: false, error: smtpErr.message };
      }
    } else if (isRealEmail && !smtpConfig?.smtp_host) {
      emailResult = { sent: false, error: 'SMTP non configure. Connectez votre email dans Integrations.' };
    }

    // 4. Update conversation (always) — include audio_url in metadata when provided
    const updatePayload = {
      human_response: response,
      human_responded_at: new Date().toISOString(),
      status: 'resolved',
    };
    if (audio_url) {
      updatePayload.human_response_audio_url = audio_url;
    }
    await supabase.from('ai_conversations').update(updatePayload).eq('id', conversation_id);

    // 5. Add to KB if requested
    if (add_to_kb) {
      await supabase.from('client_knowledge_base').insert({
        client_id: conversation.client_id,
        category: 'faq',
        title: conversation.subject || 'Question client',
        content: `Q: ${conversation.customer_message}\nR: ${response}`,
      });
    }

    // 6. Track event
    await supabase.from('automation_events').insert({
      client_id: conversation.client_id,
      event_category: 'ticket_human_resolved',
      event_type: 'escalation_response',
      description: `Reponse humaine a ${conversation.customer_name || conversation.customer_email || 'un client'}${emailResult.sent ? ` — email envoye depuis ${emailResult.from}` : ''}`,
      metadata: { email_sent: emailResult.sent, sent_via: sentVia, error: emailResult.error },
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      email_sent: emailResult.sent,
      email_error: emailResult.error || null,
      sent_via: sentVia,
      customer_email: isRealEmail ? conversation.customer_email : null,
    });
  } catch (error) {
    console.error('escalation/respond error:', error.message || error);
    return res.status(500).json({ error: error.message });
  }
}

export default withSentry(handler)
