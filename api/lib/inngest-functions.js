// Inngest functions that replace the sub-daily Vercel crons.
//
// Strategy: trigger the EXISTING cron handlers over HTTP with the Vercel Cron
// Secret. Zero refactor of the handler code — the only thing changing is who
// pulls the trigger (Inngest instead of Vercel Cron scheduler).
//
// Rollback: delete these functions + re-add the schedules to vercel.json.

import { inngest } from './inngest-client.js'

// Base URL resolution — Vercel provides VERCEL_URL without protocol
// (e.g. "actero-site-xxx.vercel.app"). Prefer a manually-set ACTERO_BASE_URL
// for prod (actero.fr) so alias URLs don't drift.
const baseUrl =
  process.env.ACTERO_BASE_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://actero.fr')

async function triggerCron(path) {
  const secret = process.env.CRON_SECRET
  if (!secret) throw new Error('CRON_SECRET missing — set it in Vercel env vars')

  const res = await fetch(`${baseUrl}${path}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${secret}` },
  })

  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Cron handler ${path} failed (${res.status}): ${text.slice(0, 500)}`)
  }
  try {
    return JSON.parse(text)
  } catch {
    return { raw: text.slice(0, 500) }
  }
}

// Every 2 minutes — poll IMAP + Gmail mailboxes for new inbound emails.
export const pollInboundEmails = inngest.createFunction(
  { id: 'poll-inbound-emails', name: 'Poll inbound emails (IMAP + Gmail)' },
  { cron: '*/2 * * * *' },
  async ({ step }) => {
    return step.run('call-vercel-handler', () =>
      triggerCron('/api/cron/poll-inbound-emails'),
    )
  },
)

// Every 15 minutes — proactive watchdog (shipment_delayed, failed_payment, etc.)
export const proactiveWatchdog = inngest.createFunction(
  { id: 'proactive-watchdog', name: 'Proactive watchdog detectors' },
  { cron: '*/15 * * * *' },
  async ({ step }) => {
    return step.run('call-vercel-handler', () =>
      triggerCron('/api/cron/proactive-watchdog'),
    )
  },
)

// Every 5 minutes — abandoned-cart follow-up sender.
export const processAbandonedCarts = inngest.createFunction(
  { id: 'process-abandoned-carts', name: 'Process abandoned carts' },
  { cron: '*/5 * * * *' },
  async ({ step }) => {
    return step.run('call-vercel-handler', () =>
      triggerCron('/api/cron/process-abandoned-carts'),
    )
  },
)

export const functions = [pollInboundEmails, proactiveWatchdog, processAbandonedCarts]
