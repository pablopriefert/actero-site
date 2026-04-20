import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, X, ArrowRight, Loader2 } from 'lucide-react'

/**
 * Pre-activation readiness check modal.
 * Displays the required checks and blocks activation if any REQUIRED check
 * is missing. Les checks marqués `optional: true` sont affichés en warning
 * mais ne bloquent pas l'activation (badge "Optionnel" + fix button soft).
 *
 * Props:
 *  - isOpen: bool
 *  - onClose: () => void
 *  - onConfirm: () => void  (called when all required checks pass and user confirms)
 *  - setActiveTab: (tab) => void  (used by fix buttons)
 *  - checks: array of { id, label, description, met, optional?, fixTab?, fixLabel? }
 */
export const WorkflowReadinessCheck = ({ isOpen, onClose, onConfirm, setActiveTab, checks, playbookLabel, loading }) => {
  if (!isOpen) return null

  // Seuls les checks NON optionnels bloquent l'activation
  const requiredChecks = checks.filter((c) => !c.optional)
  const allRequiredMet = requiredChecks.every((c) => c.met)
  const missingRequiredCount = requiredChecks.filter((c) => !c.met).length
  const missingOptionalCount = checks.filter((c) => c.optional && !c.met).length

  const handleFix = (check) => {
    if (check.fixTab) {
      setActiveTab?.(check.fixTab)
      onClose()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-start justify-between">
            <div>
              <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider mb-2 ${
                allRequiredMet
                  ? (missingOptionalCount > 0 ? 'bg-blue-50 text-blue-600' : 'bg-emerald-50 text-emerald-600')
                  : 'bg-amber-50 text-amber-600'
              }`}>
                {allRequiredMet
                  ? (missingOptionalCount > 0
                      ? `Prêt · ${missingOptionalCount} optionnel${missingOptionalCount > 1 ? 's' : ''}`
                      : 'Prêt')
                  : `${missingRequiredCount} élément${missingRequiredCount > 1 ? 's' : ''} manquant${missingRequiredCount > 1 ? 's' : ''}`}
              </div>
              <h3 className="text-base font-bold text-[#1a1a1a]">
                Vérification avant activation
              </h3>
              <p className="text-xs text-[#71717a] mt-0.5">
                {playbookLabel}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-gray-100"
            >
              <X className="w-4 h-4 text-[#71717a]" />
            </button>
          </div>
        </div>

        {/* Checks list */}
        <div className="p-6 space-y-2">
          {checks.map((check) => {
            const isOptionalUnmet = check.optional && !check.met
            return (
              <div
                key={check.id}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                  check.met
                    ? 'border-emerald-100 bg-emerald-50/50'
                    : isOptionalUnmet
                      ? 'border-blue-100 bg-blue-50/50'
                      : 'border-amber-200 bg-amber-50/50'
                }`}
              >
                {/* Icon */}
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  check.met
                    ? 'bg-emerald-500'
                    : isOptionalUnmet
                      ? 'bg-blue-500'
                      : 'bg-amber-500'
                }`}>
                  {check.met ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-white" />
                  )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-sm font-semibold ${
                      check.met ? 'text-emerald-700' : 'text-[#1a1a1a]'
                    }`}>
                      {check.label}
                    </p>
                    {check.optional && !check.met && (
                      <span className="inline-flex px-1.5 py-0.5 rounded-md bg-white border border-blue-200 text-[9px] font-bold text-blue-600 uppercase tracking-wider">
                        Optionnel
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#71717a] mt-0.5 leading-relaxed">
                    {check.met ? check.successDescription || check.description : check.description}
                  </p>
                </div>

                {/* Fix action */}
                {!check.met && check.fixLabel && (
                  <button
                    onClick={() => handleFix(check)}
                    className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
                      isOptionalUnmet
                        ? 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-50'
                        : 'bg-cta text-white hover:bg-[#003725]'
                    }`}
                  >
                    {check.fixLabel}
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-[#71717a] hover:bg-gray-50 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={!allRequiredMet || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cta text-white text-sm font-semibold hover:bg-[#003725] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Activation…
              </>
            ) : (
              <>
                Activer le workflow
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
