/**
 * Actero Engine — Token Refresher
 * Refreshes expired OAuth tokens for integrations before making API calls.
 */
import { decryptToken, encryptToken } from '../../lib/crypto.js'

const GORGIAS_CLIENT_ID = process.env.GORGIAS_CLIENT_ID
const GORGIAS_CLIENT_SECRET = process.env.GORGIAS_CLIENT_SECRET
const ZENDESK_CLIENT_ID = process.env.ZENDESK_CLIENT_ID
const ZENDESK_CLIENT_SECRET = process.env.ZENDESK_CLIENT_SECRET

/**
 * Ensure a valid access token for an integration.
 * If expired, refresh it and update the DB.
 * Returns the valid access_token or null if refresh fails.
 */
export async function ensureValidToken(supabase, integrationId) {
  const { data: integration } = await supabase
    .from('client_integrations')
    .select('*')
    .eq('id', integrationId)
    .single()

  if (!integration) return null

  // Check if token has expired
  if (integration.expires_at) {
    const expiresAt = new Date(integration.expires_at)
    const now = new Date()
    const bufferMs = 5 * 60 * 1000 // 5 min buffer

    if (expiresAt.getTime() - bufferMs > now.getTime()) {
      // Token still valid
      return decryptToken(integration.access_token)
    }

    // Token expired — try to refresh (decrypt refresh_token in memory only)
    const decryptedRefresh = decryptToken(integration.refresh_token)
    if (decryptedRefresh) {
      const newToken = await refreshToken({ ...integration, refresh_token: decryptedRefresh })
      if (newToken) {
        await supabase
          .from('client_integrations')
          .update({
            access_token: encryptToken(newToken.access_token),
            refresh_token: encryptToken(newToken.refresh_token || decryptedRefresh),
            expires_at: newToken.expires_at,
            status: 'active',
          })
          .eq('id', integrationId)

        return newToken.access_token
      } else {
        // Refresh failed — mark as expired
        await supabase
          .from('client_integrations')
          .update({ status: 'expired' })
          .eq('id', integrationId)

        return null
      }
    }
  }

  return decryptToken(integration.access_token)
}

async function refreshToken(integration) {
  const provider = integration.provider

  try {
    if (provider === 'gorgias' && GORGIAS_CLIENT_ID) {
      const subdomain = integration.extra_config?.subdomain
      const res = await fetch(`https://${subdomain}.gorgias.com/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: integration.refresh_token,
          client_id: GORGIAS_CLIENT_ID,
          client_secret: GORGIAS_CLIENT_SECRET,
        }),
      })

      if (!res.ok) return null
      const data = await res.json()
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
      }
    }

    if (provider === 'zendesk' && ZENDESK_CLIENT_ID) {
      const subdomain = integration.extra_config?.subdomain
      const res = await fetch(`https://${subdomain}.zendesk.com/oauth/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: integration.refresh_token,
          client_id: ZENDESK_CLIENT_ID,
          client_secret: ZENDESK_CLIENT_SECRET,
        }),
      })

      if (!res.ok) return null
      const data = await res.json()
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(Date.now() + (data.expires_in || 7200) * 1000).toISOString(),
      }
    }

    // Gmail
    if (provider === 'gmail' && process.env.GOOGLE_CLIENT_ID) {
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: integration.refresh_token,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
        }),
      })

      if (!res.ok) return null
      const data = await res.json()
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token || integration.refresh_token,
        expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
      }
    }

    return null
  } catch (err) {
    console.error(`[token-refresher] Failed to refresh ${provider}:`, err.message)
    return null
  }
}
