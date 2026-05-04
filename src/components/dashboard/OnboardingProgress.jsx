import React, { useEffect, useState, useRef, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, Loader2, Sparkles, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * OnboardingProgress — polls /api/jobs/:id for an E2B onboarding job and
 * renders a live progress bar.
 *
 * Used on:
 *   - /shopify-success (right after OAuth) — shows that the engine is
 *     ingesting the merchant's catalog in the background
 *   - /client (dashboard banner) — re-shown if onboarding is still in
 *     progress when the merchant first lands on the dashboard
 *
 * Props:
 *   - jobId       (required) — UUID of the e2b_jobs row
 *   - onComplete  (optional) — called once when status flips to 'completed'
 *   - compact     (optional) — when true, renders a slim banner instead of card
 */
export function OnboardingProgress({ jobId, onComplete, compact = false }) {
  const [job, setJob] = useState(null)
  const [error, setError] = useState(null)
  const [dismissed, setDismissed] = useState(false)
  const completedRef = useRef(false)

  const fetchJob = useCallback(async () => {
    if (!jobId) return
    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) return

      const res = await fetch(`/api/jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body?.error || `HTTP ${res.status}`)
        return
      }

      const data = await res.json()
      setJob(data)
      setError(null)

      if (data.status === 'completed' && !completedRef.current) {
        completedRef.current = true
        if (typeof onComplete === 'function') onComplete(data)
      }
    } catch (err) {
      setError(err.message || 'Network error')
    }
  }, [jobId, onComplete])

  useEffect(() => {
    if (!jobId || dismissed) return
    fetchJob()
    const interval = setInterval(fetchJob, 5000)
    return () => clearInterval(interval)
  }, [jobId, dismissed, fetchJob])

  if (!jobId || dismissed) return null

  const status = job?.status || 'queued'
  const progress = Math.max(0, Math.min(100, job?.progress ?? 0))
  const message = job?.progress_message || 'Démarrage…'
  const isFinal = ['completed', 'failed', 'timeout', 'cancelled'].includes(status)
  const isError = ['failed', 'timeout'].includes(status)

  if (compact) {
    if (status === 'completed' && completedRef.current) return null
    return (
      <div className="rounded-xl border border-cta/30 bg-cta/5 px-4 py-3 flex items-center gap-3">
        <Loader2 className={`w-4 h-4 text-cta ${!isFinal ? 'animate-spin' : ''}`} />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-medium text-[#1a1a1a] truncate">
            {isError ? 'Onboarding échoué' : `Onboarding en cours · ${progress}%`}
          </div>
          <div className="text-[11px] text-[#6b6b6b] truncate">{message}</div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Masquer"
          className="text-[#9ca3af] hover:text-[#1a1a1a]"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-6">
      <div className="flex items-start gap-4">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          isError ? 'bg-red-500/20' : status === 'completed' ? 'bg-emerald-500/20' : 'bg-cta/20'
        }`}>
          {isError ? (
            <AlertTriangle className="w-5 h-5 text-red-400" />
          ) : status === 'completed' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <Sparkles className="w-5 h-5 text-cta" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-white">
            {isError && 'Onboarding interrompu'}
            {status === 'completed' && 'Engine prêt à répondre'}
            {!isFinal && 'Préparation de votre engine IA'}
          </h3>
          <p className="text-sm text-gray-400 mt-1 leading-relaxed">
            {isError && (job?.error || 'Une erreur est survenue. Vous pouvez relancer l\'onboarding depuis la page Intégrations.')}
            {status === 'completed' && (
              job?.result?.products_imported
                ? `${job.result.products_imported} produits + ${job.result.policies_imported || 0} politiques importés en base.`
                : 'Votre boutique est synchronisée. L\'engine peut traiter vos premiers tickets.'
            )}
            {!isFinal && message}
          </p>

          {/* Progress bar */}
          {!isFinal && (
            <div className="mt-4">
              <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-cta transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <div className="flex items-center justify-between mt-2 text-[11px] text-gray-500">
                <span>{progress}% terminé</span>
                <span>Mise à jour toutes les 5 secondes</span>
              </div>
            </div>
          )}

          {/* Failure CTA */}
          {isError && (
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => window.location.assign('/client/integrations')}
                className="text-[12px] font-medium text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
              >
                Aller aux intégrations
              </button>
            </div>
          )}

          {error && (
            <p className="mt-3 text-[11px] text-red-400">Erreur de polling : {error}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default OnboardingProgress
