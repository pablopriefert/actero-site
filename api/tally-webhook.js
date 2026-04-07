import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Map Tally form IDs to handlers
const FORM_HANDLERS = {
  // Qualification pre-call
  'ODYeW8': handlePreCallQualification,
  // Demande partenariat
  'VLYjGM': handlePartnerRequest,
  // No-Show Relance
  'oboZab': handleNoShowRelance,
  // Recap post-call
  'EkLrZB': handlePostCallRecap,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { eventId, eventType, createdAt, data } = req.body;

    if (eventType !== 'FORM_RESPONSE') {
      return res.status(200).json({ ok: true, skipped: true });
    }

    const formId = data?.formId;
    const formName = data?.formName;
    const fields = data?.fields || [];

    console.log(`[Tally] Received submission for form "${formName}" (${formId})`);

    // Extract fields into a flat object
    const answers = {};
    fields.forEach(field => {
      const key = field.key || field.label?.toLowerCase().replace(/[^a-z0-9]/g, '_');
      if (field.value !== undefined && field.value !== null) {
        answers[key] = field.value;
      }
    });

    // Route to the right handler
    const handlerFn = FORM_HANDLERS[formId];
    if (handlerFn) {
      await handlerFn(answers, data, supabase);
      console.log(`[Tally] Handler executed for form ${formId}`);
    } else {
      console.log(`[Tally] No handler for form ${formId}, storing raw data`);
      // Store raw submission in a generic table or just log
      await supabase.from('tally_submissions').insert({
        form_id: formId,
        form_name: formName,
        answers,
        raw_data: data,
        created_at: createdAt,
      }).catch(() => {
        // Table might not exist yet, that's ok
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Tally] Webhook error:', err.message);
    return res.status(200).json({ ok: true, error: err.message });
  }
}

// ── Handlers ──

async function handlePreCallQualification(answers, data) {
  console.log('[Tally] Pre-call qualification:', JSON.stringify(answers).slice(0, 500));
  // This data can be used to enrich the funnel_clients or create a lead
  // For now, log it — connect to CRM/funnel later via n8n
}

async function handlePartnerRequest(answers, data, supabase) {
  const email = findAnswer(answers, ['email', 'e_mail', 'adresse_email']);
  const firstName = findAnswer(answers, ['prenom', 'first_name', 'pr_nom']);
  const lastName = findAnswer(answers, ['nom', 'last_name', 'nom_de_famille']);
  const company = findAnswer(answers, ['entreprise', 'societe', 'company', 'soci_t']);
  const phone = findAnswer(answers, ['telephone', 'phone', 't_l_phone']);

  if (email) {
    await supabase.from('partner_applications').upsert({
      email,
      first_name: firstName || '',
      last_name: lastName || '',
      company_name: company || '',
      phone: phone || '',
      source: 'tally_form',
      status: 'new',
    }, { onConflict: 'email' }).catch(() => {});
    console.log(`[Tally] Partner application created/updated for ${email}`);
  }
}

async function handleNoShowRelance(answers, data) {
  console.log('[Tally] No-show relance:', JSON.stringify(answers).slice(0, 500));
  // Trigger a n8n workflow or send an email
}

async function handlePostCallRecap(answers, data) {
  console.log('[Tally] Post-call recap:', JSON.stringify(answers).slice(0, 500));
  // Can create/update a funnel_clients entry with call notes
}

// Helper: find an answer by trying multiple possible keys
function findAnswer(answers, possibleKeys) {
  for (const key of possibleKeys) {
    if (answers[key]) return answers[key];
  }
  // Also try partial match
  for (const [answerKey, value] of Object.entries(answers)) {
    for (const key of possibleKeys) {
      if (answerKey.includes(key)) return value;
    }
  }
  return null;
}
