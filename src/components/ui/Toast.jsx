import React, { createContext, useContext, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, AlertCircle, X, Info } from 'lucide-react'

const ToastContext = createContext(null)

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

const STYLES = {
  success: 'bg-white border-emerald-200 text-[#262626]',
  error: 'bg-white border-red-200 text-[#262626]',
  info: 'bg-white border-blue-200 text-[#262626]',
}

const ICON_STYLES = {
  success: 'text-[#003725]',
  error: 'text-red-500',
  info: 'text-blue-500',
}

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }
    return id
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const toastFns = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur || 6000),
    info: (msg, dur) => addToast(msg, 'info', dur),
  }

  return (
    <ToastContext.Provider value={toastFns}>
      {children}
      {/* Toast container — fixed bottom-right.
          Two regions so SR announcements match severity:
            - errors: role="alert" + aria-live="assertive"
            - success/info: role="status" + aria-live="polite"
          Both wrap in one visual stack via CSS pointer-events. */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        <div role="status" aria-live="polite" aria-atomic="false" className="flex flex-col gap-2">
          <AnimatePresence>
            {toasts.filter(t => t.type !== 'error').map((t) => {
              const Icon = ICONS[t.type] || ICONS.info
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm ${STYLES[t.type]}`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${ICON_STYLES[t.type]}`} />
                  <p className="text-sm font-medium flex-1">{t.message}</p>
                  <button
                    onClick={() => removeToast(t.id)}
                    className="shrink-0 text-[#716D5C] hover:text-[#262626] transition-colors"
                    aria-label="Fermer la notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
        <div role="alert" aria-live="assertive" aria-atomic="true" className="flex flex-col gap-2">
          <AnimatePresence>
            {toasts.filter(t => t.type === 'error').map((t) => {
              const Icon = ICONS.error
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg max-w-sm ${STYLES.error}`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${ICON_STYLES.error}`} />
                  <p className="text-sm font-medium flex-1">{t.message}</p>
                  <button
                    onClick={() => removeToast(t.id)}
                    className="shrink-0 text-[#716D5C] hover:text-[#262626] transition-colors"
                    aria-label="Fermer la notification"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Silent fallback when used outside the provider — avoids noisy logs in prod.
    const noop = () => {}
    return { success: noop, error: noop, info: noop }
  }
  return ctx
}
