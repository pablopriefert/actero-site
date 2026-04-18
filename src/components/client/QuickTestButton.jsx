import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Zap,
  ArrowRight,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const TEST_SCENARIOS = [
  {
    id: 'delivery',
    label: 'Délais de livraison',
    message: 'Quels sont vos délais de livraison ?',
  },
  {
    id: 'return',
    label: 'Retour article',
    message: 'Je voudrais retourner mon article',
  },
  {
    id: 'size',
    label: 'Disponibilité produit',
    message: 'Avez-vous ce produit en taille M ?',
  },
]

/**
 * QuickTestButton — one-click agent smoke test.
 * Runs 3 sample scenarios in sequence against /api/engine/gateway
 * and displays a per-test timeline plus a summary.
 */
export const QuickTestButton = ({ clientId, setActiveTab }) => {
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState([]) // [{id,label,message,status,response,duration,confidence,error}]
  const [summary, setSummary] = useState(null)

  const runSingleTest = async (scenario) => {
    const startTime = Date.now()
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const res = await fetch('/api/engine/gateway', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          event_type: 'widget_message',
          source: 'widget_message',
          customer_email: 'quicktest@actero-test.com',
          customer_name: 'Quick Test',
          message: scenario.message,
          subject: scenario.label,
          session_id: `quicktest-${Date.now()}`,
          is_test: true,
        }),
      })

      const data = await res.json().catch(() => ({}))
      const duration = Date.now() - startTime

      if (!res.ok) {
        return {
          ...scenario,
          status: 'error',
          error: data?.error || `HTTP ${res.status}`,
          duration,
        }
      }

      // no_playbook is not an error but means config missing
      if (data?.status === 'no_playbook') {
        return {
          ...scenario,
          status: 'warn',
          response: data.message || 'Aucun playbook actif',
          duration,
        }
      }

      return {
        ...scenario,
        status: 'ok',
        response: data?.response || '—',
        classification: data?.classification,
        confidence: data?.confidence,
        duration: data?.duration_ms || duration,
      }
    } catch (err) {
      return {
        ...scenario,
        status: 'error',
        error: err.message,
        duration: Date.now() - startTime,
      }
    }
  }

  const startTests = async () => {
    setRunning(true)
    setResults([])
    setSummary(null)

    const collected = []
    for (const scenario of TEST_SCENARIOS) {
      // seed placeholder so UI shows loader for this step
      setResults((prev) => [...prev, { ...scenario, status: 'loading' }])
      const result = await runSingleTest(scenario)
      collected.push(result)
      setResults((prev) => {
        const copy = [...prev]
        copy[copy.length - 1] = result
        return copy
      })
    }

    // Build summary
    const okCount = collected.filter((r) => r.status === 'ok').length
    const avgDuration =
      collected.reduce((s, r) => s + (r.duration || 0), 0) / collected.length
    const confidences = collected
      .map((r) => r.confidence)
      .filter((c) => typeof c === 'number')
    const avgConfidence =
      confidences.length > 0
        ? confidences.reduce((s, c) => s + c, 0) / confidences.length
        : null

    setSummary({
      operational: okCount === collected.length,
      okCount,
      total: collected.length,
      avgDurationMs: Math.round(avgDuration),
      avgConfidence,
    })
    setRunning(false)
  }

  const handleOpen = () => {
    setOpen(true)
    setResults([])
    setSummary(null)
    // Auto-start
    setTimeout(() => startTests(), 250)
  }

  const handleClose = () => {
    if (running) return
    setOpen(false)
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        disabled={!clientId}
        className="inline-flex items-center gap-2 px-4 py-2.5 bg-cta hover:bg-[#003725] text-white text-[13px] font-semibold rounded-xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-cta disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Play className="w-4 h-4 fill-white" />
        Tester mon agent
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={handleClose}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl border border-[#f0f0f0] w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#f0f0f0] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cta/10 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-cta" />
                  </div>
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#1a1a1a]">
                      Test rapide de l'agent
                    </h3>
                    <p className="text-[12px] text-[#9ca3af]">
                      3 scénarios SAV e-commerce en temps réel
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  disabled={running}
                  className="p-1.5 rounded-lg hover:bg-[#fafafa] text-[#9ca3af] hover:text-[#1a1a1a] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body — test list */}
              <div className="px-6 py-5 overflow-y-auto flex-1 space-y-3">
                {results.length === 0 && (
                  <div className="flex items-center justify-center py-8 text-[13px] text-[#9ca3af]">
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Préparation des tests...
                  </div>
                )}

                {results.map((r, idx) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-[#fafafa] rounded-xl border border-[#f0f0f0] p-4"
                  >
                    <div className="flex items-start gap-3">
                      {/* Status icon */}
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                        {r.status === 'loading' && (
                          <Loader2 className="w-4 h-4 text-cta animate-spin" />
                        )}
                        {r.status === 'ok' && (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        )}
                        {r.status === 'warn' && (
                          <AlertCircle className="w-5 h-5 text-amber-500" />
                        )}
                        {r.status === 'error' && (
                          <AlertCircle className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12px] font-semibold text-[#1a1a1a]">
                            {r.label}
                          </p>
                          {r.duration && r.status !== 'loading' && (
                            <span className="text-[10px] text-[#9ca3af] tabular-nums flex-shrink-0">
                              {r.duration} ms
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#9ca3af] mt-0.5 italic">
                          « {r.message} »
                        </p>

                        {r.status === 'ok' && r.response && (
                          <div className="mt-2 p-2.5 bg-white rounded-lg border border-[#f0f0f0]">
                            <p className="text-[12px] text-[#1a1a1a] leading-relaxed line-clamp-4">
                              {r.response}
                            </p>
                            {typeof r.confidence === 'number' && (
                              <p className="text-[10px] text-[#9ca3af] mt-1.5">
                                Confiance : {Math.round(r.confidence * 100)}%
                              </p>
                            )}
                          </div>
                        )}
                        {r.status === 'warn' && (
                          <p className="mt-2 text-[11px] text-amber-600">
                            {r.response}
                          </p>
                        )}
                        {r.status === 'error' && (
                          <p className="mt-2 text-[11px] text-red-500">
                            {r.error}
                          </p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Footer — summary */}
              <AnimatePresence>
                {summary && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border-t border-[#f0f0f0] px-6 py-4 bg-[#fafafa]"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        {summary.operational ? (
                          <>
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-[#1a1a1a]">
                                Votre agent est opérationnel !
                              </p>
                              <p className="text-[11px] text-[#9ca3af]">
                                {summary.okCount}/{summary.total} tests réussis
                                · {summary.avgDurationMs} ms en moyenne
                                {summary.avgConfidence !== null && (
                                  <>
                                    {' · '}
                                    {Math.round(summary.avgConfidence * 100)}%
                                    confiance
                                  </>
                                )}
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                              <AlertCircle className="w-5 h-5 text-amber-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-[#1a1a1a]">
                                Configuration nécessaire
                              </p>
                              <p className="text-[11px] text-[#9ca3af]">
                                {summary.okCount}/{summary.total} tests réussis
                                — ajustez votre agent pour améliorer les
                                résultats.
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                      {!summary.operational && (
                        <button
                          onClick={() => {
                            setOpen(false)
                            setActiveTab('agent-config')
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 bg-cta hover:bg-[#003725] text-white text-[12px] font-semibold rounded-lg transition-colors flex-shrink-0"
                        >
                          Mon Agent <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default QuickTestButton
