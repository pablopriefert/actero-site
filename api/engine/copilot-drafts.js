/**
 * Actero Engine — Copilot Drafts API (AI Copilot for Human Agents)
 *
 * POST /api/engine/copilot-drafts
 *   body: { conversation_id: string }
 *
 * Feature inspirée de "Fin AI Copilot" d'Intercom. Quand un ticket escalade
 * vers un humain, cet endpoint génère :
 *   - un résumé de contexte client (commande, historique, sentiment)
 *   - 3 brouillons de réponse dans 3 tons distincts (empathique, factuel,
 *     résolutif) — l'agent humain copie celui qui matche son style
 *   - une liste d'actions suggérées (rembourser, créer bon d'achat, etc.)
 *
 * Implémentation :
 *   - Claude Opus 4.7 via SDK officiel @anthropic-ai/sdk (installé v0.88+)
 *   - `thinking: { type: "adaptive" }` — Claude choisit sa profondeur
 *   - Structured outputs (output_config) pour garantir du JSON parseable
 *   - Prompt caching : system prompt + brand context mis en cache
 *
 * Auth : JWT Supabase ; scope strict au client_id du caller.
 */
import { withSentry } from '../lib/sentry.js'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const COPILOT_SYSTEM_PROMPT = `Tu es un copilote IA qui assiste les agents SAV humains d'e-commerçants Shopify français.

Quand un ticket client escalade depuis l'agent IA vers un humain, tu produis :
1. Un résumé de contexte concis (2-3 phrases) : qui est le client, que demande-t-il, pourquoi l'IA a escaladé.
2. Trois brouillons de réponse dans trois tons distincts — l'agent humain pourra copier celui qui matche son style.
3. Une liste d'actions métier suggérées que l'agent peut déclencher en un clic.

Règles impératives :
- Réponds en français, toujours.
- Respecte scrupuleusement le ton de marque fourni (tutoiement/vouvoiement, warm/formel, niveau de détail).
- Si une politique de retour est fournie, propose des brouillons compatibles avec elle.
- Pour chaque brouillon, le ton doit être clairement différencié :
  * "empathique" : reconnaît d'abord la frustration/situation client, puis propose une solution.
  * "factuel" : droit au but, informatif, sans enrobage émotionnel.
  * "résolutif" : propose directement une action concrète (remboursement, bon d'achat, renvoi).
- Les actions suggérées doivent être concrètes et spécifiques au contexte Shopify e-commerce : créer un bon d'achat, lancer un retour, rembourser partiellement, relancer la livraison, escalader au manager.
- Chaque brouillon doit être complet, signable, prêt à envoyer — pas un template à trous.
- Si l'information manque (ex: numéro de commande invalide), mentionne-le dans un des brouillons et demande poliment au client de confirmer.`

