/**
 * Vercel Cron — Agent Healthcheck
 *
 * Schedule : every 5 minutes
 *
 * Actero's whole value is "the agent answers". On 2026-07-02 a retired Claude
 * model took the agent 100% down and nobody was alerted — the brain swallows
 * the Claude error internally and returns an escalation fallback, so nothing
 * ever threw up to a monitored boundary. This job is that missing safety net.
 *
 * It checks the two systemic failure modes directly and cheaply:
 *   1. Claude reachable with the CONFIGURED model (catches model deprecation,
 *      a bad/expired API key, 402 credit exhaustion, 429 — exactly the 404
 *      from that outage).
 *   2. Supabase reachable (the other hard dependency of every ticket).
 *
 * On failure it captures to Sentry, best-effort pings an ops webhook, then
 * THROWS so withCronMonitor records an error check-in → Sentry cron alert.
 *
 * Auth : Vercel Cron header OR Authorization: Bearer <CRON_SECRET>
 */
import { createClient } from '@supabase/supabase-js'
import { withCronMonitor } from '../lib/cron-monitor.js'
import { captureError } from '../lib/sentry.js'
import { clientsEnSilence, alerteDejaEnvoyee } from '../lib/engine-silence.js'

// 24 h : au-delà, un client avec un playbook actif qui ne produit rien n'est
// plus « calme », il est en panne.
const SEUIL_SILENCE_HEURES = Number(process.env.ENGINE_SILENCE_HOURS) || 24

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

// Mirror the engine's provider + model resolution so we test what production
// actually uses (see llm-client.js / claude-client.js / openai-client.js).
const LLM_PROVIDER = (process.env.LLM_PROVIDER || 'openrouter').toLowerCase()
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-5'
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.4-mini'
// OpenRouter ids are namespaced (`vendor/model`) — mirror openai-client.js.
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-5'
const ACTIVE_MODEL = LLM_PROVIDER === 'openai' ? OPENAI_MODEL
  : LLM_PROVIDER === 'openrouter' ? OPENROUTER_MODEL
  : CLAUDE_MODEL

