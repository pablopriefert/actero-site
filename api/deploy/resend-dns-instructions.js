import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const RESEND_KEY = process.env.RESEND_API_KEY;
  const db = createClient(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { client_id } = req.body || {};
  if (!client_id) {
    return res.status(400).json({ error: 'Missing client_id' });
  }

  try {
    const { data: callNotes, error } = await db
      .from('call_notes')
      .select('company_name, contact_email, support_email, resend_dns_records')
      .eq('client_id', client_id)
      .single();

    if (error || !callNotes) {
      return res.status(404).json({ error: 'Call notes not found' });
    }

    if (!callNotes.resend_dns_records || callNotes.resend_dns_records.length === 0) {
      return res.status(400).json({ error: 'No DNS records found' });
    }

    const domain = callNotes.support_email?.split('@')[1] || 'votre-domaine.com';
    const records = callNotes.resend_dns_records;

    // Build email content
    const dnsInstructions = records.map((r, i) => {
      return `Enregistrement ${i + 1} (${r.type}):\nType: ${r.type}\nNom: ${r.name}\nValeur: ${r.value}`;
    }).join('\n\n');

    // Send via Resend
    if (RESEND_KEY) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Actero <onboarding@actero.fr>',
          to: [callNotes.contact_email],
          subject: `Configuration email — Enregistrements DNS à ajouter`,
          text: `Bonjour,\n\nPour que les emails de votre IA partent depuis ${callNotes.support_email}, ajoutez ces enregistrements dans les DNS de votre domaine (${domain}).\n\nSi vous ne savez pas comment faire, transférez cet email à la personne qui gère votre site web ou votre hébergeur.\n\n${dnsInstructions}\n\nUne fois les enregistrements ajoutés, comptez 1 à 24h pour la propagation.\nNous vérifierons automatiquement et vous préviendrons dès que tout est en ordre.\n\nL'équipe Actero`,
        }),
      });
    }

    return res.status(200).json({ success: true, sent_to: callNotes.contact_email });
  } catch (error) {
    console.error('resend-dns-instructions error:', error);
    return res.status(500).json({ error: error.message });
  }
}
