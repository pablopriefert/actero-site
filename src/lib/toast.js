/**
 * Actero toast helpers — wrapper around sonner.
 *
 * Usage:
 *   import { toast } from '@/lib/toast'
 *   toast.success('Sauvegardé')
 *   toast.error('Erreur réseau')
 *   toast.info('Synchronisation en cours')
 *   toast.warning('Quota bientôt atteint')
 *
 *   // Undo pattern (destructive actions) — 8s window:
 *   toast.action('Ticket archivé', {
 *     actionLabel: 'Annuler',
 *     onAction: () => restoreTicket(),
 *   })
 *
 *   // Promise toast (loading → success/error auto):
 *   toast.promise(fetch(...), {
 *     loading: 'Enregistrement…',
 *     success: 'Enregistré',
 *     error: 'Échec',
 *   })
 */
import { toast as sonner } from 'sonner'
import { Check, X, Info, AlertTriangle } from 'lucide-react'
import React from 'react'

const DEFAULT_DURATION = 5000
const UNDO_DURATION = 8000

const ACTERO_GREEN = '#0E653A'
const ACTERO_RED = '#DC2626'
const ACTERO_AMBER = '#F59E0B'
const ACTERO_BLUE = '#3B82F6'

function iconEl(Icon, color) {
  return React.createElement(Icon, {
    className: 'w-4 h-4 shrink-0',
    style: { color },
    strokeWidth: 2.5,
  })
}

export const toast = {
  success(message, opts = {}) {
    return sonner.success(message, {
      duration: opts.duration ?? DEFAULT_DURATION,
      icon: iconEl(Check, ACTERO_GREEN),
      description: opts.description,
      ...opts,
    })
  },

  error(message, opts = {}) {
    return sonner.error(message, {
      duration: opts.duration ?? DEFAULT_DURATION,
      icon: iconEl(X, ACTERO_RED),
      description: opts.description,
      ...opts,
    })
  },

  info(message, opts = {}) {
    return sonner(message, {
      duration: opts.duration ?? DEFAULT_DURATION,
      icon: iconEl(Info, ACTERO_BLUE),
      description: opts.description,
      ...opts,
    })
  },

  warning(message, opts = {}) {
    return sonner.warning(message, {
      duration: opts.duration ?? DEFAULT_DURATION,
      icon: iconEl(AlertTriangle, ACTERO_AMBER),
      description: opts.description,
      ...opts,
    })
  },

  /**
   * Toast with action button — typical Undo pattern.
   * @param {string} message
   * @param {{ actionLabel: string, onAction: () => void, duration?: number, description?: string }} opts
   */
  action(message, opts = {}) {
    const {
      actionLabel = 'Annuler',
      onAction,
      duration = UNDO_DURATION,
      description,
    } = opts
    return sonner(message, {
      duration,
      description,
      action: {
        label: actionLabel,
        onClick: () => {
          try {
            onAction?.()
          } catch (e) {
            console.error('[toast.action] onAction threw:', e)
          }
        },
      },
    })
  },

  /**
   * Promise toast — shows loading, then success/error automatically.
   * @param {Promise<any>} promise
   * @param {{ loading: string, success: string|((v:any)=>string), error: string|((e:any)=>string) }} opts
   */
  promise(promise, opts) {
    return sonner.promise(promise, opts)
  },

  /** Dismiss a toast by id (or all if no id). */
  dismiss(id) {
    return sonner.dismiss(id)
  },

  /** Escape hatch: raw sonner. */
  raw: sonner,
}

export default toast
