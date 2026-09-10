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


/**
 * Un morceau de code que le déploiement a remplacé.
 *
 * Vite nomme chaque morceau avec une empreinte (`ClientBillingView-Bq_WPgrU.js`).
 * Après un déploiement, l'ancien fichier n'existe plus — et un onglet resté
 * ouvert garde en mémoire l'ancienne table des noms. Le premier clic sur un
 * onglet chargé à la demande échoue alors, sans que rien ne soit cassé.
 */
export function estMorceauPerime(error) {
  const msg = error?.message || ''
  return /Failed to fetch dynamically imported module/i.test(msg)
    || /Importing a module script failed/i.test(msg)
    || /Loading chunk \d+ failed/i.test(msg)
}

/**
 * Recharge la page pour récupérer la nouvelle table des morceaux.
 *
 * @returns {boolean} true si un rechargement a été déclenché.
 *
 * LA FAILLE CORRIGÉE LE 10 SEPTEMBRE. La garde d'origine autorisait UN
 * rechargement par session, tous morceaux confondus. Elle empêchait bien la
 * boucle infinie, mais un jour de dix déploiements — ce qui est arrivé — le
 * marchand tombait sur l'écran d'erreur dès le deuxième morceau périmé,
 * puisque le drapeau était déjà posé.
 *
 * On compte donc PAR MORCEAU : chaque nouvelle URL morte a droit à son
 * rechargement, et la même deux fois de suite ne boucle pas. Un plafond
 * global reste, pour le cas où un déploiement servirait vraiment des fichiers
 * introuvables : mieux vaut un écran d'erreur qu'un onglet qui se recharge
 * sans fin.
 */
const PLAFOND_RECHARGEMENTS = 4

export function rechargerPourMorceauPerime(error) {
  if (typeof window === 'undefined') return false
  try {
    // L'URL du morceau est dans le message ; à défaut, on retombe sur le
    // message entier, qui reste discriminant.
    const url = (error?.message || '').match(/https?:\/\/\S+/)?.[0] || error?.message || 'inconnu'
    const cle = `actero-morceau-perime:${url}`
    const total = Number(sessionStorage.getItem('actero-rechargements-morceaux') || 0)
    if (sessionStorage.getItem(cle) || total >= PLAFOND_RECHARGEMENTS) return false
    sessionStorage.setItem(cle, '1')
    sessionStorage.setItem('actero-rechargements-morceaux', String(total + 1))
    window.location.reload()
    return true
  } catch {
    // sessionStorage indisponible (navigation privée verrouillée) : on
    // n'insiste pas, l'écran d'erreur reste une sortie honorable.
    return false
  }
}

class BaseErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    if (estMorceauPerime(error) && rechargerPourMorceauPerime(error)) return

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
    // « Réessayer » sur un morceau de code périmé redemandait la MÊME URL
    // morte : le bouton ne pouvait que rééchouer. Il faut recharger la page
    // pour récupérer la nouvelle table des morceaux.
    if (estMorceauPerime(this.state.error) && typeof window !== 'undefined') {
      window.location.reload()
      return
    }
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
          className="min-h-screen flex items-center justify-center bg-surface p-6"
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
                  <pre className="mt-2 text-[11px] text-[#71717a] bg-surface border border-[#f0f0f0] rounded-lg p-3 max-h-32 overflow-auto whitespace-pre-wrap break-words">
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
