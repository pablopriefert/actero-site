/**
 * POST /api/jobs/backtest-marchand — l'essai à blanc, lancé par le marchand.
 *
 * POURQUOI CETTE ROUTE EXISTE
 *
 * Le harnais de rejeu tourne depuis le 9 septembre. Il prend les tickets
 * historiques d'une boutique, les repasse dans le cerveau SANS rien envoyer, et
 * produit la phrase qui vend Actero : « sur vos 1 240 tickets, l'agent en
 * aurait réglé 61 % tout seul ».
 *
 * Il n'était déclenchable que depuis `api/jobs/backtest.js`, protégé par
 * `authenticateAdmin`, et affiché dans un seul écran d'administration. La
 * meilleure preuve qu'on ait, faite sur les données du marchand, demandait donc
 * qu'un humain de chez nous la lance et la lui raconte. Actero n'a aucun client
 * payant : ce parcours-là est précisément celui qui manque (ACT-18).
 *
 * CE QUI DIFFÈRE DE LA ROUTE ADMIN
 *
 *  · le `client_id` n'est jamais cru sur parole — `requireClientAccess` vérifie
 *    qu'il appartient à l'appelant (api/lib/tenant-guard.js, ACT-24) ;
 *  · pas de choix de fournisseur ni de modèle. Comparer Claude et GPT sur les
 *    données d'un marchand est un outil interne, pas une fonctionnalité ;
 *  · un plafond. Chaque rejeu ouvre un bac à sable E2B facturé à la minute :
 *    sans limite, un seul compte peut vider les crédits.
 *
 * CE QUE ÇA NE FAIT PAS
 *
 * Aucun envoi, aucune écriture sur les conversations, aucune consommation du
 * quota mensuel. Le pare-feu est `api/engine/backtest-classify.js` et
 * `api/engine/backtest-etancheite.test.js` le garde — cette route ne
 * redémontre pas l'étanchéité, elle en dépend.
 */

import { createClient } from '@supabase/supabase-js'
import { withSentry } from '../lib/sentry.js'
import { spawnJob } from '../lib/e2b-runner.js'
import { requireClientAccess } from '../lib/tenant-guard.js'

export const maxDuration = 60

/** Au-delà, on refuse : un rejeu coûte des minutes de bac à sable. */
const MAX_PAR_24H = 3
/** En dessous, le score ne veut rien dire et ferait une mauvaise impression. */
const MINIMUM_DE_TICKETS = 20
/** Plafond par rejeu, aligné sur la route admin. */
const LIMITE_TICKETS = 500

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/, '')
  if (!token) return res.status(401).json({ error: 'Authentification requise' })

  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token)
  if (userErr || !userData?.user) {
    return res.status(401).json({ error: 'Session invalide' })
  }

  const { client_id: clientId } = req.body || {}
  if (!clientId) return res.status(400).json({ error: 'client_id requis' })

  // Le corps de la requête propose un client_id ; c'est ici qu'on vérifie qu'il
  // est bien à l'appelant. La route tourne en service_role, donc RLS ne filtre
  // rien pour nous.
  if (!(await requireClientAccess(supabaseAdmin, { user: userData.user, clientId, res }))) {
    return
  }

  // — Un seul rejeu à la fois. Deux bacs à sable sur les mêmes tickets
  //   produiraient deux scores concurrents et paieraient deux fois.
  const { data: enCours } = await supabaseAdmin
    .from('ticket_backtests')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'running')
    .limit(1)
  if (enCours?.length) {
    return res.status(409).json({
      error: 'analyse_en_cours',
      message: 'Une analyse est déjà en cours. Elle prend quelques minutes.',
      backtest_id: enCours[0].id,
    })
  }

  // — Le plafond. C'est de l'argent : chaque rejeu loue une machine.
  const depuis = new Date(Date.now() - 24 * 3600_000).toISOString()
  const { count } = await supabaseAdmin
    .from('ticket_backtests')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
    .gte('created_at', depuis)
  if ((count ?? 0) >= MAX_PAR_24H) {
    return res.status(429).json({
      error: 'plafond_atteint',
      message: `Vous avez lancé ${MAX_PAR_24H} analyses aujourd'hui. Revenez demain.`,
    })
  }

  // — Assez d'historique pour que le chiffre veuille dire quelque chose. Sans
  //   ça le marchand lance une analyse, attend, et lit « 0 % sur 3 tickets ».
  const { count: tickets } = await supabaseAdmin
    .from('ai_conversations')
    .select('id', { count: 'exact', head: true })
    .eq('client_id', clientId)
  if ((tickets ?? 0) < MINIMUM_DE_TICKETS) {
    return res.status(422).json({
      error: 'historique_insuffisant',
      message: `Il faut au moins ${MINIMUM_DE_TICKETS} conversations pour que le résultat ait du sens. `
        + `Vous en avez ${tickets ?? 0} — importez votre historique d'abord.`,
      tickets: tickets ?? 0,
    })
  }

  const { data: backtest, error: insertErr } = await supabaseAdmin
    .from('ticket_backtests')
    .insert({ client_id: clientId, status: 'running' })
    .select('id')
    .single()
  if (insertErr || !backtest) {
    console.error('[jobs/backtest-marchand] insert échoué :', insertErr?.message)
    return res.status(500).json({ error: 'Impossible de démarrer l’analyse' })
  }

  try {
    const { jobId } = await spawnJob({
      jobType: 'ticket_backtest',
      clientId,
      scriptName: 'ticket_backtest.py',
      payload: { backtest_id: backtest.id, limit: LIMITE_TICKETS },
    })
    await supabaseAdmin.from('ticket_backtests').update({ job_id: jobId }).eq('id', backtest.id)
    return res.status(202).json({ backtest_id: backtest.id, job_id: jobId, tickets: tickets ?? 0 })
  } catch (err) {
    // La ligne existe déjà : la laisser en `running` pour toujours bloquerait
    // le marchand par le 409 ci-dessus. On la marque échouée.
    await supabaseAdmin
      .from('ticket_backtests')
      .update({ status: 'failed', error: String(err?.message || err).slice(0, 2000), completed_at: new Date().toISOString() })
      .eq('id', backtest.id)
    console.error('[jobs/backtest-marchand] spawn échoué :', err?.message)
    return res.status(500).json({ error: 'Impossible de démarrer l’analyse' })
  }
}

export default withSentry(handler)
