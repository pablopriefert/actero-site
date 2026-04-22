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
    try {
      return await handler(req, res)
    } catch (err) {
      try {
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
          res.status(500).json({ error: err?.message || 'Internal Server Error' })
        } catch {
          // res already closed — nothing to do
        }
      }
    }
  }
}

export { Sentry }
