/**
 * Actero Engine V2 — Event Gateway
 *
 * Point d'entrée unique du moteur. Reçoit tous les événements,
 * les normalise, les stocke, et lance le pipeline Brain → Executor.
 *
 * POST /api/engine/gateway
 */
export const maxDuration = 60

import { raiseEscalation, reviewMeriteAlerte } from './lib/raise-escalation.js'
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { normalizeEvent } from './lib/normalizer.js'
import { loadPlaybook } from './lib/playbook-loader.js'
import { runBrain } from './brain.js'
import { runExecutor } from './executor.js'
import { logRun } from './logger.js'
import { checkRateLimit } from './lib/rate-limiter.js'
import { checkTicketQuota } from '../lib/plan-limits.js'
import { maybeAlertQuota } from '../lib/quota-alerts.js'

const ENGINE_SECRET = process.env.ENGINE_WEBHOOK_SECRET
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // --- Auth ---
  const secret = req.headers['x-engine-secret'] || req.headers['x-internal-secret']
  let isAuthed = (ENGINE_SECRET && secret === ENGINE_SECRET) || (INTERNAL_SECRET && secret === INTERNAL_SECRET)

  // Also accept Bearer JWT (for dashboard testing)
  // `authedUserId` retient QUI a été authentifié : la suite doit vérifier que
  // cette personne a le droit d'agir sur le client_id qu'elle demande.
  let authedUserId = null
  if (!isAuthed) {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (token) {
      const { data, error } = await supabase.auth.getUser(token)
      if (!error && data?.user) {
        isAuthed = true
        authedUserId = data.user.id
      }
    }
  }

  if (!isAuthed) {
    return res.status(401).json({ error: 'Non autorise.' })
  }

  const { client_id, event_type, source, is_test, ...payload } = req.body || {}
  if (!client_id) return res.status(400).json({ error: 'client_id requis' })

  // Le `client_id` vient du corps de la requête et sert ensuite à tout : charger
  // le playbook, consommer le quota, et surtout interroger la boutique Shopify
  // du client via l'agent commande. Authentifier l'appelant ne suffisait donc
  // pas — sans ce contrôle, n'importe quel compte Actero connaissant l'UUID
  // d'un autre marchand pouvait faire tourner le moteur sur SA boutique et
  // recevoir ses vraies commandes en réponse.
  //
  // Les appels internes (crons, webhooks) passent par le secret partagé et
  // n'ont pas d'utilisateur : ils gardent l'accès complet.
  if (authedUserId) {
    const [{ data: lien }, { data: possede }] = await Promise.all([
      supabase.from('client_users').select('client_id').eq('user_id', authedUserId).eq('client_id', client_id).maybeSingle(),
      supabase.from('clients').select('id').eq('id', client_id).eq('owner_user_id', authedUserId).maybeSingle(),
    ])
    if (!lien && !possede) {
      return res.status(403).json({ error: 'Ce client ne vous appartient pas.' })
    }
  }

  const eventType = event_type || source || 'api_direct'
  const eventSource = source || 'api_direct'
  const isTest = is_test === true

  // --- Rate limit ---
  const rateCheck = await checkRateLimit(supabase, { clientId: client_id, customerEmail: payload.customer_email })
  if (!rateCheck.allowed) return res.status(429).json({ error: rateCheck.reason })

  // --- Verify client ---
  const { data: client } = await supabase.from('clients').select('id, brand_name, client_type, plan, trial_ends_at').eq('id', client_id).single()
  if (!client) return res.status(404).json({ error: 'Client non trouve' })

  // --- Plan limits enforcement (hard cap — no overage on any plan; a purchased
  //     credit is the only way to keep serving past the monthly limit). ---
  const plan = client.plan || 'free'
  const inTrial = client.trial_ends_at && new Date(client.trial_ends_at) > new Date()

  const quota = await checkTicketQuota(supabase, { clientId: client_id, plan, inTrial })
  const useCreditPack = quota.useCredits
  if (!quota.allowed) {
    // Tell the merchant their agent is paused (idempotent, fail-soft).
    await maybeAlertQuota(supabase, { clientId: client_id, plan, inTrial })
    return res.status(429).json({
      error: 'Quota de tickets épuisé. Achetez des crédits ou passez à un plan supérieur.',
      tickets_used: quota.ticketsUsed,
      tickets_limit: quota.limit,
      credits_balance: quota.creditsBalance,
      upgrade_url: `${process.env.PUBLIC_API_URL || 'https://actero.fr'}/pricing`,
      credits_url: `${process.env.PUBLIC_API_URL || 'https://actero.fr'}/client/billing`,
    })
  }
  if (useCreditPack) {
    console.log(`[gateway] Client ${client_id} over limit — serving via credit pack`)
  }

  const startTime = Date.now()

  try {
    // --- 1. Normalize ---
    const normalized = normalizeEvent(eventType, payload)

    // --- 2. Find playbook ---
    const playbook = await loadPlaybook(supabase, client_id, eventType)
    if (!playbook) {
      return res.status(200).json({
        status: 'no_playbook',
        message: `Aucun playbook actif pour le type "${eventType}". Activez un playbook dans votre dashboard.`,
      })
    }

    // --- Test mode: run Brain only, skip all persistence (events, runs, metrics, memory) ---
    if (isTest) {
      const brainResult = await runBrain(supabase, {
        event: { id: 'test', source: eventSource },
        playbook,
        clientId: client_id,
        normalized: { ...normalized, _is_test: true },
      })
      // On renvoie la DÉCISION, pas seulement la réponse : sans la raison de
      // l'escalade ni l'agent retenu, un banc de test ne peut rien diagnostiquer
      // (ACT-8).
      return res.status(200).json({
        event_id: 'test',
        run_id: 'test',
        status: brainResult.needsReview ? 'needs_review' : 'completed',
        classification: brainResult.classification,
        confidence: brainResult.confidence,
        response: brainResult.aiResponse,
        needs_review: brainResult.needsReview === true,
        review_reason: brainResult.reviewReason || null,
        agent_used: brainResult.agentUsed || null,
        action_plan: brainResult.actionPlan || [],
        tools_used: brainResult.toolsUsed || [],
        steps_executed: 0,
        duration_ms: Date.now() - startTime,
        is_test: true,
      })
    }

    // --- 3. Store event ---
    const { data: event, error: eventError } = await supabase
      .from('engine_events')
      .insert({
        client_id,
        event_type: eventType,
        source: eventSource,
        payload,
        normalized,
        playbook_id: playbook.id,
        status: 'processing',
      })
      .select()
      .single()

    if (eventError) throw new Error(`Event insert failed: ${eventError.message}`)

    // --- 4. Run Brain ---
    const brainResult = await runBrain(supabase, {
      event,
      playbook,
      clientId: client_id,
      normalized,
    })

    // --- 5. Execute or Review ---
    let runResult
    if (brainResult.needsReview) {
      // Manual Review
      runResult = await logRun(supabase, {
        clientId: client_id,
        eventId: event.id,
        playbookId: playbook.id,
        status: 'needs_review',
        classification: brainResult.classification,
        confidence: brainResult.confidence,
        actionPlan: brainResult.actionPlan,
        steps: [],
        durationMs: Date.now() - startTime,
        normalized,
        aiResponse: brainResult.aiResponse,
        agentUsed: brainResult.agentUsed || null,
        tokensIn: brainResult.usage?.tokensIn,
        tokensOut: brainResult.usage?.tokensOut,
        costUsd: brainResult.usage?.costUsd,
        modelId: brainResult.usage?.modelId,
        errorMessage: brainResult.errorMessage || null,
      })

      // Create review entry
      await supabase.from('engine_reviews_v2').insert({
        run_id: runResult.id,
        client_id,
        event_id: event.id,
        proposed_action: { classification: brainResult.classification, action_plan: brainResult.actionPlan, ai_response: brainResult.aiResponse },
        reason: brainResult.reviewReason,
        status: 'pending',
      })

      // Update event status
      await supabase.from('engine_events').update({ status: 'needs_review', processed_at: new Date().toISOString() }).eq('id', event.id)

      // Une mise en revue n'exécute PAS le plan d'action — donc l'étape
      // `escalate` ne tournait jamais dans cette branche. Un client agressif,
      // une réponse tronquée ou une référence inventée finissaient dans
      // `engine_reviews_v2`, table que rien ne surveille et qui ne notifie
      // personne : plus le message était grave, moins le marchand en était
      // averti. On déclenche donc ici les mêmes effets que l'exécuteur, mais
      // seulement pour les vrais signaux — un classifieur qui hésite reste un
      // cas de relecture, pas une alarme (voir lib/raise-escalation.js).
      if (reviewMeriteAlerte({ reviewReason: brainResult.reviewReason, actionPlan: brainResult.actionPlan })) {
        await raiseEscalation(supabase, {
          clientId: client_id,
          classification: brainResult.classification,
          normalized,
          reason: brainResult.reviewReason,
        })
      }

    } else {
      // Execute action plan
      const executorResult = await runExecutor(supabase, {
        event,
        playbook,
        clientId: client_id,
        normalized,
        brainResult,
      })

      // Log the run
      runResult = await logRun(supabase, {
        clientId: client_id,
        eventId: event.id,
        playbookId: playbook.id,
        status: executorResult.success ? 'completed' : 'failed',
        classification: brainResult.classification,
        confidence: brainResult.confidence,
        actionPlan: brainResult.actionPlan,
        steps: executorResult.steps,
        durationMs: Date.now() - startTime,
        error: executorResult.error,
        normalized,
        aiResponse: brainResult.aiResponse,
        agentUsed: brainResult.agentUsed || null,
        tokensIn: brainResult.usage?.tokensIn,
        tokensOut: brainResult.usage?.tokensOut,
        costUsd: brainResult.usage?.costUsd,
        modelId: brainResult.usage?.modelId,
        errorMessage: executorResult.success
          ? null
          : (typeof executorResult.error === 'string'
              ? executorResult.error
              : executorResult.error?.message || null),
      })

      // Update event status
      await supabase.from('engine_events').update({
        status: executorResult.success ? 'completed' : 'failed',
        processed_at: new Date().toISOString(),
      }).eq('id', event.id)

      // Update playbook stats
      await supabase.from('engine_client_playbooks')
        .update({ runs_count: playbook.runs_count ? playbook.runs_count + 1 : 1, last_run_at: new Date().toISOString() })
        .eq('client_id', client_id)
        .eq('playbook_id', playbook.id)
    }

    // Consume credit if we used the credit pack fallback
    if (useCreditPack) {
      try {
        await supabase.rpc('consume_credits', {
          p_client_id: client_id,
          p_amount: 1,
          p_description: `Ticket (quota dépassé) — ${brainResult?.classification || 'N/A'}`,
          p_event_id: event?.id,
        })
      } catch (err) {
        console.error('[gateway] consume_credits error:', err.message)
      }
    }

    return res.status(200).json({
      event_id: event.id,
      run_id: runResult?.id,
      status: brainResult.needsReview ? 'needs_review' : 'completed',
      classification: brainResult.classification,
      confidence: brainResult.confidence,
      response: brainResult.aiResponse,
      steps_executed: brainResult.needsReview ? 0 : (brainResult.actionPlan || []).length,
      duration_ms: Date.now() - startTime,
    })

  } catch (err) {
    console.error('[engine/gateway] Error:', err)
    return res.status(500).json({ error: err.message })
  }
}

export default withSentry(handler)
