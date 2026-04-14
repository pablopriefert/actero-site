import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, X, ArrowRight, Loader2 } from 'lucide-react'

/**
 * Pre-activation readiness check modal.
 * Displays the 6 required checks and blocks activation if any is missing.
 *
 * Props:
 *  - isOpen: bool
 *  - onClose: () => void
 *  - onConfirm: () => void  (called when all checks pass and user confirms)
 *  - setActiveTab: (tab) => void  (used by fix buttons)
 *  - checks: array of { id, label, description, met, fixAction?, fixLabel? }
 */
export const WorkflowReadinessCheck = ({ isOpen, onClose, onConfirm, setActiveTab, checks, playbookLabel, loading }) => {
  if (!isOpen) return null

  const allMet = checks.every((c) => c.met)
  const missingCount = checks.filter((c) => !c.met).length

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
                allMet ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {allMet ? 'Prêt' : `${missingCount} élément${missingCount > 1 ? 's' : ''} manquant${missingCount > 1 ? 's' : ''}`}
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
          {checks.map((check) => (
            <div
              key={check.id}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                check.met
                  ? 'border-emerald-100 bg-emerald-50/50'
                  : 'border-amber-200 bg-amber-50/50'
              }`}
            >
              {/* Icon */}
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                check.met ? 'bg-emerald-500' : 'bg-amber-500'
              }`}>
                {check.met ? (
                  <CheckCircle2 className="w-4 h-4 text-white" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-white" />
                )}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${
                  check.met ? 'text-emerald-700' : 'text-[#1a1a1a]'
                }`}>
                  {check.label}
                </p>
                <p className="text-xs text-[#71717a] mt-0.5 leading-relaxed">
                  {check.met ? check.successDescription || check.description : check.description}
                </p>
              </div>

              {/* Fix action */}
              {!check.met && check.fixLabel && (
                <button
                  onClick={() => handleFix(check)}
                  className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#0F5F35] text-white text-[11px] font-semibold hover:bg-[#003725] transition-colors"
                >
                  {check.fixLabel}
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
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
            disabled={!allMet || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0F5F35] text-white text-sm font-semibold hover:bg-[#003725] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
