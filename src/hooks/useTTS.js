import { useState, useRef, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * useTTS — streaming playback hook for Actero's text-to-speech.
 *
 * Calls POST /api/text-to-speech with Bearer JWT, streams MP3 back as a blob,
 * and plays it via the Web Audio API. Handles idle / loading / playing / error
 * states + proper cleanup (revokes blob URLs, cancels in-flight fetches on
 * unmount).
 *
 * Returns:
 *   {
 *     play(text, id?)  — synthesize + play. If id matches currently playing,
 *                        toggles off.
 *     stop()           — stop any current playback immediately
 *     state            — 'idle' | 'loading' | 'playing' | 'error'
 *     playingId        — id currently playing (or null)
 *     error            — last error message (or null)
 *     isLoading        — bool
 *     isPlaying        — bool
 *   }
 */
export function useTTS({ endpoint = '/api/text-to-speech' } = {}) {
  const [state, setState] = useState('idle') // idle | loading | playing | error
  const [playingId, setPlayingId] = useState(null)
  const [error, setError] = useState(null)

  const audioRef = useRef(null)
  const urlRef = useRef(null)
  const abortRef = useRef(null)

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      try { audioRef.current.pause() } catch { /* noop */ }
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current = null
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    if (abortRef.current) {
      try { abortRef.current.abort() } catch { /* noop */ }
      abortRef.current = null
    }
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  const stop = useCallback(() => {
    cleanup()
    setState('idle')
    setPlayingId(null)
  }, [cleanup])

  const play = useCallback(async (text, id = 'default') => {
    // Toggle off if same id is currently playing
    if (playingId === id && state === 'playing') {
      stop()
      return
    }

    cleanup()
    setError(null)
    setPlayingId(id)
    setState('loading')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Session expirée')

      const controller = new AbortController()
      abortRef.current = controller

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        throw new Error(errBody.error || `TTS ${res.status}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      urlRef.current = url

      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => {
        setState('idle')
        setPlayingId(null)
        if (urlRef.current === url) {
          URL.revokeObjectURL(url)
          urlRef.current = null
        }
        audioRef.current = null
      }
      audio.onerror = () => {
        setError('Lecture impossible')
        setState('error')
        setPlayingId(null)
        cleanup()
      }

      await audio.play()
      setState('playing')
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Erreur TTS')
        setState('error')
        setPlayingId(null)
      }
      cleanup()
    }
  }, [cleanup, endpoint, playingId, state, stop])

  return {
    play,
    stop,
    state,
    playingId,
    error,
    isLoading: state === 'loading',
    isPlaying: state === 'playing',
    isError: state === 'error',
  }
}

/**
 * generateAndUploadAudio — one-shot helper that calls /api/tts/generate-upload
 * and returns a public audio URL suitable for embedding in emails / messages.
 *
 * Used by the Escalations flow ("Joindre un message vocal").
 */
export async function generateAndUploadAudio({ text, conversationId, purpose = 'escalation_reply', voiceId = null }) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Session expirée')

  const res = await fetch('/api/tts/generate-upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      text,
      conversation_id: conversationId || null,
      purpose,
      voice_id: voiceId || null,
    }),
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}))
    throw new Error(errBody.error || `TTS upload ${res.status}`)
  }

  return await res.json() // { audio_url, path, bytes, voice_id }
}
