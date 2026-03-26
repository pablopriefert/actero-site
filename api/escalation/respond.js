import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check: requires authenticated user
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé.' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorisé.' });

  const { conversation_id, response, add_to_kb } = req.body || {};

  if (!conversation_id || !response) {
    return res.status(400).json({ error: 'Missing conversation_id or response' });
  }

  try {
    // 1. Fetch the conversation
    const { data: conversation, error: fetchError } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('id', conversation_id)
      .single();

    if (fetchError) throw fetchError;
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // 2. Send email to customer via Resend (if configured)
    if (conversation.customer_email && process.env.RESEND_API_KEY) {
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL || 'support@actero.fr',
          to: conversation.customer_email,
          subject: `Re: ${conversation.subject || 'Votre demande'}`,
          html: `
            <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
              <p>${String(response).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br>')}</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error('Email send error (non-blocking):', emailErr.message);
      }
    }

    // 3. Update conversation
    const { error: updateError } = await supabase
      .from('ai_conversations')
      .update({
        human_response: response,
        human_responded_at: new Date().toISOString(),
        status: 'resolved',
      })
      .eq('id', conversation_id);

    if (updateError) throw updateError;

    // 4. Add to KB if requested
    if (add_to_kb) {
      await supabase.from('client_knowledge_base').insert({
        client_id: conversation.client_id,
        category: 'faq',
        title: conversation.subject || 'Question client',
        content: `Q: ${conversation.customer_message}\nR: ${response}`,
      });

      // Sync brand context
      fetch(`${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/sync-brand-context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: conversation.client_id }),
      }).catch(() => {});
    }

    // 5. Track event
    await supabase.from('automation_events').insert({
      client_id: conversation.client_id,
      event_category: 'ticket_human_resolved',
      event_type: 'escalation_response',
      description: `Reponse humaine a ${conversation.customer_name || conversation.customer_email || 'un client'}`,
    }).catch(() => {});

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('escalation/respond error:', error);
    return res.status(500).json({ error: error.message });
  }
}
