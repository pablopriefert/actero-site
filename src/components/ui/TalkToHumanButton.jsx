import React from 'react'
import { Calendar } from 'lucide-react'
import { CONTACT } from '../../config/contact'
import { trackEvent } from '../../lib/analytics'

/**
 * TalkToHumanButton — CTA secondaire "Parler à un humain".
 *
 * Ouvre l'URL Cal.com dans un nouvel onglet pour garder le contexte de la
 * page d'origine (le prospect peut revenir finir son tour produit).
 * Amplitude event : Talk_To_Human_Clicked avec le paramètre `source` pour
 * tracker quelle surface convertit le mieux.
 *
 * 3 variantes de style pour s'adapter au contexte :
 *   - `light` : pill cream/beige sur fond blanc ou clair (hero landing,
 *     hero produit, cards)
 *   - `dark`  : pill outline blanc sur fond dark #003725 (CTA final)
 *   - `ghost` : bouton texte discret sans fond (sticky bar, nav secondaire)
 *
 * Props :
 *   - source (string) — identifiant analytics (ex: "landing_hero",
 *     "pricing_enterprise", "alternative_gorgias_hero")
 *   - variant (light | dark | ghost) — défaut light
 *   - size (sm | md) — défaut md
 *   - label (string, optionnel) — override du label par défaut
 *   - className (string) — classes supplémentaires
 */
export function TalkToHumanButton({
  source,
  variant = 'light',
  size = 'md',
  label,
  className = '',
}) {
  const handleClick = () => {
    trackEvent('Talk_To_Human_Clicked', { source })
    window.open(CONTACT.demo.url, '_blank', 'noopener,noreferrer')
  }

  const padding =
    size === 'sm'
      ? 'px-5 py-2.5 text-[13px]'
      : 'px-6 py-[14px] text-[15px]'

  const variantClasses = {
    light:
      'bg-transparent text-[#262626] border border-black/10 hover:border-black/20 hover:bg-[#F9F7F1]',
    dark:
      'bg-transparent text-white border border-[#F4F0E6]/25 hover:bg-white/10',
    ghost:
      'bg-transparent text-[#716D5C] border border-transparent hover:text-[#262626] hover:bg-[#F9F7F1]',
  }

  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center gap-2 rounded-full font-semibold transition-all ${padding} ${variantClasses[variant]} ${className}`}
      aria-label={label || CONTACT.demo.label}
    >
      <Calendar className="w-3.5 h-3.5" strokeWidth={2.2} />
      {label || CONTACT.demo.label}
    </button>
  )
}
