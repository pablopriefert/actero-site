import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Mic, MicOff, Loader2, PhoneOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const WIDGET_SCRIPT_SRC = 'https://elevenlabs.io/convai-widget/index.js'
const WIDGET_SCRIPT_ID = 'elevenlabs-convai-widget-script'

// Dynamically load the ElevenLabs widget script once
const ensureWidgetScript = () => {
  if (typeof window === 'undefined') return
  if (document.getElementById(WIDGET_SCRIPT_ID)) return
  const s = document.createElement('script')
  s.id = WIDGET_SCRIPT_ID
  s.src = WIDGET_SCRIPT_SRC
  s.async = true
  s.type = 'text/javascript'
  document.body.appendChild(s)
}

export const VoiceTestModal = ({ clientId, agentId, onClose }) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [signedUrl, setSignedUrl] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const [started, setStarted] = useState(false)
  const containerRef = useRef(null)
  const timerRef = useRef(null)

  // Fetch signed url on mount
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/voice/test-call', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({ client_id: clientId }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || 'Impossible de demarrer le test')
        if (!cancelled) {
          setSignedUrl(json.signed_url || null)
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Erreur inconnue')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    ensureWidgetScript()
    return () => {
      cancelled = true
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [clientId])

  // Inject custom element once agentId is known
  useEffect(() => {
    if (!agentId || !containerRef.current) return
    // Clean any previous child
    containerRef.current.innerHTML = ''
    const el = document.createElement('elevenlabs-convai')
    el.setAttribute('agent-id', agentId)
    if (signedUrl) el.setAttribute('signed-url', signedUrl)
    containerRef.current.appendChild(el)
    return () => {
      if (containerRef.current) containerRef.current.innerHTML = ''
    }
  }, [agentId, signedUrl])

  const handleStart = () => {
    setStarted(true)
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed((v) => v + 1), 1000)
  }

  const handleStop = () => {
    setStarted(false)
    if (timerRef.current) clearInterval(timerRef.current)
  }

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-[#f0f0f0] flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-[#1a1a1a]">Test de l'agent vocal</h3>
            <p className="text-[11px] text-[#9ca3af] mt-0.5">
              Parlez a votre agent IA directement depuis votre navigateur
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-[#fafafa] rounded-lg">
            <X className="w-4 h-4 text-[#9ca3af]" />
          </button>
        </div>

        <div className="px-6 py-8 flex flex-col items-center">
          {loading && (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-cta" />
              <p className="text-[12px] text-[#9ca3af] mt-3">Preparation du test...</p>
            </div>
          )}

          {error && !loading && (
            <div className="w-full p-4 rounded-xl bg-red-50 border border-red-200 text-[12px] text-red-700">
              {error}
            </div>
          )}

          {!loading && !error && (
            <>
              {/* Pulsing mic */}
              <div className="relative mb-6">
                {started && (
                  <>
                    <span className="absolute inset-0 rounded-full bg-cta/20 animate-ping" />
                    <span className="absolute inset-0 rounded-full bg-cta/10 animate-pulse" />
                  </>
                )}
                <div className={`relative w-24 h-24 rounded-full flex items-center justify-center ${
                  started ? 'bg-cta' : 'bg-cta/10'
                }`}>
                  {started ? (
                    <Mic className="w-10 h-10 text-white" />
                  ) : (
                    <Mic className="w-10 h-10 text-cta" />
                  )}
                </div>
              </div>

              {started && (
                <p className="text-[28px] font-mono font-semibold text-[#1a1a1a] mb-4">
                  {formatTime(elapsed)}
                </p>
              )}

              {/* ElevenLabs widget container */}
              <div
                ref={containerRef}
                className="w-full flex justify-center mb-4 min-h-[80px]"
              />

              <div className="flex gap-3">
                {!started ? (
                  <button
                    onClick={handleStart}
                    disabled={!agentId}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-cta hover:bg-[#0c4e2b] disabled:opacity-50 text-white text-[13px] font-semibold transition-colors"
                  >
                    <Mic className="w-4 h-4" />
                    Demarrer la conversation
                  </button>
                ) : (
                  <button
                    onClick={handleStop}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-red-500 hover:bg-red-600 text-white text-[13px] font-semibold transition-colors"
                  >
                    <PhoneOff className="w-4 h-4" />
                    Raccrocher
                  </button>
                )}
              </div>

              {!started && elapsed > 0 && (
                <p className="text-[12px] text-[#9ca3af] mt-4">
                  Test termine. Duree : {formatTime(elapsed)}
                </p>
              )}

              <p className="text-[11px] text-[#9ca3af] mt-6 text-center max-w-sm">
                En cliquant sur Demarrer, votre navigateur demandera l'acces au microphone.
                Utilisez le widget ElevenLabs integre pour interagir avec votre agent.
              </p>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
