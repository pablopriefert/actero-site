/**
 * Resolve the caller's client_id, creating the client on first use.
 *
 * A user can reach a billing/upgrade surface before any `clients` row exists
 * (direct sign-up that never went through onboarding/checkout). Without this,
 * upgrade buttons dead-end because `client?.id` is null. Resolution order:
 *   1. client_users link (invited members)
 *   2. clients.owner_user_id (legacy / owner accounts)
 *   3. create clients + client_users(owner) + client_settings, return new id
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase — browser client (RLS)
 * @param {{ user: { id: string, email?: string, user_metadata?: object } }} session
 * @returns {Promise<string>} the resolved (or freshly created) client_id
 * @throws if the client row could not be created
 */
export async function resolveOrCreateClientId(supabase, session) {
  const userId = session?.user?.id
  if (!userId) throw new Error('no_session')

  // 1. Invited member → client_users link
  const { data: link } = await supabase
    .from('client_users')
    .select('client_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (link?.client_id) return link.client_id

  // 2. Owner account → clients.owner_user_id
  const { data: owned } = await supabase
    .from('clients')
    .select('id')
    .eq('owner_user_id', userId)
    .maybeSingle()
  if (owned?.id) return owned.id

  // 3. First visit → create the client + link + settings.
  const userName =
    session.user.user_metadata?.full_name ||
    session.user.user_metadata?.name ||
    session.user.email?.split('@')[0] ||
    'Ma boutique'

  const { data: newClient, error: createErr } = await supabase
    .from('clients')
    .insert({
      brand_name: userName,
      contact_email: session.user.email,
      owner_user_id: userId,
      plan: 'free',
    })
    .select('id')
    .single()

  if (createErr || !newClient?.id) {
    throw new Error('client_create_failed')
  }

  await supabase.from('client_users').insert({
    client_id: newClient.id,
    user_id: userId,
    role: 'owner',
    email: session.user.email,
  })
  await supabase.from('client_settings').insert({ client_id: newClient.id })

  return newClient.id
}
