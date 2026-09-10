import React, { useState } from 'react'
import { PlayCircle } from 'lucide-react'
import { VideoModal } from './VideoModal'
import { DEMO_VIDEO } from '../../config/demo'
import { trackEvent } from '../../lib/analytics'

/**
 * WatchDemoButton — CTA secondaire qui ouvre le modal vidéo démo.
 *
 * Règles UX (ui-ux-pro-max) respectées :
 *   - `touch-target-size` : h-[44px] mini via padding
 *   - `primary-action` : style light/dark/ghost pour rester secondaire
 *   - `press-feedback` : hover + focus-visible ring
 *   - `cursor-pointer` : implicite via <button>
 *   - `aria-label` : explicite sur le bouton
 *   - Motion réduit pris en charge par VideoModal
 *
 * Props :
 *   - source (string) — identifiant Amplitude (ex: "landing_hero")
 *   - variant (light | dark) — défaut light (fond clair)
 *   - label (string, optionnel) — override du label ("Voir la démo (90s)")
 */
export function WatchDemoButton({ source, variant = 'light', label, className = '' }) {
  const [open, setOpen] = useState(false)

  const handleOpen = () => {
    trackEvent('Demo_Video_Opened', { source })
    setOpen(true)
  }

  const variantClasses = {
    light:
      'bg-transparent text-[#262626] border border-black/10 hover:border-black/25 hover:bg-[#FFFFFF] focus-visible:ring-2 focus-visible:ring-cta/30',
    dark:
      'bg-transparent text-white border border-[#F4F5F7]/25 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40',
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className={`inline-flex items-center gap-2 px-6 py-[14px] rounded-full font-semibold text-[15px] transition-colors focus-visible:outline-none ${variantClasses[variant]} ${className}`}
        aria-label={label || 'Regarder la démo vidéo (90 secondes)'}
      >
        <PlayCircle className="w-4 h-4" strokeWidth={2.2} />
        {label || 'Voir la démo (90s)'}
      </button>

      <VideoModal open={open} onClose={() => setOpen(false)} video={DEMO_VIDEO} />
    </>
  )
}