async function checkClaude() {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { ok: false, detail: 'ANTHROPIC_API_KEY unset' }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 4, messages: [{ role: 'user', content: 'ping' }] }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, detail: `Claude API ${res.status} (model ${CLAUDE_MODEL}): ${body.slice(0, 200)}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, detail: `Claude fetch failed (model ${CLAUDE_MODEL}): ${err.message}` }
  } finally {
    clearTimeout(timeout)
  }
}

// OpenAI: hit the free /v1/models endpoint and confirm the configured model is
// present. Catches the key-invalid / model-retired / wrong-id failure class
// (exactly the outage this job exists for) without paying for a chat call
// every 5 minutes — GPT-5.5 completions are not cheap.
async function checkOpenAI() {
  const key = process.env.OPENAI_API_KEY
  if (!key) return { ok: false, detail: 'OPENAI_API_KEY unset' }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, detail: `OpenAI API ${res.status}: ${body.slice(0, 200)}` }
    }
    const data = await res.json().catch(() => null)
    const ids = (data?.data || []).map((m) => m.id)
    if (!ids.includes(OPENAI_MODEL)) {
      return { ok: false, detail: `OpenAI model "${OPENAI_MODEL}" not available on this account` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, detail: `OpenAI fetch failed (model ${OPENAI_MODEL}): ${err.message}` }
  } finally {
    clearTimeout(timeout)
  }
}

// OpenRouter: same probe as OpenAI — list the served models and confirm the
// configured namespaced id is there. Catches key-invalid / model-retired /
// wrong-namespace, which is the whole point of this job, and the endpoint is
// free so the 5-minute cadence costs nothing.
async function checkOpenRouter() {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) return { ok: false, detail: 'OPENROUTER_API_KEY unset' }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      return { ok: false, detail: `OpenRouter API ${res.status}: ${body.slice(0, 200)}` }
    }
    const data = await res.json().catch(() => null)
    const ids = (data?.data || []).map((m) => m.id)
    if (!ids.includes(OPENROUTER_MODEL)) {
      return { ok: false, detail: `OpenRouter model "${OPENROUTER_MODEL}" not served` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, detail: `OpenRouter fetch failed (model ${OPENROUTER_MODEL}): ${err.message}` }
  } finally {
    clearTimeout(timeout)
  }
}

const checkLLM = () => (
  LLM_PROVIDER === 'openai' ? checkOpenAI()
    : LLM_PROVIDER === 'openrouter' ? checkOpenRouter()
      : checkClaude()
)

async function checkDb() {
  const { error } = await supabase.from('clients').select('id', { count: 'exact', head: true }).limit(1)
  return error ? { ok: false, detail: `Supabase: ${error.message}` } : { ok: true }
}

/* -------------------------------------------------------------------------- */
/*  Le moteur ne tourne plus (ACT-21)                                         */
/* -------------------------------------------------------------------------- */

/**
 * Détecte les clients dont le moteur s'est ARRÊTÉ, et alerte une fois par
 * incident.
 *
 * Le fait qui justifie ce contrôle : aucun message traité du 11 juillet au
 * 8 septembre 2026, et personne ne s'en est aperçu. Les deux contrôles
 * ci-dessus n'auraient rien vu — le LLM répondait, Supabase répondait. Le
 * système était debout et inutile, ce qui n'est pas la même chose.
 *
 * Ne LÈVE PAS d'exception, contrairement aux pannes LLM/DB. Un client
 * silencieux n'est pas une panne d'infrastructure : faire échouer le check-in
 * du cron mettrait Sentry au rouge en permanence, et on retomberait dans le
 * problème qu'on essaie de résoudre — une alerte qui sonne toujours.
 */
async function checkSilence() {
  // Le cron tourne aux 5 minutes ; ce signal est à l'échelle de la journée.
  // On ne l'évalue qu'une fois par heure pour ne pas ajouter 8 600 requêtes
  // mensuelles à un budget déjà pointé par ACT-23.
  if (new Date().getUTCMinutes() >= 5) return { evalue: false }

  const { data: playbooks } = await supabase
    .from('engine_client_playbooks')
    .select('client_id')
    .eq('is_active', true)

  const ids = [...new Set((playbooks || []).map((p) => p.client_id).filter(Boolean))]
  if (ids.length === 0) return { evalue: true, silencieux: [] }

  const { data: clients } = await supabase
    .from('clients')
    .select('id, brand_name')
    .in('id', ids)

  // Une requête par client. Acceptable à cette échelle ; au-delà de quelques
  // dizaines de clients, il faudra une fonction SQL qui agrège côté base.
  const lignes = await Promise.all((clients || []).map(async (c) => {
    const { data } = await supabase
      .from('engine_events')
      .select('received_at')
      .eq('client_id', c.id)
      .order('received_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return {
      clientId: c.id,
      brandName: c.brand_name,
      playbookActif: true,
      dernierEvenement: data?.received_at || null,
    }
  }))

  const silencieux = clientsEnSilence(lignes, { seuilHeures: SEUIL_SILENCE_HEURES })
  const aAlerter = []

  for (const s of silencieux) {
    const ligne = lignes.find((l) => l.clientId === s.clientId)
    const { data: derniere } = await supabase
      .from('client_notifications_log')
      .select('created_at')
      .eq('client_id', s.clientId)
      .eq('notification_type', 'engine_silence')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (alerteDejaEnvoyee({
      derniereAlerte: derniere?.created_at || null,
      dernierEvenement: ligne.dernierEvenement,
    })) continue

    aAlerter.push(s)
  }

  for (const s of aAlerter) {
    const jours = Math.floor(s.heuresDeSilence / 24)
    const duree = jours >= 1 ? `${jours} jour${jours > 1 ? 's' : ''}` : `${s.heuresDeSilence} h`
    const message = `Le moteur n'a rien traité pour « ${s.brandName} » depuis ${duree}.`
    // Email (Resend), pas le webhook ops : ce dernier pointe vers un
    // credential Slack révoqué (voir docs/runbook-incident.md, ligne
    // « Webhook ops — non vérifiée »). Un canal qu'on sait mort ne doit pas
    // porter la seule alerte de ce moniteur — Resend est le canal dont on est
    // sûr qu'il est vivant : c'est celui que les clients reçoivent tous les
    // jours (welcome email, rapports mensuels, etc.).
    await sendSilenceAlertEmail(s, message)
    captureError(new Error(`engine_silence: ${message}`), {
      stage: 'engine_silence',
      client_id: s.clientId,
      heures_de_silence: s.heuresDeSilence,
    })
    try {
      await supabase.from('client_notifications_log').insert({
        client_id: s.clientId,
        notification_type: 'engine_silence',
        channel: 'ops',
        subject: 'Moteur silencieux',
        body: message,
        metadata: { heures_de_silence: s.heuresDeSilence, source: 'agent-healthcheck' },
      })
    } catch { /* journal seul — ne doit pas empêcher l'alerte */ }
  }

  return { evalue: true, silencieux, alertes: aAlerter.length }
}

