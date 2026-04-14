/**
 * Intercom Connector — helpdesk integration.
 *
 * Used by the engine to:
 *  - Reply to Intercom conversations on behalf of the AI agent
 *  - Fetch conversation context
 *  - Create notes on conversations for the human team
 */

const API_BASE = 'https://api.intercom.io'

function headers(accessToken) {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'Intercom-Version': '2.11',
  }
}

/**
 * Reply to an Intercom conversation as the admin/bot.
 */
export async function replyToConversation(accessToken, conversationId, message, adminId) {
  try {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/reply`, {
      method: 'POST',
      headers: headers(accessToken),
      body: JSON.stringify({
        message_type: 'comment',
        type: 'admin',
        admin_id: adminId,
        body: message,
      }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.errors?.[0]?.message || `${res.status}` }
    return { success: true, conversation: data }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Add an internal note (visible only to team, not to customer).
 */
export async function addNote(accessToken, conversationId, note, adminId) {
  try {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/reply`, {
      method: 'POST',
      headers: headers(accessToken),
      body: JSON.stringify({
        message_type: 'note',
        type: 'admin',
        admin_id: adminId,
        body: note,
      }),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data.errors?.[0]?.message || `${res.status}` }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

/**
 * Fetch a conversation by ID with full context.
 */
export async function getConversation(accessToken, conversationId) {
  try {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}?display_as=plaintext`, {
      headers: headers(accessToken),
    })
    const data = await res.json()
    if (!res.ok) return { error: data.errors?.[0]?.message || `${res.status}` }
    return { conversation: data }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Get the default admin ID (to post messages as) for the workspace.
 */
export async function getDefaultAdminId(accessToken) {
  try {
    const res = await fetch(`${API_BASE}/admins`, { headers: headers(accessToken) })
    const data = await res.json()
    if (!res.ok) return { error: data.errors?.[0]?.message || `${res.status}` }
    const admins = data.admins || []
    // Prefer the first non-away admin, fallback to first
    const admin = admins.find((a) => !a.away_mode_enabled) || admins[0]
    return { admin_id: admin?.id }
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Close a conversation (resolve it).
 */
export async function closeConversation(accessToken, conversationId, adminId) {
  try {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/parts`, {
      method: 'POST',
      headers: headers(accessToken),
      body: JSON.stringify({
        message_type: 'close',
        type: 'admin',
        admin_id: adminId,
      }),
    })
    return { success: res.ok }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
