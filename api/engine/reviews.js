/**
 * Actero Engine V2 — Manual Review API
 *
 * GET: List pending reviews
 * POST: Approve/reject/modify a review
 */
import { withSentry } from '../lib/sentry.js'
import { createClient } from '@supabase/supabase-js'
import { runExecutor } from './executor.js'
import { logRun } from './logger.js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function handler(req, res) {
  // Auth
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorise' })
  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorise' })

  if (req.method === 'GET') {
    // List pending reviews
    const clientId = req.query?.client_id
    let query = supabase
      .from('engine_reviews_v2')
      .select('*, engine_events(*), engine_runs_v2(*)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50)

    if (clientId) query = query.eq('client_id', clientId)

    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ reviews: data || [] })
  }

  if (req.method === 'POST') {
    const { review_id, action, modified_response, feedback_note } = req.body
    if (!review_id || !action) return res.status(400).json({ error: 'review_id et action requis' })
    if (!['approved', 'rejected', 'modified'].includes(action)) {
      return res.status(400).json({ error: 'action: approved, rejected, ou modified' })
    }

    // Get the review
    const { data: review } = await supabase
      .from('engine_reviews_v2')
      .select('*, engine_events(*)')
      .eq('id', review_id)
      .single()

    if (!review) return res.status(404).json({ error: 'Review non trouvee' })

    // Update review status
    await supabase.from('engine_reviews_v2').update({
      status: action,
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
      feedback_note: feedback_note || null,
    }).eq('id', review_id)

    // If approved or modified — execute the action plan
    if (action === 'approved' || action === 'modified') {
      const event = review.engine_events
      const proposed = review.proposed_action || {}
      const aiResponse = action === 'modified' ? modified_response : proposed.ai_response

      if (event && aiResponse) {
        // Execute with the approved/modified response
        const executorResult = await runExecutor(supabase, {
          event,
          playbook: { decision_rules: {} },
          clientId: review.client_id,
          normalized: event.normalized || {},
          brainResult: {
            classification: proposed.classification || 'manual_review',
            confidence: 1.0,
            actionPlan: proposed.action_plan || ['send_reply'],
            aiResponse,
          },
        })

        // Log the run as completed
        await logRun(supabase, {
          clientId: review.client_id,
          eventId: event.id,
          playbookId: null,
          status: 'completed',
          classification: proposed.classification || 'manual_review',
          confidence: 1.0,
          actionPlan: proposed.action_plan || ['send_reply'],
          steps: executorResult.steps,
          durationMs: 0,
        })

        // Update event status
        await supabase.from('engine_events').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('id', event.id)
      }
    } else if (action === 'rejected') {
      // Mark event as completed (rejected = no action taken)
      if (review.event_id) {
        await supabase.from('engine_events').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('id', review.event_id)
      }
    }

    return res.status(200).json({ success: true, action, review_id })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

export default withSentry(handler)
