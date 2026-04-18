import React, { useState, useEffect, useRef } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * TypedConfirmModal — typed-confirmation for destructive actions.
 *
 * User must type `confirmText` exactly to enable the destructive button,
 * same pattern as GitHub repo deletion. Prevents both:
 *  - accidental double-clicks on a plain confirm dialog
 *  - muscle-memory "OK" on native `window.confirm()`
 *
 * Renders as modal (role="dialog" aria-modal) with focus trap via autoFocus
 * on the input and focus return on close. Esc closes.
 *
 * Usage:
 *   <TypedConfirmModal
 *     open={showConfirm}
 *     onClose={() => setShowConfirm(false)}
 *     onConfirm={async () => { await deleteClient(client.id); setShowConfirm(false) }}
 *     title="Supprimer le client ?"
 *     description="Cette action est définitive. Toutes les données seront perdues."
 *     confirmText={client.brand_name}
 *     confirmLabel="Supprimer définitivement"
 *   />
 */
export function TypedConfirmModal({
  open,
  onClose,
  onConfirm,
  title = 'Confirmer l\'action',
  description,
  confirmText,              // the string the user must type exactly
  confirmLabel = 'Confirmer',
  cancelLabel = 'Annuler',
  tone = 'danger',          // 'danger' | 'warning'
}) {
  const [typed, setTyped] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const previousFocus = useRef(null)

  // Reset state on close. Preserve focus ownership for screen readers.
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement
      setTyped('')
      setLoading(false)
    } else if (previousFocus.current && typeof previousFocus.current.focus === 'function') {
      // Return focus to the trigger element on close
      previousFocus.current.focus()
    }
  }, [open])

  // Escape closes (unless an action is in-flight)
  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (e.key === 'Escape' && !loading) {
        onClose?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, loading, onClose])

  const matches = typed === confirmText
  const disabled = !matches || loading

  const handleConfirm = async () => {
    if (!matches || loading) return
    setLoading(true)
    try {
      await onConfirm?.()
    } finally {
      setLoading(false)
    }
  }

  const toneStyles = tone === 'danger'
    ? { iconBg: 'bg-red-50', iconColor: 'text-red-500', button: 'bg-red-500 hover:bg-red-600', ring: 'focus:ring-red-200' }
    : { iconBg: 'bg-amber-50', iconColor: 'text-amber-500', button: 'bg-amber-500 hover:bg-amber-600', ring: 'focus:ring-amber-200' }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !loading && onClose?.()}
            aria-hidden="true"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="typed-confirm-title"
            aria-describedby="typed-confirm-desc"
            className="relative w-full max-w-md bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.24)] border border-[#f0f0f0] overflow-hidden"
          >
            {/* Close button */}
            <button
              onClick={() => !loading && onClose?.()}
              disabled={loading}
              aria-label="Fermer la boîte de dialogue"
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-[#9ca3af] hover:text-[#1a1a1a] hover:bg-[#fafafa] transition-colors disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6">
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${toneStyles.iconBg}`}>
                  <AlertTriangle className={`w-5 h-5 ${toneStyles.iconColor}`} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0 pr-6">
                  <h2 id="typed-confirm-title" className="text-[16px] font-semibold text-[#1a1a1a] mb-1 tracking-tight">
                    {title}
                  </h2>
                  {description && (
                    <p id="typed-confirm-desc" className="text-[13px] text-[#71717a] leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>
              </div>

              <label className="block text-[12px] font-medium text-[#71717a] mb-1.5">
                Pour confirmer, tapez <code className="font-mono text-[#1a1a1a] bg-[#fafafa] border border-[#f0f0f0] px-1.5 py-0.5 rounded text-[11px]">{confirmText}</code> ci-dessous :
              </label>
              <input
                ref={inputRef}
                autoFocus
                type="text"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && matches && !loading) {
                    e.preventDefault()
                    handleConfirm()
                  }
                }}
                aria-label={`Tapez ${confirmText} pour confirmer`}
                className={`w-full px-3 py-2 rounded-xl border text-[14px] font-mono transition-colors focus:outline-none focus:ring-2 ${toneStyles.ring} ${
                  typed === ''
                    ? 'border-[#e5e5e5] bg-white'
                    : matches
                      ? 'border-emerald-300 bg-emerald-50/30'
                      : 'border-red-200 bg-red-50/20'
                }`}
              />

              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  onClick={() => !loading && onClose?.()}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-[13px] font-semibold text-[#71717a] hover:bg-[#fafafa] transition-colors disabled:opacity-50"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={disabled}
                  aria-disabled={disabled}
                  className={`px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${toneStyles.button}`}
                >
                  {loading ? 'Traitement…' : confirmLabel}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
