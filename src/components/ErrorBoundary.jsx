import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

/**
 * ErrorBoundary — two flavors:
 *
 *   <ErrorBoundary>         → full-page boundary (app root). Shows a branded
 *                             recovery screen and offers reload.
 *   <TabErrorBoundary>      → scoped boundary (wraps a single tab / view).
 *                             A crash in one tab does not take down the whole
 *                             dashboard — the user can switch tabs. Shows a
 *                             compact inline error card with retry.
 *
 * Both boundaries:
 * - Log `[ErrorBoundary]` to console (captured by Sentry via console integration)
 * - Explicitly call window.Sentry.captureException when available
 * - Support reset via a state-bump `resetKey` prop (forces remount on prop change)
 *
 * Why both variants: the app-wide boundary exists today but crashes in a single
 * dashboard tab should NOT blank the entire shell. Tab-scoped boundaries keep
 * the sidebar + nav interactive and let the user try a different tab.
 */

class BaseErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Stale chunk after a new deploy: the hashed bundle filename changed and the
    // user's cached HTML/JS references a chunk that no longer exists. Force a
    // hard reload once per session to pick up the new bundle map.
    const msg = error?.message || ''
    const isStaleChunk =
      /Failed to fetch dynamically imported module/i.test(msg) ||
      /Importing a module script failed/i.test(msg) ||
      /Loading chunk \d+ failed/i.test(msg)
    if (isStaleChunk && typeof window !== 'undefined') {
      const key = 'actero-stale-chunk-reloaded'
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1')
        window.location.reload()
        return
      }
    }

    console.error('[ErrorBoundary]', this.props.scope || 'root', ':', error?.message)
    if (error?.stack) {
      console.error(error.stack.split('\n').slice(0, 5).join('\n'))
    }
    if (errorInfo?.componentStack) {
      console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack.split('\n').slice(0, 10).join('\n'))
    }
    if (typeof window !== 'undefined' && window.Sentry) {
      window.Sentry.withScope((scope) => {
        scope.setTag('boundary', this.props.scope || 'root')
        scope.setExtras({ componentStack: errorInfo?.componentStack })
        window.Sentry.captureException(error)
      })
    }
  }

  componentDidUpdate(prevProps) {
    // Auto-reset when `resetKey` changes (e.g. parent swapped active tab).
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null })
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return typeof this.props.fallback === 'function'
        ? this.props.fallback({ error: this.state.error, reset: this.reset })
        : this.props.fallback
    }
    return this.props.children
  }
}

/**
 * App-root boundary. Branded full-screen recovery.
 * Use ONCE at the top of the app.
 */
export function ErrorBoundary({ children }) {
  return (
    <BaseErrorBoundary
      scope="root"
      fallback={({ error, reset }) => (
        <div
          role="alert"
          className="min-h-screen flex items-center justify-center bg-[#F9F7F1] p-6"
        >
          <div className="max-w-md text-center">
            <div className="w-14 h-14 rounded-2xl bg-white border border-[#f0f0f0] shadow-sm flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-7 h-7 text-red-500" aria-hidden="true" />
            </div>
            <h1 className="text-[22px] font-semibold text-[#1a1a1a] mb-2 tracking-tight">
              Une erreur inattendue est survenue
            </h1>
            <p className="text-[14px] text-[#71717a] mb-6">
              L'application a rencontré un problème. Nous avons été notifiés automatiquement.
            </p>
            {error?.message && (
              <details className="text-left mb-5">
                <summary className="text-[12px] text-[#9ca3af] cursor-pointer hover:text-[#71717a]">
                  Détails techniques
                </summary>
                <pre className="mt-2 text-[11px] text-[#71717a] bg-white border border-[#f0f0f0] rounded-lg p-3 max-h-32 overflow-auto whitespace-pre-wrap break-words">
                  {error.message}
                </pre>
              </details>
            )}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => {
                  reset()
                  window.location.reload()
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cta text-white text-[13px] font-semibold hover:bg-cta-hover transition-colors"
              >
                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                Recharger l'application
              </button>
            </div>
          </div>
        </div>
      )}
    >
      {children}
    </BaseErrorBoundary>
  )
}

/**
 * Tab-scoped boundary. Renders compact inline card on failure so the rest of
 * the dashboard stays interactive.
 *
 * Pass `resetKey` (e.g. activeTab id) so switching tabs auto-clears the error.
 */
export function TabErrorBoundary({ children, tabId, resetKey, tabLabel }) {
  return (
    <BaseErrorBoundary
      scope={`tab:${tabId || 'unknown'}`}
      resetKey={resetKey}
      fallback={({ error, reset }) => (
        <div
          role="alert"
          className="m-6 p-6 bg-white rounded-2xl border border-red-100 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[14px] font-semibold text-[#1a1a1a] mb-1">
                {tabLabel ? `Erreur sur l'onglet "${tabLabel}"` : 'Erreur sur cet onglet'}
              </h3>
              <p className="text-[12px] text-[#71717a] mb-3">
                Vous pouvez réessayer ou changer d'onglet. Les autres sections restent accessibles.
              </p>
              {error?.message && (
                <details className="mb-3">
                  <summary className="text-[11px] text-[#9ca3af] cursor-pointer hover:text-[#71717a]">
                    Détails techniques
                  </summary>
                  <pre className="mt-2 text-[11px] text-[#71717a] bg-[#fafafa] border border-[#f0f0f0] rounded-lg p-3 max-h-32 overflow-auto whitespace-pre-wrap break-words">
                    {error.message}
                  </pre>
                </details>
              )}
              <button
                onClick={reset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cta text-white text-[12px] font-semibold hover:bg-cta-hover transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
                Réessayer
              </button>
            </div>
          </div>
        </div>
      )}
    >
      {children}
    </BaseErrorBoundary>
  )
}
