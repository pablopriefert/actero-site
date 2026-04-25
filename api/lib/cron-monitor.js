import { Sentry } from './sentry.js'

/**
 * Wrap a Vercel cron handler with a Sentry Cron Monitor.
 *
 * Reports check-ins (in_progress → ok | error) around each invocation.
 * Sentry will alert if the job misses its expected schedule or fails.
 *
 * Vercel crons run in UTC — schedule values here must match the ones
 * declared in vercel.json for the corresponding path.
 */
export function withCronMonitor(slug, schedule, handler) {
  const monitorConfig = {
    schedule: { type: 'crontab', value: schedule },
    checkinMargin: 2,
    maxRuntime: 15,
  }

  return async function wrappedCronHandler(req, res) {
    try {
      return await Sentry.withMonitor(slug, () => handler(req, res), monitorConfig)
    } finally {
      // Vercel freezes the serverless runtime as soon as the response is sent.
      // Without an explicit flush, the queued "ok" check-in HTTP request is
      // dropped before reaching Sentry, which then reports a phantom timeout
      // after max_runtime expires. Match the pattern used in withSentry().
      await Sentry.flush(2000).catch(() => {})
    }
  }
}
