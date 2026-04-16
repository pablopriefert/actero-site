import React from 'react'
import { Loader2, Volume2, Square, AlertCircle } from 'lucide-react'

/**
 * TTSButton — premium play/stop button wired to the useTTS hook.
 *
 * Props:
 *   text       — the text to synthesize (required)
 *   id         — unique id for this button (to coordinate with other players)
 *   tts        — the useTTS() return value (pass from parent so multiple
 *                buttons share the same playback state)
 *   size       — 'sm' | 'md' (default 'sm')
 *   variant    — 'soft' | 'ghost' (default 'soft')
 *   label      — custom idle label (default "Écouter la réponse")
 *   className  — extra classes
 */
export const TTSButton = ({
  text,
  id = 'default',
  tts,
  size = 'sm',
  variant = 'soft',
  label = 'Écouter la réponse',
  className = '',
}) => {
  const isThisPlaying = tts.isPlaying && tts.playingId === id
  const isThisLoading = tts.isLoading && tts.playingId === id
  const isThisError = tts.isError && tts.playingId === id

  const sizeClasses = size === 'md'
    ? 'h-8 px-3 text-[12px] gap-1.5'
    : 'h-7 px-2.5 text-[11px] gap-1.5'
  const iconSize = size === 'md' ? 'w-3.5 h-3.5' : 'w-3 h-3'

  const stateClasses = isThisPlaying
    ? 'bg-[#0F5F35]/12 border-[#0F5F35]/25 text-[#0F5F35]'
    : isThisLoading
      ? 'bg-[#0F5F35]/8 border-[#0F5F35]/20 text-[#0F5F35]'
      : isThisError
        ? 'bg-red-50 border-red-200 text-red-600'
        : variant === 'ghost'
          ? 'bg-transparent border-transparent text-[#71717a] hover:bg-[#fafafa] hover:text-[#1a1a1a]'
          : 'bg-white border-[#f0f0f0] text-[#71717a] hover:bg-[#0F5F35]/[0.04] hover:border-[#0F5F35]/20 hover:text-[#0F5F35]'

  const handleClick = () => {
    if (!text || !text.trim()) return
    tts.play(text, id)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isThisLoading}
      aria-label={isThisPlaying ? 'Arrêter la lecture' : label}
      aria-pressed={isThisPlaying}
      className={`inline-flex items-center rounded-full font-semibold border transition-all disabled:cursor-not-allowed ${sizeClasses} ${stateClasses} ${className}`}
    >
      {isThisLoading ? (
        <>
          <Loader2 className={`${iconSize} animate-spin`} />
          <span>Génération audio…</span>
        </>
      ) : isThisPlaying ? (
        <>
          <Square className={iconSize} />
          <span>Arrêter</span>
        </>
      ) : isThisError ? (
        <>
          <AlertCircle className={iconSize} />
          <span>Réessayer</span>
        </>
      ) : (
        <>
          <Volume2 className={iconSize} />
          <span>{label}</span>
        </>
      )}
    </button>
  )
}
