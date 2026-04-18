import React, { useState, useRef, useEffect } from 'react'
import { Flag, Loader2, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useToast } from '../ui/Toast'

const TAGS = [
  { value: 'hallucination', label: 'A inventé des infos', color: '#ef4444' },
  { value: 'tone_off', label: 'Ton inadapté', color: '#f59e0b' },
  { value: 'wrong_classification', label: 'Mauvaise classification', color: '#f59e0b' },
  { value: 'wrong_action', label: 'Mauvaise action', color: '#ef4444' },
  { value: 'needs_review', label: 'À revoir (autre)', color: '#3b82f6' },
  { value: 'correct', label: "En fait c'est bon (unflag)", color: '#10b981' },
]

/**
 * RunTagFlagButton — Bouton "Signaler cette réponse" réutilisable.
 *
 * Ouvre un popover permettant de tagger un run IA avec une des 6 raisons
 * prédéfinies, plus une note libre (max 500 chars). Le POST est envoyé
 * vers /api/admin/flag-run avec le bearer token de l'utilisateur admin courant.
 *
 * @param {Object} props
 * @param {string} props.runId              ID du run à signaler. Requis.
 * @param {Function} [props.onTagged]       Callback après succès (reçoit { tag, note, id }).
 * @param {string} [props.className]        Classes additionnelles sur le wrapper.
 */
export function RunTagFlagButton({ runId, onTagged, className }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [tag, setTag] = useState('hallucination')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const popoverRef = useRef(null)
  const wrapRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const resetForm = () => {
    setTag('hallucination')
    setNote('')
    setSubmitting(false)
  }

  const handleSubmit = async () => {
    if (!runId || submitting) return
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        toast.error('Session expirée, reconnectez-vous')
        setSubmitting(false)
        return
      }

      const res = await fetch('/api/admin/flag-run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ run_id: runId, tag, note: note.trim() || undefined }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err?.error || 'Échec du signalement')
        setSubmitting(false)
        return
      }

      const data = await res.json().catch(() => ({}))
      toast.success('Signalé')
      setOpen(false)
      resetForm()
      if (typeof onTagged === 'function') {
        onTagged({ tag, note: note.trim() || null, id: data?.id || null })
      }
    } catch (err) {
      console.error('[RunTagFlagButton] submit error', err)
      toast.error('Erreur réseau')
      setSubmitting(false)
    }
  }

  return (
    <div ref={wrapRef} className={`relative inline-block ${className || ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1 text-[11px] font-semibold transition-colors"
      >
        <Flag className="w-3 h-3" />
        Signaler
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={popoverRef}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.12)] border border-[#f0f0f0] p-4 w-80"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="text-[13px] font-semibold text-[#1a1a1a]">Signaler cette réponse</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-6 h-6 rounded-md text-[#9ca3af] hover:text-[#1a1a1a] hover:bg-[#fafafa] flex items-center justify-center transition-colors"
                aria-label="Fermer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 mb-3">
              {TAGS.map((t) => {
                const selected = tag === t.value
                return (
                  <label
                    key={t.value}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors text-[12px] ${
                      selected ? 'bg-[#fafafa]' : 'hover:bg-[#fafafa]'
                    }`}
                  >
                    <input
                      type="radio"
                      name={`flag-tag-${runId}`}
                      value={t.value}
                      checked={selected}
                      onChange={() => setTag(t.value)}
                      className="sr-only"
                    />
                    <span
                      className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                        selected ? 'border-cta' : 'border-[#f0f0f0]'
                      }`}
                    >
                      {selected && <span className="w-1.5 h-1.5 rounded-full bg-cta" />}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                    <span className="text-[#1a1a1a] flex-1 truncate">{t.label}</span>
                  </label>
                )
              })}
            </div>

            <div className="mb-3">
              <label className="block text-[11px] font-medium text-[#71717a] mb-1">
                Note (optionnel)
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Contexte, détails, ce qui aurait dû être fait…"
                className="w-full text-[12px] text-[#1a1a1a] bg-[#fafafa] border border-[#f0f0f0] rounded-lg px-2.5 py-2 resize-none focus:outline-none focus:border-cta/30 focus:bg-white transition-colors"
              />
              <div className="text-[10px] text-[#9ca3af] text-right mt-0.5 tabular-nums">
                {note.length}/500
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  resetForm()
                }}
                disabled={submitting}
                className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#71717a] hover:bg-[#fafafa] transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cta hover:bg-[#0b4a29] text-white text-[12px] font-semibold transition-colors disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                Signaler
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default RunTagFlagButton