// Alerte « moteur silencieux » par email, via Resend.
//
// Pourquoi Resend et pas sendOpsAlert() (Slack/Telegram) : le credential
// Slack de l'espace a été révoqué et les workflows d'alerte qui en
// dépendaient sont morts sans que personne ne s'en aperçoive — c'est
// exactement le trou qu'ACT-21 cherche à combler. Reconstruire la même
// alerte sur la même dépendance morte n'aurait rien réglé. Resend est déjà le
// canal email de production (welcome email, rapports mensuels, factures) :
// s'il casse, on le voit ailleurs avant de le voir ici.
//
// OPS_ALERT_EMAIL est volontairement une variable dédiée (pas
// RESEND_FROM_EMAIL, qui est l'expéditeur côté client) : le destinataire ici
// est l'équipe Actero, pas un marchand. Best-effort : ne lève jamais, pour ne
// pas casser le check-in du cron (Sentry, via captureError juste après,
// reste le chemin garanti).
// Le nom de marque vient de la base, donc du marchand : l'interpoler dans du
// HTML sans échapper laisserait passer du balisage dans nos propres alertes.
const echappe = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

async function sendSilenceAlertEmail(client, message) {
  const key = process.env.RESEND_API_KEY
  const to = process.env.OPS_ALERT_EMAIL
  if (!key || !to) {
    console.warn('[healthcheck] silence alert email skipped — RESEND_API_KEY ou OPS_ALERT_EMAIL manquant')
    return
  }
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'alerts@actero.fr',
        to: to.split(',').map((s) => s.trim()).filter(Boolean),
        subject: `Actero — moteur silencieux : ${client.brandName}`,
        html: `<p>${echappe(message)}</p><p>Client : ${echappe(client.brandName)} (<code>${echappe(client.clientId)}</code>)</p>`,
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[healthcheck] silence alert email failed:', res.status, body.slice(0, 200))
    }
  } catch (err) {
    // Ne jamais laisser une panne Resend casser le healthcheck lui-même —
    // captureError() (appelé juste après pour chaque client) reste le filet
    // garanti même si cet envoi échoue.
    console.error('[healthcheck] silence alert email error:', err.message)
  }
}

// Best-effort instant ping to a Slack/Telegram-compatible incoming webhook
// (JSON {text}). Optional — Sentry is the guaranteed path; this is just faster.
async function sendOpsAlert(text) {
  const url = process.env.OPS_ALERT_WEBHOOK_URL
  if (!url) return
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 4000)
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `🔴 Actero — ${text}` }),
      signal: controller.signal,
    }).finally(() => clearTimeout(t))
  } catch { /* never let the alert channel break the healthcheck */ }
}

async function handler(req, res) {
  const cronSecret = process.env.CRON_SECRET
  const provided = req.headers['authorization']?.replace('Bearer ', '') || req.query?.secret
  const isVercelCron = req.headers['x-vercel-cron']
  if (!isVercelCron && cronSecret && provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const [llm, db] = await Promise.all([checkLLM(), checkDb()])

  // Après les contrôles d'infrastructure, et sans jamais les faire échouer.
  let silence = { evalue: false }
  try {
    silence = await checkSilence()
  } catch (err) {
    console.warn('[healthcheck] checkSilence:', err.message)
  }
  const failures = [llm, db].filter((c) => !c.ok).map((c) => c.detail)

  if (failures.length > 0) {
    const message = `Agent healthcheck FAILED — ${failures.join(' | ')}`
    captureError(new Error(message), { stage: 'agent_healthcheck', provider: LLM_PROVIDER, model: ACTIVE_MODEL })
    await sendOpsAlert(message)
    // Throw so withCronMonitor emits an error check-in → Sentry cron alert.
    throw new Error(message)
  }

  return res.status(200).json({
    ok: true,
    provider: LLM_PROVIDER,
    model: ACTIVE_MODEL,
    checks: { llm: true, db: true },
    silence,
  })
}

export default withCronMonitor('cron-agent-healthcheck', '*/5 * * * *', handler)
