import React from 'react'

/**
 * LivePulseDot — Accessiblement-aware animated status dot.
 *
 * Uses `motion-safe:animate-ping` so the pulse is automatically disabled
 * when `prefers-reduced-motion: reduce` is set by the OS/browser.
 *
 * @param {string} [className=''] Additional classes for the outer wrapper.
 * @param {'emerald'|'cta'|'white'} [color='emerald'] Dot colour.
 */
const COLOR_MAP = {
  emerald: 'bg-emerald-500',
  cta: 'bg-cta',
  white: 'bg-white',
}

export function LivePulseDot({ className = '', color = 'emerald' }) {
  const bg = COLOR_MAP[color] || COLOR_MAP.emerald
  return (
    <span className={`relative inline-flex w-1.5 h-1.5 ${className}`}>
      <span
        className={`absolute inset-0 rounded-full ${bg} motion-safe:animate-ping opacity-75`}
        aria-hidden="true"
      />
      <span className={`relative inline-flex w-full h-full rounded-full ${bg}`} />
    </span>
  )
}

export default LivePulseDot
