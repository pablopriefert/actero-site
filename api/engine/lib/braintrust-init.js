/**
 * Actero Engine — Braintrust observability wrapper.
 *
 * Provides a fail-soft `trace()` helper around Braintrust's traced() so the
 * engine never breaks if Braintrust is misconfigured / down / not installed.
 *
 * Usage:
 *
 *   import { trace } from './braintrust-init.js'
 *
 *   const result = await trace(
 *     'claude.call',           // span name (verb.noun convention)
 *     { input, metadata: {} }, // optional open props (logged at span start)
 *     async (span) => {
 *       // ...do work...
 *       span?.log({ output, metadata: { tokens_in: 123 } })
 *       return value
 *     },
 *   )
 *
 * Behaviour:
 *   - If BRAINTRUST_API_KEY is unset → no-op: just runs the inner function.
 *   - If the SDK import or initLogger / traced calls throw → no-op (warned).
 *   - The inner function ALWAYS runs (and its return value bubbles up),
 *     regardless of any observability failure. The hot path in brain.js /
 *     claude-client.js cannot be broken by Braintrust being unavailable.
 *
 * Project name: `actero-engine`. Set BRAINTRUST_API_KEY on Vercel to enable.
 */

const PROJECT_NAME = 'actero-engine'
const ENVIRONMENT =
  process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'

let _initPromise = null
let _initFailed = false

// Lazy idempotent init: only fires on first trace() call when the key exists.
// Returns the loaded module or null if disabled/failed.
async function ensureInit() {
  if (_initFailed) return null
  if (!process.env.BRAINTRUST_API_KEY) return null
  if (_initPromise) return _initPromise

  _initPromise = (async () => {
    try {
      const bt = await import('braintrust')
      try {
        // BRAINTRUST_API_URL must be honoured so EU accounts (api-eu.braintrust.dev)
        // don't silently ship to the US endpoint and lose traces.
        const initOpts = {
          projectName: PROJECT_NAME,
          apiKey: process.env.BRAINTRUST_API_KEY,
        }
        if (process.env.BRAINTRUST_API_URL) {
          initOpts.apiUrl = process.env.BRAINTRUST_API_URL
          initOpts.appUrl = process.env.BRAINTRUST_API_URL
        }
        bt.initLogger(initOpts)
      } catch (e) {
        // initLogger is idempotent in normal cases; tolerate "already initialised".
        console.warn('[braintrust] initLogger warning:', e?.message)
      }
      return bt
    } catch (e) {
      _initFailed = true
      console.warn('[braintrust] SDK import failed:', e?.message)
      return null
    }
  })()

  return _initPromise
}

/**
 * Run `fn` inside a Braintrust span. Always returns whatever `fn` returns.
 * Never throws because of Braintrust — only because of `fn` itself.
 *
 * @param {string} name      - span name (e.g. 'claude.call', 'brain.run')
 * @param {object} openProps - optional { input, metadata } logged at span start
 * @param {(span:any)=>Promise<any>} fn - the actual work; receives the span
 *                                        (or null if Braintrust is disabled)
 */
export async function trace(name, openProps, fn) {
  // Fast path: Braintrust disabled → bypass entirely.
  if (!process.env.BRAINTRUST_API_KEY || _initFailed) {
    return fn(null)
  }

  const bt = await ensureInit()
  if (!bt || typeof bt.traced !== 'function') {
    return fn(null)
  }

  try {
    return await bt.traced(
      async (span) => {
        try {
          if (openProps) {
            span.log({
              ...openProps,
              metadata: { environment: ENVIRONMENT, ...(openProps.metadata || {}) },
            })
          }
        } catch (e) {
          console.warn('[braintrust] open span.log failed:', e?.message)
        }
        return await fn(span)
      },
      { name },
    )
  } catch (e) {
    // If Braintrust itself throws at the wrapper level, fall back to bare fn.
    console.warn('[braintrust] trace wrapper failed:', e?.message)
    return fn(null)
  }
}
