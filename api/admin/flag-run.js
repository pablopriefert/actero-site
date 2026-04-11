import { authenticateAdmin, logAdminAction, readJsonBody, supabaseAdmin } from './_helpers.js'

const ALLOWED_TAGS = new Set([
  'hallucination',
  'tone_off',
  'wrong_classification',
  'wrong_action',
  'needs_review',
  'correct',
])

/**
 * POST /api/admin/flag-run
 *
 * Body: { run_id: string, tag: string, note?: string }
 *
 * Inserts a row in `engine_run_tags` and logs an entry in `admin_action_logs`.
 * The `correct` tag is treated as an "unflag" but still recorded for audit/training.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const auth = await authenticateAdmin(req, res)
  if (!auth) return
  const { user: admin } = auth

  const body = await readJsonBody(req)
  const { run_id, tag, note } = body || {}

  if (!run_id || typeof run_id !== 'string') {
    return res.status(400).json({ error: 'run_id is required' })
  }
  if (!tag || !ALLOWED_TAGS.has(tag)) {
    return res.status(400).json({ error: `Unsupported tag: ${tag}` })
  }

  const safeNote = typeof note === 'string' ? note.slice(0, 500) : null

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('engine_run_tags')
    .insert({
      run_id,
      tag,
      note: safeNote,
      flagged_by: admin.id,
    })
    .select('id')
    .maybeSingle()

  if (insertError) {
    console.error('[admin/flag-run] insert error:', insertError.message)
    return res.status(500).json({ error: 'Failed to flag run', details: insertError.message })
  }

  // Resolve client_id (best-effort) from the run for the audit log.
  let clientId = null
  try {
    const { data: run } = await supabaseAdmin
      .from('engine_runs')
      .select('client_id')
      .eq('id', run_id)
      .maybeSingle()
    if (run?.client_id) clientId = run.client_id
  } catch {
    /* ignore — engine_runs schema may vary */
  }

  await logAdminAction(
    admin.id,
    admin.email || null,
    'flag_run',
    'engine_run',
    run_id,
    clientId,
    { tag, note: safeNote, tag_id: inserted?.id || null }
  )

  return res.status(200).json({ success: true, id: inserted?.id || null })
}
