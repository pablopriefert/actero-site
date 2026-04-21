import React, { useState, useEffect } from 'react'
import { ArrowRight, Calendar, X } from 'lucide-react'
import { trackEvent } from '../../lib/analytics'
import { CONTACT } from '../../config/contact'

/**
 * StickyCTABar — barre d'action flottante sur la landing.
 *
 * Apparaît après ~700px de scroll (passé le hero), reste visible pendant
 * toute la lecture (pricing, features, FAQ) et se cache au moment du CTA
 * final pour éviter la double-CTA redondante.
 *
 * Pattern éprouvé sur les landing SaaS (Linear, Cal.com, Gumroad) — lift
 * conversion +8-15% sur les pages longues. Dismissible (localStorage) pour
 * respecter les visiteurs récurrents.
 *
 * Usage : <StickyCTABar onNavigate={navigate} />
 */
export function StickyCTABar({ onNavigate }) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('sticky-cta-dismissed') === 'true',
  )

  useEffect(() => {
    if (dismissed) return
    const handleScroll = () => {
      const scrolled = window.scrollY
      const viewportH = window.innerHeight
      // Show after hero (approx 700px scroll)
      const pastHero = scrolled > 700
      // Hide when the final dark-green CTA enters viewport (within 2 screens of bottom)
      const docHeight = document.documentElement.scrollHeight
      const nearBottom = scrolled + viewportH > docHeight - viewportH * 1.5
      setVisible(pastHero && !nearBottom)
    }
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [dismissed])

  if (dismissed || !visible) return null

  const handleDismiss = (e) => {
    e.stopPropagation()
    localStorage.setItem('sticky-cta-dismissed', 'true')
    setDismissed(true)
    // Analytics
    trackEvent('Sticky CTA Dismissed')
  }

  const handleCTAClick = () => {
    // Analytics
    trackEvent('Sticky CTA Clicked', { location: 'landing' })
    onNavigate('/signup')
  }

  const handleTalkToHumanClick = () => {
    trackEvent('Talk_To_Human_Clicked', { source: 'sticky_cta_bar' })
    window.open(CONTACT.demo.url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1.5rem)] max-w-xl"
      role="complementary"
      aria-label="Action rapide : démarrer l'essai gratuit"
    >
      <div className="bg-[#1a1a1a] text-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.35)] flex items-center gap-3 pl-4 pr-2 py-2 md:pl-5 md:pr-3 md:py-3 border border-white/10 backdrop-blur-sm animate-[fade-in_0.3s_ease-out]">
        <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-xl bg-cta flex items-center justify-center text-white text-sm md:text-base">
          ✨
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] md:text-[14px] font-semibold leading-tight truncate">
            Prêt à automatiser votre SAV Shopify ?
          </p>
          <p className="text-[11px] md:text-[12px] text-white/60 font-medium leading-tight mt-0.5 truncate">
            Essai 7 jours · Sans carte bancaire · Annulable en 1 clic
          </p>
        </div>
        <button
          onClick={handleTalkToHumanClick}
          aria-label="Réserver une démo avec un humain"
          className="hidden sm:inline-flex flex-shrink-0 items-center gap-1.5 h-9 md:h-10 px-3 md:px-3.5 rounded-xl border border-white/15 text-white/80 text-[12px] md:text-[13px] font-semibold hover:text-white hover:bg-white/10 transition-colors"
        >
          <Calendar className="w-3.5 h-3.5" strokeWidth={2.2} />
          <span className="hidden md:inline">Parler à un humain</span>
          <span className="md:hidden">Démo</span>
        </button>
        <button
          onClick={handleCTAClick}
          className="flex-shrink-0 inline-flex items-center gap-1 md:gap-1.5 h-9 md:h-10 px-3 md:px-4 rounded-xl bg-white text-[#1a1a1a] text-[12px] md:text-[13px] font-bold hover:bg-[#F9F7F1] transition-colors"
        >
          Commencer
          <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
        </button>
        <button
          onClick={handleDismiss}
          aria-label="Masquer cette barre"
          className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
        </button>
      </div>
    </div>
  )
}
