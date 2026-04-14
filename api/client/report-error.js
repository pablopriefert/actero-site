/**
 * Client error reporting — Send an error report to the admin.
 *
 * POST /api/client/report-error
 * Body: { description, url?, context? }
 *
 * The authenticated user creates an error report that admins can review.
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Non autorisé' })

  const { data: { user }, error: authError } = await supabase.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Non autorisé' })

  const { description, url, context } = req.body || {}
  if (!description || typeof description !== 'string' || description.trim().length < 5) {
    return res.status(400).json({ error: 'Description requise (min. 5 caractères)' })
  }

  // Look up the client
  const { data: link } = await supabase
    .from('client_users')
    .select('client_id, clients:client_id(id, brand_name)')
    .eq('user_id', user.id)
    .maybeSingle()

  const clientId = link?.client_id || null
  const brandName = link?.clients?.brand_name || null

  const { data, error } = await supabase
    .from('error_reports')
    .insert({
      client_id: clientId,
      user_id: user.id,
      user_email: user.email,
      brand_name: brandName,
      url: url || null,
      description: description.trim().slice(0, 5000),
      context: context || {},
      status: 'open',
    })
    .select()
    .single()

  if (error) {
    console.error('[report-error] DB insert error:', error.message)
    return res.status(500).json({ error: 'Erreur serveur' })
  }

  return res.status(201).json({ success: true, report_id: data.id })
}