const DRAFTS_SCHEMA = {
  type: 'object',
  properties: {
    context_summary: {
      type: 'string',
      description: 'Résumé du contexte client en 2-3 phrases.',
    },
    drafts: {
      type: 'array',
      description: 'Trois brouillons de réponse, un par ton.',
      items: {
        type: 'object',
        properties: {
          tone: { type: 'string', enum: ['empathique', 'factuel', 'résolutif'] },
          title: {
            type: 'string',
            description: 'Titre court (3-5 mots) décrivant l\'approche du brouillon.',
          },
          body: {
            type: 'string',
            description: 'Corps de la réponse complet, prêt à envoyer.',
          },
        },
        required: ['tone', 'title', 'body'],
        additionalProperties: false,
      },
    },
    suggested_actions: {
      type: 'array',
      description: 'Actions métier concrètes suggérées (0 à 4).',
      items: {
        type: 'object',
        properties: {
          action_type: {
            type: 'string',
            enum: ['refund', 'partial_refund', 'store_credit', 'resend_shipment', 'create_return', 'escalate_manager', 'update_address', 'other'],
          },
          label: {
            type: 'string',
            description: 'Label court pour le bouton (ex: "Créer un bon d\'achat de 20€").',
          },
          description: {
            type: 'string',
            description: 'Justification courte de pourquoi cette action est pertinente.',
          },
        },
        required: ['action_type', 'label', 'description'],
        additionalProperties: false,
      },
    },
  },
  required: ['context_summary', 'drafts', 'suggested_actions'],
  additionalProperties: false,
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Auth
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })
  const { data: authData, error: authError } = await supabase.auth.getUser(token)
  if (authError || !authData?.user) return res.status(401).json({ error: 'Non autorisé' })
  const user = authData.user

  const { conversation_id } = req.body || {}
  if (!conversation_id) return res.status(400).json({ error: 'conversation_id requis' })

  try {
    // Scope to the caller's client
    const { data: client, error: clientErr } = await supabase
      .from('clients')
      .select('id, brand_name')
      .eq('user_id', user.id)
      .maybeSingle()
    if (clientErr || !client) return res.status(403).json({ error: 'Client introuvable' })

    // Fetch conversation
    const { data: convo, error: convoErr } = await supabase
      .from('ai_conversations')
      .select(`
        id, customer_email, customer_name, customer_message, ai_response,
        subject, ticket_type, order_id, escalation_reason, confidence_score,
        created_at
      `)
      .eq('id', conversation_id)
      .eq('client_id', client.id)
      .maybeSingle()
    if (convoErr || !convo) return res.status(404).json({ error: 'Conversation introuvable' })

    // Fetch brand settings (tone of voice + return policy)
    const { data: settings } = await supabase
      .from('client_settings')
      .select('brand_tone, brand_identity, tone_style, tone_formality, tone_warmth, tone_detail, return_policy, custom_instructions')
      .eq('client_id', client.id)
      .maybeSingle()

    // Build brand context block — cacheable prefix
    const brandContext = buildBrandContext(client.brand_name, settings)

    // Build the per-request payload
    const ticketContext = buildTicketContext(convo)

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 3000,
      thinking: { type: 'adaptive' },
      system: [
        {
          type: 'text',
          text: COPILOT_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
        {
          type: 'text',
          text: brandContext,
          cache_control: { type: 'ephemeral' },
        },
      ],
      output_config: {
        format: {
          type: 'json_schema',
          schema: DRAFTS_SCHEMA,
        },
      },
      messages: [
        {
          role: 'user',
          content: ticketContext,
        },
      ],
    })

    // output_config guarantees first text block is valid JSON
    const textBlock = message.content.find((b) => b.type === 'text')
    if (!textBlock) {
      return res.status(500).json({ error: 'Réponse Claude vide' })
    }

    const parsed = JSON.parse(textBlock.text)

    return res.status(200).json({
      ...parsed,
      _meta: {
        model: message.model,
        usage: {
          input_tokens: message.usage?.input_tokens,
          output_tokens: message.usage?.output_tokens,
          cache_read_input_tokens: message.usage?.cache_read_input_tokens,
          cache_creation_input_tokens: message.usage?.cache_creation_input_tokens,
        },
        stop_reason: message.stop_reason,
      },
    })
  } catch (err) {
    console.error('[copilot-drafts] exception:', err)
    // Surface Anthropic-typed errors gracefully
    if (err instanceof Anthropic.APIError) {
      return res.status(err.status || 500).json({
        error: err.message,
        type: err.name,
      })
    }
    return res.status(500).json({ error: err.message })
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function buildBrandContext(brandName, settings) {
  const parts = [`MARQUE : ${brandName || 'votre boutique'}`]

  if (settings?.brand_identity) {
    parts.push(`\nIDENTITÉ :\n${settings.brand_identity.trim()}`)
  }

  const toneLines = []
  if (settings?.tone_formality != null) {
    const v = settings.tone_formality
    toneLines.push(
      v <= 33
        ? '- Registre formel, vouvoiement systématique.'
        : v >= 67
          ? '- Registre casual et amical, tutoiement possible.'
          : '- Registre équilibré, vouvoiement par défaut mais accessible.',
    )
  }
  if (settings?.tone_warmth != null) {
    const v = settings.tone_warmth
    toneLines.push(
      v >= 67
        ? '- Ton chaleureux, empathique, rassurant.'
        : v <= 33
          ? '- Ton neutre et professionnel, factuel.'
          : '- Ton cordial sans excès.',
    )
  }
  if (settings?.tone_detail != null) {
    const v = settings.tone_detail
    toneLines.push(
      v >= 67
        ? '- Réponses détaillées avec contexte et explications.'
        : v <= 33
          ? '- Réponses concises, droit au but.'
          : '- Réponses de longueur moyenne.',
    )
  }
  if (toneLines.length) {
    parts.push(`\nTON DE COMMUNICATION :\n${toneLines.join('\n')}`)
  }

  if (settings?.tone_style?.trim()) {
    parts.push(`\nSTYLE PARTICULIER :\n${settings.tone_style.trim()}`)
  }

  if (settings?.return_policy?.trim()) {
    parts.push(`\nPOLITIQUE DE RETOUR :\n${settings.return_policy.trim()}`)
  }

  if (settings?.custom_instructions?.trim()) {
    parts.push(`\nINSTRUCTIONS PARTICULIÈRES :\n${settings.custom_instructions.trim()}`)
  }

  return parts.join('\n')
}

function buildTicketContext(convo) {
  const escalationLabels = {
    low_confidence: 'Confiance agent < 60%',
    aggressive: 'Ton agressif détecté',
    out_of_policy: 'Hors politique configurée',
    error: 'Erreur technique',
  }
  const escLabel = escalationLabels[convo.escalation_reason] || convo.escalation_reason || 'escalade manuelle'

  const lines = [
    'TICKET À TRAITER :',
    '',
    `Client : ${convo.customer_name || '(nom inconnu)'} · ${convo.customer_email || '(pas d\'email)'}`,
    convo.order_id ? `Commande : ${convo.order_id}` : '',
    convo.ticket_type ? `Type : ${convo.ticket_type}` : '',
    convo.subject ? `Sujet : ${convo.subject}` : '',
    `Raison escalade : ${escLabel}${convo.confidence_score != null ? ` (confiance ${Math.round(convo.confidence_score * 100)}%)` : ''}`,
    '',
    '--- MESSAGE CLIENT ---',
    convo.customer_message || '(message vide)',
    '',
    '--- RÉPONSE TENTÉE PAR L\'AGENT IA ---',
    convo.ai_response || '(pas de réponse générée)',
    '',
    'Génère maintenant : un résumé contextuel, 3 brouillons (empathique / factuel / résolutif) et 0 à 4 actions suggérées.',
  ]

  return lines.filter(Boolean).join('\n')
}

export default withSentry(handler)
