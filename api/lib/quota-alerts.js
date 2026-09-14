/**
 * Monthly ticket-quota alerts (80% warning + 100% blocked).
 *
 * Why this exists: tickets are hard-capped (see checkTicketQuota in
 * plan-limits.js). When the cap is hit the agent silently stops answering the
 * merchant's customers — so the merchant MUST be told, otherwise they lose
 * sales without knowing. The pricing page also promises an alert at 80% and
 * 100%, so this is the implementation of that promise.
 *
 * Delivery: notifyClient() for the channels the merchant opted into, PLUS a
 * guaranteed email to clients.contact_email (a merchant who never configured
 * notification preferences must still learn their agent is paused).
 *
 * Idempotency: usage_counters.alerted_80_at / alerted_100_at are claimed with a
 * conditional UPDATE ... WHERE col IS NULL, so exactly one alert per threshold
 * per month is sent even when several tickets are processed concurrently.
 *
 * Never throws — alerting must not break ticket processing.
 */
import { notifyClient, sendClientEmail } from './notify.js'
import { getLimits } from './plan-limits.js'

const SITE_URL = process.env.PUBLIC_API_URL || 'https://actero.fr'
const BILLING_URL = `${SITE_URL}/client/billing`

function currentPeriod() {
  return new Date().toISOString().slice(0, 7) // 'YYYY-MM'
}

/**
 * Atomically claim a threshold alert for this (client, period).
 * @returns {Promise<boolean>} true if THIS caller won the claim and must send.
 */
async function claimAlert(supabase, clientId, period, column) {
  const { data, error } = await supabase
    .from('usage_counters')
    .update({ [column]: new Date().toISOString() })
    .eq('client_id', clientId)
    .eq('period', period)
    .is(column, null)
    .select('id')
  if (error) {
    console.warn(`[quota-alerts] claim ${column} failed:`, error.message)
    return false
  }
  return Array.isArray(data) && data.length > 0
}

async function deliver(supabase, clientId, { eventKey, title, message }) {
  // Opt-in channels (Slack / email as configured by the merchant).
  try {
    await notifyClient(supabase, {
      clientId,
      eventKey,
      title,
      message,
      context: { url: BILLING_URL },
    })
  } catch (err) {
    console.warn('[quota-alerts] notifyClient failed:', err.message)
  }

  // Guaranteed email — a quota block is too costly to depend on opt-in prefs.
  try {
    await sendClientEmail(supabase, clientId, {
      title,
      message,
      context: { url: BILLING_URL },
    })
  } catch (err) {
    console.warn('[quota-alerts] direct email failed:', err.message)
  }

  // Audit trail.
  try {
    await supabase.from('client_notifications_log').insert({
      client_id: clientId,
      notification_type: eventKey,
      channel: 'email',
      subject: title,
      body: message,
      metadata: { source: 'quota-alerts' },
    })
  } catch { /* audit only — ignore */ }
}

/**
 * Check the client's usage and fire the 80% / 100% alert when a threshold is
 * newly crossed. Safe to call on every processed ticket.
 *
 * @param {object} supabase service-role client
 * @param {{ clientId: string, plan: string, inTrial?: boolean }} opts
 * @returns {Promise<{ alerted: null|'80'|'100' }>}
 */
export async function maybeAlertQuota(supabase, { clientId, plan, inTrial }) {
  try {
    if (!clientId) return { alerted: null }

    // Resolve plan / trial state when the caller doesn't already have it, so
    // this can be dropped in anywhere with just a clientId.
    let resolvedPlan = plan
    let resolvedTrial = inTrial
    if (resolvedPlan === undefined || resolvedTrial === undefined) {
      const { data: client } = await supabase
        .from('clients')
        .select('plan, trial_ends_at')
        .eq('id', clientId)
        .maybeSingle()
      if (!client) return { alerted: null }
      resolvedPlan = resolvedPlan ?? client.plan
      resolvedTrial = resolvedTrial ?? !!(client.trial_ends_at && new Date(client.trial_ends_at) > new Date())
    }
    plan = resolvedPlan
    inTrial = !!resolvedTrial

    const limits = getLimits(plan)
    // Trials and unlimited plans can't hit a cap.
    if (inTrial || limits.tickets === Infinity) return { alerted: null }

    const period = currentPeriod()
    const { data: usage } = await supabase
      .from('usage_counters')
      .select('tickets_used, alerted_80_at, alerted_100_at')
      .eq('client_id', clientId)
      .eq('period', period)
      .maybeSingle()
    if (!usage) return { alerted: null }

    const used = usage.tickets_used || 0
    const limit = limits.tickets
    if (!limit || limit <= 0) return { alerted: null }

    // 100% — the agent is now paused.
    if (used >= limit && !usage.alerted_100_at) {
      if (await claimAlert(supabase, clientId, period, 'alerted_100_at')) {
        await deliver(supabase, clientId, {
          eventKey: 'usage.quota_reached',
          title: 'Quota atteint — votre agent est en pause',
          message:
            `Vous avez utilisé ${used} tickets sur ${limit} ce mois-ci. Votre agent ne répond ` +
            `plus à vos clients. Pour le réactiver immédiatement : achetez un pack de crédits ` +
            `ou passez au plan supérieur depuis votre facturation.`,
        })
        return { alerted: '100' }
      }
      return { alerted: null }
    }

    // 80% — heads-up before the cap.
    if (used >= Math.floor(limit * 0.8) && used < limit && !usage.alerted_80_at) {
      if (await claimAlert(supabase, clientId, period, 'alerted_80_at')) {
        await deliver(supabase, clientId, {
          eventKey: 'usage.threshold_reached',
          title: '80 % de votre quota mensuel atteint',
          message:
            `Vous avez utilisé ${used} tickets sur ${limit} ce mois-ci. À 100 %, votre agent se ` +
            `mettra en pause. Anticipez avec un pack de crédits ou un upgrade.`,
        })
        return { alerted: '80' }
      }
    }

    return { alerted: null }
  } catch (err) {
    console.warn('[quota-alerts] maybeAlertQuota failed:', err.message)
    return { alerted: null }
  }
}
