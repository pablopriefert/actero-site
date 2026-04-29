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
    // Vercel freezes the serverless runtime as soon as the HTTP response is
    // sent. A `finally { await Sentry.flush() }` after the handler is too
    // late — the lambda may already be frozen, so the `ok` check-in HTTP
    // request never reaches Sentry and we get phantom timeout alerts on a
    // job that actually ran fine (the dominant cause of NODE-7 et al.).
    //
    // Fix: intercept `res.end` so that Sentry has a chance to flush BEFORE
    // we hand the response back to the runtime. We only delay by up to
    // `flushTimeoutMs`, so a jammed transport never blocks the cron.
    const origEnd = res.end.bind(res)
    let pending = false
    res.end = (...args) => {
      if (pending) return origEnd(...args)
      pending = true
      // Note: not awaited — we let the original `end` fire after flush.
      Sentry.flush(2000)
        .catch(() => {})
        .finally(() => origEnd(...args))
      return res
    }

    try {
      return await Sentry.withMonitor(slug, () => handler(req, res), monitorConfig)
    } catch (err) {
      // Make sure a check-in error and any captured exceptions reach Sentry
      // even when the handler threw before res.end was called.
      await Sentry.flush(2000).catch(() => {})
      throw err
    }
  }
}
