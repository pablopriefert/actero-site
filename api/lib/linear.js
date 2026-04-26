/**
 * Linear GraphQL helper — used by api/integrations/linear/connect.js (validate
 * + list teams) and by api/engine/respond.js (auto-push critical escalations).
 *
 * Auth: Personal API key (lin_api_…) in the Authorization header. We support
 * Personal keys in v1 because OAuth would require an admin app review for
 * each merchant — too heavy for the first iteration. The key is encrypted
 * at rest via api/lib/crypto.js, never returned to the client unencrypted.
 *
 * Docs: https://developers.linear.app/docs/graphql/working-with-the-graphql-api
 */

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
