/**
 * Sentry helper for API routes (Vercel Serverless Functions).
 *
 * Importing this module also triggers Sentry.init() via ../../instrument.mjs,
 * so unhandled errors in the function are auto-captured once the module is
 * loaded. Just `import './lib/sentry.js'` at the top of a route to enable it.
 *
 * Usage:
 *   import { captureError } from './lib/sentry.js'
 *
 *   try { ... } catch (err) {
 *     captureError(err, { endpoint: '/api/foo', user_id: '...' })
 *     return res.status(500).json({ error: err.message })
 *   }
 */
import { Sentry } from '../../instrument.mjs'

export function captureError(err, context = {}) {
  try {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
      Sentry.captureException(err)
    })
  } catch {
    // Never throw from error-reporting code
  }
}

export function captureMessage(message, level = 'info', context = {}) {
  try {
    Sentry.withScope((scope) => {
      scope.setLevel(level)
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })
      Sentry.captureMessage(message)
    })
  } catch {
    // Never throw
  }
}

/**
 * Wrap a Vercel serverless handler so any thrown error (sync or async) is
 * reported to Sentry and flushed before the lambda terminates.
 *
 * Vercel's runtime swallows handler rejections, so global uncaughtException /
 * unhandledRejection hooks never see them — the wrapper is required to
 * actually capture errors from API routes.
 */
export function withSentry(handler) {
  return async function wrappedSentryHandler(req, res) {
    // Vercel freezes the serverless runtime the instant the HTTP response is
    // sent. Two problems follow:
    //
    //  1. Even when an exception DOES propagate, an un-awaited Sentry.flush()
    //     never ships because the lambda is already frozen.
    //
    //  2. The dominant pattern in this codebase is handlers that wrap their
    //     own body in try/catch and respond with `res.status(500).json(...)`
    //     THEMSELVES. The error never escapes `handler()`, so the catch block
    //     below never runs — captureException is never called. This is why
    //     Vercel shows heavy 500s with zero matching Sentry issues.
    //
    // Fix: intercept `res.end` (same proven trick as cron-monitor.js). On any
    // 5xx response — whether the handler threw or swallowed the error itself —
    // record a Sentry event and flush BEFORE handing the response back to the
    // runtime. A `pending` guard prevents re-entrancy, and the flush is capped
    // at 2s so a jammed transport never blocks the response.
    const origEnd = res.end.bind(res)
    let pending = false
    res.end = (...args) => {
      if (pending) return origEnd(...args)
      pending = true
      try {
        if (res.statusCode >= 500) {
          Sentry.withScope((scope) => {
            scope.setLevel('error')
            scope.setTag('endpoint', req.url || 'unknown')
            scope.setTag('method', req.method || 'unknown')
            scope.setTag('status_code', String(res.statusCode))
            // Only emit a synthetic event if the handler swallowed the error
            // itself (no exception propagated to capture below). The thrown
            // path already calls captureException with the real stack.
            if (!res.__sentryCaptured) {
              Sentry.captureMessage(
                `HTTP ${res.statusCode} ${req.method || ''} ${req.url || 'unknown'}`,
              )
            }
          })
        }
      } catch {
        // Never let error-reporting crash the real response
      }
      // Not awaited — let origEnd fire after flush resolves (or times out).
      Sentry.flush(2000)
        .catch(() => {})
        .finally(() => origEnd(...args))
      return res
    }

    try {
      return await handler(req, res)
    } catch (err) {
      try {
        res.__sentryCaptured = true
        Sentry.withScope((scope) => {
          scope.setTag('endpoint', req.url || 'unknown')
          scope.setTag('method', req.method || 'unknown')
          Sentry.captureException(err)
        })
        await Sentry.flush(2000)
      } catch {
        // Never let error-reporting crash the real response
      }
      if (!res.headersSent) {
        try {
          // Never echo err.message to the client — it can leak stack frames,
          // SQL fragments, internal table names, dependency versions. The
          // full error is already captured in Sentry above; surface the
          // Sentry event id so a support engineer can find it.
          const eventId = Sentry.lastEventId?.() || undefined
          res.status(500).json({
            error: 'Internal Server Error',
            ...(eventId ? { request_id: eventId } : {}),
          })
        } catch {
          // res already closed — nothing to do
        }
      }
    }
  }
}

export { Sentry }
