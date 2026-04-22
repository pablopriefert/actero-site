// Client Copilot — AI assistant for client dashboard questions
import { withSentry } from './lib/sentry.js'
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import { isActeroAdmin } from './lib/admin-auth.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Tu es Actero Copilot, l'assistant IA du dashboard client Actero.
Actero automatise le support client e-commerce (Shopify, WooCommerce, Webflow) avec l'IA.

RÈGLES:
- Réponds en français, de manière concise et professionnelle
- Explique les métriques de manière simple et actionnable
- Si le client a un problème technique, guide-le étape par étape
- Si tu ne peux pas résoudre le problème, dis-lui de contacter le support via l'onglet "Aide"
- Ne révèle JAMAIS les tokens d'accès, clés API ou données sensibles
- Sois encourageant sur les résultats positifs
- Suggère des optimisations basées sur les données

MÉTRIQUES CLÉS:
- "Tickets résolus" = demandes SAV traitées automatiquement par l'IA
- "Paniers récupérés" = paniers abandonnés relancés par email menant à un achat
- "ROI généré" = revenus récupérés (paniers + réduction charge SAV)
- "Temps économisé" = heures que l'équipe support n'a pas eu à travailler
- "Taux d'automatisation" = % de tickets traités sans intervention humaine

PLANS:
- Free (0€): 50 tickets/mois, 1 workflow, Shopify
- Starter (99€): 1000 tickets/mois, 3 workflows, 3 intégrations, ROI complet
- Pro (399€): 5000 tickets/mois, WhatsApp, guardrails, agents spécialisés, API
- Enterprise (sur devis): illimité, multi-boutique, white-label

AUTOMATISATIONS DISPONIBLES:
- SAV Support Client (tous plans)
- Relance paniers abandonnés (Shopify)
- Comptabilité automatisée (factures en retard, alertes trésorerie)
- WhatsApp Business (Pro+)
- Agents IA spécialisés (Pro+)

INTÉGRATIONS SUPPORTÉES:
- E-commerce: Shopify, WooCommerce, Webflow (un seul à la fois)
- Helpdesk: Gorgias, Zendesk (un seul)
- Email: Resend ou SMTP personnalisé (un seul)
- Autres: Slack, Axonaut, Pennylane, iPaidThat, WhatsApp Business

TU NE PEUX PAS:
- Modifier les workflows (dis-leur de contacter le support)
- Accéder aux données d'autres clients
- Changer les paramètres de facturation (redirige vers Facturation)
- Donner des conseils juridiques ou financiers

CONSEILS:
- Si taux d'automatisation < 60%, suggérer d'enrichir la base de connaissances
- Si paniers récupérés baissent, vérifier les templates d'email et le timing
- ROI = (paniers × valeur moyenne) + (tickets auto × coût horaire × temps/ticket)`;

async function askClaude(systemPrompt, userPrompt, history) {
  const messages = []
  if (history) {
    messages.push({ role: 'user', content: `Historique précédent:\n${history}\n\nNouvelle question: ${userPrompt}` })
  } else {
    messages.push({ role: 'user', content: userPrompt })
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages,
  })
  return response.content[0]?.text || 'Je ne peux pas répondre pour le moment.'
}

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY manquante' });

  // Auth check
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Non autorisé.' });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Non autorisé.' });

  const { client_id, message, history } = req.body;
  if (!client_id || !message) return res.status(400).json({ error: 'Missing client_id or message' });

  // Verify user has access to this client
  const isAdmin = await isActeroAdmin(user, supabase);
  if (!isAdmin) {
    const { data: link } = await supabase
      .from('client_users')
      .select('client_id')
      .eq('user_id', user.id)
      .eq('client_id', client_id)
      .maybeSingle();
    if (!link) return res.status(403).json({ error: 'Accès refusé.' });
  }

  try {
    // Fetch client context
    const [clientRes, settingsRes, metricsRes, eventsRes, integrationsRes] = await Promise.all([
      supabase.from('clients').select('id, brand_name, plan, status, contact_email, created_at').eq('id', client_id).maybeSingle(),
      supabase.from('client_settings').select('*').eq('client_id', client_id).maybeSingle(),
      supabase.from('metrics_daily').select('date, time_saved_minutes, estimated_roi, tasks_executed, tickets_total, tickets_auto').eq('client_id', client_id).order('date', { ascending: false }).limit(30),
      supabase.from('automation_events').select('event_category, created_at, revenue_amount').eq('client_id', client_id).order('created_at', { ascending: false }).limit(50),
      supabase.from('client_integrations').select('provider, status').eq('client_id', client_id).eq('status', 'active'),
    ]);

    const client = clientRes.data;
    const settings = settingsRes.data;
    const metrics = metricsRes.data || [];
    const events = eventsRes.data || [];
    const integrations = integrationsRes.data || [];

    if (!client) return res.status(404).json({ error: 'Client non trouvé' });

    // Compute summary stats
    const totalRoi = metrics.reduce((s, m) => s + (Number(m.estimated_roi) || 0), 0);
    const totalTimeSaved = Math.round(metrics.reduce((s, m) => s + (Number(m.time_saved_minutes) || 0), 0) / 60);
    const totalTasks = metrics.reduce((s, m) => s + (Number(m.tasks_executed) || 0), 0);
    const totalTickets = metrics.reduce((s, m) => s + (Number(m.tickets_total) || 0), 0);
    const totalTicketsAuto = metrics.reduce((s, m) => s + (Number(m.tickets_auto) || 0), 0);
    const autoRate = totalTickets > 0 ? Math.round((totalTicketsAuto / totalTickets) * 100) : 0;

    const eventCounts = {};
    events.forEach(e => { eventCounts[e.event_category] = (eventCounts[e.event_category] || 0) + 1; });

    const context = `
DONNÉES DU CLIENT "${client.brand_name}":
- Plan: ${client.plan || 'free'}
- Statut: ${client.status}
- Membre depuis: ${new Date(client.created_at).toLocaleDateString('fr-FR')}
- Intégrations actives: ${integrations.map(i => i.provider).join(', ') || 'Aucune'}
${settings ? `- Coût horaire: ${settings.hourly_cost || 25}€/h` : ''}

MÉTRIQUES (30 derniers jours):
- ROI généré: ${totalRoi}€
- Temps économisé: ${totalTimeSaved}h
- Actions IA: ${totalTasks}
- Tickets traités: ${totalTickets} (${autoRate}% automatisés)

ÉVÉNEMENTS RÉCENTS:
${Object.entries(eventCounts).map(([cat, count]) => `- ${cat}: ${count}`).join('\n') || 'Aucun événement'}

QUESTION DU CLIENT: ${message}`;

    const reply = await askClaude(SYSTEM_PROMPT, context, history)
    return res.status(200).json({ reply });
  } catch (error) {
    console.error('Client Copilot error:', error);
    return res.status(500).json({ error: error.message });
  }
}

export default withSentry(handler)
