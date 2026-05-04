/**
 * Role-based tab access policy.
 *
 * Extracted from TeamManager.jsx so the sidebar filter logic can run
 * synchronously without having to wait for the TeamManager chunk
 * (TeamManager is lazy-loaded on the Équipe tab; the policy table
 * must be available on first render).
 *
 * Roles:
 *   - owner / manager : all tabs (`*`)
 *   - operational     : frontline SAV + config visibility, no billing
 *   - support         : tickets + templates + sentiment + activity only
 *   - finance         : billing portal only
 *
 * Rule: `canAccessTab(role, tabId) === true` lets the tab render.
 * A falsy `role` (unknown/legacy) falls back to allow — errs on visibility
 * rather than on a hidden tab a user can't reach from any nav.
 */

export const ROLE_PERMISSIONS = {
  owner: '*',
  manager: '*',
  operational: [
    'overview', 'automation', 'activity', 'escalations', 'response-templates',
    'systems', 'integrations', 'migrations', 'channels', 'email-agent', 'sentiment',
    'voice-report', 'voice-calls', 'voice-agent', 'insights', 'opportunities',
    'agent-control', 'agent-config', 'knowledge', 'guardrails', 'simulator',
  ],
  support: ['overview', 'escalations', 'response-templates', 'sentiment', 'activity'],
  finance: ['overview', 'profile', 'supplier-negotiation', 'settings', 'billing'],
}

export function canAccessTab(role, tabId) {
  if (!role) return true
  const perms = ROLE_PERMISSIONS[role]
  if (perms === '*') return true
  if (!perms) return false
  return perms.includes(tabId)
}
