/**
 * Linear GraphQL helper — used by api/integrations/oauth/linear/* (validate
 * + list teams) and by api/engine/respond.js (auto-push critical escalations).
 *
 * Auth: OAuth access token (long-lived ~10y) stored encrypted in
 * client_integrations.access_token. Same Authorization header shape works
 * with Personal API keys, so functions here are agnostic.
 *
 * Docs: https://developers.linear.app/docs/graphql/working-with-the-graphql-api
 */
import { decryptToken } from './crypto.js'

const ENDPOINT = 'https://api.linear.app/graphql'

async function gql({ apiKey, query, variables }) {
  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: apiKey, // Linear personal keys go raw, no "Bearer" prefix
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })
  const json = await resp.json().catch(() => ({}))
  if (!resp.ok || json.errors) {
    return { error: json.errors?.[0]?.message || `HTTP ${resp.status}` }
  }
  return { data: json.data }
}

/**
 * Validate a Linear API key + return the viewer's accessible teams.
 * Used at connect time so the merchant can pick which team gets the issues.
 */
export async function validateApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') return { error: 'invalid_key_format' }
  const r = await gql({
    apiKey,
    query: `query Connect {
      viewer { id name email }
      teams(first: 50) { nodes { id key name } }
    }`,
  })
  if (r.error) return { error: r.error }
  return {
    viewer: r.data.viewer,
    teams: r.data.teams.nodes,
  }
}

/**
 * High-level helper used by handleEscalation in api/engine/respond.js.
 *
 * Reads client_settings + client_integrations, gates on enabled + sentiment
 * threshold, creates the issue, and returns the metadata so the caller
 * can persist linear_issue_id on escalation_tickets. Fail-safe: never
 * throws — returns { skipped } or { error } on every error path so the
 * escalation pipeline is never blocked by Linear hiccups.
 */
export async function pushEscalationToLinear(supabase, {
  clientId, sentimentScore, customerEmail, customerName,
  subject, escalationReason, detectedIntent,
}) {
  try {
    const [{ data: settings }, { data: integration }] = await Promise.all([
      supabase
        .from('client_settings')
        .select('linear_auto_issue_enabled, linear_team_id, linear_sentiment_threshold')
        .eq('client_id', clientId)
        .maybeSingle(),
      supabase
        .from('client_integrations')
        .select('access_token, status')
        .eq('client_id', clientId)
        .eq('provider', 'linear')
        .maybeSingle(),
    ])

    if (!settings?.linear_auto_issue_enabled) return { skipped: 'disabled' }
    if (!settings.linear_team_id) return { skipped: 'no_team' }
    if (!integration?.access_token || integration.status !== 'active') {
      return { skipped: 'no_active_integration' }
    }

    const threshold = settings.linear_sentiment_threshold ?? -0.5
    if (typeof sentimentScore === 'number' && sentimentScore > threshold) {
      return { skipped: 'above_threshold', sentimentScore, threshold }
    }

    const apiKey = decryptToken(integration.access_token)
    const title = `[SAV] ${escalationReason || 'Escalade'} — ${customerName || customerEmail || 'client'}`
    const description = [
      `**Source:** SAV Actero (escalation auto-push)`,
      customerEmail ? `**Client:** ${customerName ? customerName + ' — ' : ''}${customerEmail}` : null,
      subject ? `**Sujet:** ${subject}` : null,
      detectedIntent ? `**Intent détecté:** ${detectedIntent}` : null,
      typeof sentimentScore === 'number' ? `**Sentiment:** ${sentimentScore.toFixed(2)} (seuil ${threshold})` : null,
      escalationReason ? `\n**Raison de l'escalade**\n${escalationReason}` : null,
      `\n_Issue créée automatiquement par Actero. Mettre à jour le statut quand traité côté produit._`,
    ].filter(Boolean).join('\n')

    return await createIssue({
      apiKey,
      teamId: settings.linear_team_id,
      title,
      description,
    })
  } catch (err) {
    return { error: err.message }
  }
}

/**
 * Create an issue. Returns { id, url, identifier } on success.
 */
export async function createIssue({ apiKey, teamId, title, description, labels = [] }) {
  if (!apiKey || !teamId) return { error: 'missing_credentials' }
  const r = await gql({
    apiKey,
    query: `mutation CreateIssue($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue { id identifier url title }
      }
    }`,
    variables: {
      input: {
        teamId,
        title: title.slice(0, 250), // Linear limits title length
        description: description?.slice(0, 5000) || '',
      },
    },
  })
  if (r.error) return { error: r.error }
  if (!r.data?.issueCreate?.success) return { error: 'create_failed' }
  const issue = r.data.issueCreate.issue
  return {
    id: issue.id,
    identifier: issue.identifier,
    url: issue.url,
    title: issue.title,
  }
}
