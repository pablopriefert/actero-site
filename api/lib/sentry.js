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

export { Sentry }
