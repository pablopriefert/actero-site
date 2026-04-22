import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'
import { initTheme } from './lib/theme'
import { initAnalytics } from './lib/analytics'

// Apply stored / system theme before React mounts to avoid flash of wrong theme
initTheme()

// Initialize Sentry (error tracking + performance monitoring)
// Only enabled in production to avoid noise in local dev
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    // Release = commit SHA injected at build time — lets Sentry tie errors to
    // a specific deploy and show regressions. Mirrors the release name used by
    // @sentry/vite-plugin to upload sourcemaps.
    release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    tracesSampleRate: 0.1, // 10% of transactions
    replaysSessionSampleRate: 0.05, // 5% of normal sessions — UX insight without volume blow-up
    replaysOnErrorSampleRate: 1.0, // 100% of error sessions
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      // Supabase GoTrue auto-refresh lock timeout — transient, browser throttles
      // navigator.locks on backgrounded tabs. Supabase retries on its own.
      /Acquiring an exclusive Navigator LockManager lock/i,
      // User navigated away / iOS aborted fetch or media play — not actionable.
      'AbortError',
      // Stale bundle after a deploy — ErrorBoundary auto-reloads once per session.
      /Failed to fetch dynamically imported module/i,
      /Importing a module script failed/i,
    ],
  })
  // Expose Sentry globally so ErrorBoundary can report errors
  window.Sentry = Sentry
}

// Initialize Amplitude Analytics + Session Replay (client-side only, once per lifecycle).
// Canonical init path lives in src/lib/analytics.ts — this call just wires it up.
initAnalytics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
