import * as Sentry from '@sentry/node'

const dsn =
  process.env.SENTRY_DSN ||
  'https://b067fdab863ea736082ad783c5c4b25a@o4510908479832064.ingest.de.sentry.io/4511217974181968'

if (!globalThis.__acteroSentryInitialized) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'development',
    sendDefaultPii: true,
    tracesSampleRate: 0.1,
  })
  globalThis.__acteroSentryInitialized = true
}

export { Sentry }
