import { authenticateAdmin, logAdminAction, readJsonBody, supabaseAdmin } from './_helpers.js'

/**
 * /api/admin/client-notes
 *
 * GET    ?client_id=xxx           -> list notes for a client
 * POST   { client_id, body, mentions } -> create note
 * PATCH  { note_id, body, mentions? }  -> update own note
 * DELETE ?note_id=xxx             -> delete own note
 *
 * All mutations logged to admin_action_logs.
 */
export default async function handler(req, res) {
  const auth = await authenticateAdmin(req, res)
  if (!auth) return
  const { user: admin } = auth

  try {
    if (req.method === 'GET') {
      const { client_id } = req.query || {}
      if (!client_id) {
        return res.status(400).json({ error: 'client_id is required' })
      }
      const { data, error } = await supabaseAdmin
        .from('admin_client_notes')
        .select('*')
        .eq('client_id', client_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return res.status(200).json({ notes: data || [] })
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req)
      const { client_id, body: noteBody, mentions } = body || {}
      if (!client_id || !noteBody || typeof noteBody !== 'string') {
        return res.status(400).json({ error: 'client_id and body are required' })
      }
      const payload = {
        client_id,
        author_id: admin.id,
        author_email: admin.email,
        body: noteBody,
        mentions: Array.isArray(mentions) ? mentions : [],
      }
      const { data, error } = await supabaseAdmin
        .from('admin_client_notes')
        .insert(payload)
        .select()
        .single()
      if (error) throw error

      await logAdminAction(
        admin.id,
        admin.email,
        'client_note_create',
        'admin_client_notes',
        data.id,
        client_id,
        { mentions: payload.mentions, length: noteBody.length }
      )
      return res.status(200).json({ note: data })
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody(req)
      const { note_id, body: noteBody, mentions } = body || {}
      if (!note_id || !noteBody) {
        return res.status(400).json({ error: 'note_id and body are required' })
      }

      // Load note first to verify ownership
      const { data: existing, error: loadErr } = await supabaseAdmin
        .from('admin_client_notes')
        .select('id, author_id, client_id')
        .eq('id', note_id)
        .maybeSingle()
      if (loadErr) throw loadErr
      if (!existing) return res.status(404).json({ error: 'Note not found' })
      if (existing.author_id !== admin.id) {
        return res.status(403).json({ error: 'Can only edit your own notes' })
      }

      const update = {
        body: noteBody,
        updated_at: new Date().toISOString(),
      }
      if (Array.isArray(mentions)) update.mentions = mentions

      const { data, error } = await supabaseAdmin
        .from('admin_client_notes')
        .update(update)
        .eq('id', note_id)
        .select()
        .single()
      if (error) throw error

      await logAdminAction(
        admin.id,
        admin.email,
        'client_note_update',
        'admin_client_notes',
        note_id,
        existing.client_id,
        { length: noteBody.length }
      )
      return res.status(200).json({ note: data })
    }

    if (req.method === 'DELETE') {
      const { note_id } = req.query || {}
      if (!note_id) return res.status(400).json({ error: 'note_id is required' })

      const { data: existing, error: loadErr } = await supabaseAdmin
        .from('admin_client_notes')
        .select('id, author_id, client_id')
        .eq('id', note_id)
        .maybeSingle()
      if (loadErr) throw loadErr
      if (!existing) return res.status(404).json({ error: 'Note not found' })
      if (existing.author_id !== admin.id) {
        return res.status(403).json({ error: 'Can only delete your own notes' })
      }

      const { error } = await supabaseAdmin
        .from('admin_client_notes')
        .delete()
        .eq('id', note_id)
      if (error) throw error

      await logAdminAction(
        admin.id,
        admin.email,
        'client_note_delete',
        'admin_client_notes',
        note_id,
        existing.client_id,
        {}
      )
      return res.status(200).json({ success: true })
    }

    res.setHeader('Allow', 'GET, POST, PATCH, DELETE')
    return res.status(405).json({ error: 'Method Not Allowed' })
  } catch (err) {
    console.error('[admin/client-notes] Error:', err.message)
    return res.status(500).json({ error: err.message || 'Internal error' })
  }
}
