import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bug, X, Loader2, Check, AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * Floating "Report bug" button for the client dashboard.
 * Sends a report with the current URL + description to admins.
 */
export const ReportErrorButton = () => {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState('')

  const collectContext = () => {
    try {
      return {
        user_agent: navigator.userAgent,
        viewport: { w: window.innerWidth, h: window.innerHeight },
        timestamp: new Date().toISOString(),
        path: window.location.pathname + window.location.search,
        referrer: document.referrer || null,
      }
    } catch {
      return {}
    }
  }

  const submit = async () => {
    if (description.trim().length < 5) {
      setErrorMsg('Décrivez brièvement le problème (min. 5 caractères)')
      return
    }
    setStatus('sending')
    setErrorMsg('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/client/report-error', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          description: description.trim(),
          url: window.location.href,
          context: collectContext(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur')
      setStatus('sent')
      setTimeout(() => {
        setOpen(false)
        setDescription('')
        setStatus('idle')
      }, 1800)
    } catch (err) {
      setStatus('error')
      setErrorMsg(err.message)
    }
  }

  return (
    <>
      {/* Floating button (bottom-left so it doesn't overlap with Copilot bubble on bottom-right) */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            title="Signaler un problème"
            className="fixed bottom-6 left-6 z-40 w-11 h-11 rounded-full bg-white border border-gray-200 text-[#71717a] shadow-md hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all flex items-center justify-center"
          >
            <Bug className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Report modal */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => status !== 'sending' && setOpen(false)}
            className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                    <Bug className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#1a1a1a]">Signaler un problème</h3>
                    <p className="text-xs text-[#71717a]">Envoyé directement aux fondateurs</p>
                  </div>
                </div>
                <button
                  onClick={() => status !== 'sending' && setOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <X className="w-4 h-4 text-[#71717a]" />
                </button>
              </div>

              {status === 'sent' ? (
                <div className="py-8 text-center">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                    <Check className="w-7 h-7 text-emerald-500" />
                  </div>
                  <p className="text-sm font-semibold text-[#1a1a1a]">Signalement envoyé</p>
                  <p className="text-xs text-[#71717a] mt-1">Nous vous répondons sous 24h.</p>
                </div>
              ) : (
                <>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={status === 'sending'}
                    rows={5}
                    placeholder="Décrivez le problème rencontré (page, action tentée, message d'erreur si visible)…"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 resize-none"
                    autoFocus
                  />

                  <div className="mt-3 text-[11px] text-[#9ca3af] bg-gray-50 rounded-lg px-3 py-2">
                    Inclus automatiquement : URL actuelle, navigateur, taille d'écran, horodatage.
                  </div>

                  {errorMsg && (
                    <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      {errorMsg}
                    </div>
                  )}

                  <button
                    onClick={submit}
                    disabled={status === 'sending' || !description.trim()}
                    className="w-full mt-4 py-2.5 rounded-xl bg-[#0F5F35] text-white text-sm font-semibold hover:bg-[#003725] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {status === 'sending' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Envoi…
                      </>
                    ) : (
                      'Envoyer le signalement'
                    )}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
