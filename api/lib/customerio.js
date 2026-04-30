/**
 * Customer.io Track API helper — DEPRECATED no-op shim.
 *
 * Customer.io was removed from the Actero stack on 2026-04-30. The exported
 * functions are kept as no-ops so the ~10 callers across api/ don't need to
 * change in lock-step; deleting this file would break their imports.
 *
 * If you ever bring CIO back: restore the implementation from git history
 * (commit d97608a or earlier) and re-add the cron entry to vercel.json.
 *
 * userId convention (when re-enabled): Actero client.id (UUID).
 */

// All CIO functions are fire-and-forget no-ops. They never throw, never
// hit the network, and never log — there is nothing to do.
export async function identify() {}
export async function track() {}
export async function trackAnonymous() {}
export async function deleteProfile() {}
