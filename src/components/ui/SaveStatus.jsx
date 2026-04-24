import React, { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

/**
 * SaveStatus — inline autosave indicator.
 *
 * Renders one of:
 *  - 'dirty'  → amber dot + "Modifications non enregistrées"
 *  - 'saving' → spinner + "Enregistrement…"
 *  - 'saved'  → green dot + "Enregistré il y a Xs" (auto-updates, fades to null after 60s)
 *  - 'idle'   → nothing (null)
 *
 * Uses `role="status"` + `aria-live="polite"` so screen readers announce state
 * transitions without stealing focus. Safe to mount anywhere (no portal).
 *
 * @param {Object} props
 * @param {'dirty' | 'saving' | 'saved' | 'idle'} props.state
 * @param {Date | string | number} [props.savedAt]  Required when state === 'saved'.
 * @param {string} [props.className]
 */
export function SaveStatus({ state = 'idle', savedAt, className = '' }) {
  // We keep "seconds since save" in state rather than recomputing during render —
  // Date.now() inside render body violates the react-hooks/purity rule and would
  // make the component non-idempotent across re-renders.
  // Using a lazy initializer here avoids the cascade-render lint on first mount.
  const [seconds, setSeconds] = useState(() => {
    if (!savedAt) return 0
    return Math.max(0, Math.floor((Date.now() - new Date(savedAt).getTime()) / 1000))
  })

  useEffect(() => {
    if (state !== 'saved' || !savedAt) return undefined
    const savedMs = new Date(savedAt).getTime()
    const id = setInterval(() => {
      setSeconds(Math.max(0, Math.floor((Date.now() - savedMs) / 1000)))
    }, 10_000)
    return () => clearInterval(id)
  }, [state, savedAt])

  if (state === 'idle') return null

  const base = `inline-flex items-center gap-1.5 text-[11px] font-medium tabular-nums ${className}`

  if (state === 'dirty') {
    return (
      <span role="status" aria-live="polite" className={`${base} text-[#8B7A50]`}>
        <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
        Modifications non enregistrées
      </span>
    )
  }

  if (state === 'saving') {
    return (
      <span role="status" aria-live="polite" className={`${base} text-[#71717a]`}>
        <Loader2 aria-hidden="true" className="w-3 h-3 animate-spin" />
        Enregistrement…
      </span>
    )
  }

  // state === 'saved' — after 60s go quiet; stale reassurances are noise.
  if (seconds > 60) return null

  const label =
    seconds < 5
      ? 'à l’instant'
      : seconds < 60
        ? `il y a ${seconds}s`
        : 'il y a 1 min'

  return (
    <span role="status" aria-live="polite" className={`${base} text-[#0E653A]`}>
      <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full bg-[#10B981]" />
      Enregistré {label}
    </span>
  )
}

export default SaveStatus
