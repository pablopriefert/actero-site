import React, { useState, useEffect, useCallback, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react'

/**
 * Interactive Product Tour (Linear-style)
 * Custom implementation (no external lib) using React + framer-motion.
 *
 * Props:
 *  - isOpen: boolean — controls visibility
 *  - onClose: () => void — called when user finishes or skips the tour
 */

const TOUR_STEPS = [
  {
    id: 'sidebar',
    selector: '[data-tour="sidebar"]',
    title: 'Votre dashboard Actero',
    description: "Voici votre dashboard. Tout est organisé en sections claires pour piloter votre agent IA en un coup d'œil.",
    placement: 'right',
  },
  {
    id: 'overview-tab',
    selector: '[data-tour="overview-tab"]',
    title: 'Tableau de bord',
    description: "Vue d'ensemble de votre activité, de vos KPI et des conversations récentes.",
    placement: 'right',
  },
  {
    id: 'agent-section',
    selector: '[data-tour="agent-section"]',
    title: 'Mon Agent',
    description: "C'est ici que vous configurez votre agent IA en 5 étapes — rapide et guidé.",
    placement: 'right',
  },
  {
    id: 'setup-checklist',
    selector: '[data-tour="setup-checklist"]',
    title: 'Checklist de démarrage',
    description: "Suivez ces étapes pour activer votre agent. Tout est expliqué, pas besoin d'être technique.",
    placement: 'bottom',
  },
  {
    id: 'kpi-row',
    selector: '[data-tour="kpi-row"]',
    title: 'Vos résultats en temps réel',
    description: 'Vos résultats apparaissent ici en temps réel : tickets traités, temps gagné, économies réalisées.',
    placement: 'bottom',
  },
  {
    id: 'help-button',
    selector: '[data-tour="help-button"]',
    title: 'Besoin d\'aide ?',
    description: "Notre Concierge IA est là pour répondre à vos questions 24/7. Cliquez ici à tout moment.",
    placement: 'left',
  },
]

const PADDING = 8 // spotlight padding around target
const TOOLTIP_OFFSET = 16
const TOOLTIP_WIDTH = 340

function getTooltipPosition(rect, placement) {
  if (!rect) return { top: 0, left: 0 }
  const vw = window.innerWidth
  const vh = window.innerHeight
  let top = 0
  let left = 0

  switch (placement) {
    case 'right':
      top = rect.top + rect.height / 2
      left = rect.right + TOOLTIP_OFFSET + PADDING
      break
    case 'left':
      top = rect.top + rect.height / 2
      left = rect.left - TOOLTIP_OFFSET - PADDING - TOOLTIP_WIDTH
      break
    case 'bottom':
      top = rect.bottom + TOOLTIP_OFFSET + PADDING
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2
      break
    case 'top':
    default:
      top = rect.top - TOOLTIP_OFFSET - PADDING
      left = rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2
      break
  }

  // Clamp within viewport
  left = Math.max(16, Math.min(left, vw - TOOLTIP_WIDTH - 16))
  top = Math.max(16, Math.min(top, vh - 220))
  return { top, left }
}

export default function ProductTour({ isOpen, onClose }) {
  const [currentStep, setCurrentStep] = useState(0)
  const [rect, setRect] = useState(null)

  const step = TOUR_STEPS[currentStep]
  const total = TOUR_STEPS.length

  // Measure target element (and auto-skip if missing)
  const measure = useCallback(() => {
    if (!step) return
    const el = document.querySelector(step.selector)
    if (!el) {
      // Auto-advance to next step if target not found
      setRect(null)
      if (currentStep < total - 1) {
        setCurrentStep((s) => Math.min(s + 1, total - 1))
      } else {
        // End of tour — close
        onClose?.()
      }
      return
    }
    const r = el.getBoundingClientRect()
    setRect({
      top: r.top,
      left: r.left,
      width: r.width,
      height: r.height,
      right: r.right,
      bottom: r.bottom,
    })
    // Scroll into view smoothly
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    } catch (_) {
      /* noop */
    }
  }, [step, currentStep, total, onClose])

  useLayoutEffect(() => {
    if (!isOpen) return
    // Reset to first step each time tour re-opens
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    // Small delay so any scroll / layout settles
    const t = setTimeout(measure, 50)
    return () => clearTimeout(t)
  }, [isOpen, currentStep, measure])

  useEffect(() => {
    if (!isOpen) return
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [isOpen, measure])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => {
      if (e.key === 'Escape') handleClose()
      else if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext()
      else if (e.key === 'ArrowLeft') handlePrev()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentStep])

  const handleNext = () => {
    if (currentStep < total - 1) {
      setCurrentStep((s) => s + 1)
    } else {
      handleClose()
    }
  }
  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep((s) => s - 1)
  }
  const handleClose = () => {
    setCurrentStep(0)
    onClose?.()
  }

  if (!isOpen || !step) return null

  const tooltipPos = rect ? getTooltipPosition(rect, step.placement) : { top: 120, left: 120 }

  // Spotlight SVG mask
  const spotlight = rect
    ? {
        x: Math.max(0, rect.left - PADDING),
        y: Math.max(0, rect.top - PADDING),
        w: rect.width + PADDING * 2,
        h: rect.height + PADDING * 2,
      }
    : null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] pointer-events-none"
          aria-live="polite"
        >
          {/* SVG overlay with spotlight hole */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-auto"
            style={{ pointerEvents: spotlight ? 'none' : 'auto' }}
            onClick={handleClose}
          >
            <defs>
              <mask id="product-tour-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {spotlight && (
                  <motion.rect
                    initial={false}
                    animate={{
                      x: spotlight.x,
                      y: spotlight.y,
                      width: spotlight.w,
                      height: spotlight.h,
                    }}
                    transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                    rx={14}
                    ry={14}
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0,0,0,0.6)"
              mask="url(#product-tour-mask)"
            />
          </svg>

          {/* Spotlight glow ring */}
          {spotlight && (
            <motion.div
              initial={false}
              animate={{
                top: spotlight.y,
                left: spotlight.x,
                width: spotlight.w,
                height: spotlight.h,
              }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="absolute pointer-events-none rounded-[14px]"
              style={{
                boxShadow: '0 0 0 2px rgba(15, 95, 53, 0.9), 0 0 0 6px rgba(15, 95, 53, 0.25)',
              }}
            />
          )}

          {/* Tooltip card */}
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
            className="absolute pointer-events-auto bg-white rounded-2xl p-5"
            style={{
              top: tooltipPos.top,
              left: tooltipPos.left,
              width: TOOLTIP_WIDTH,
              boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-tour-title"
          >
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-cta/10 text-cta flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-semibold text-cta uppercase tracking-wider">
                  Étape {currentStep + 1} / {total}
                </span>
              </div>
              <button
                onClick={handleClose}
                className="text-[#9ca3af] hover:text-[#1a1a1a] transition-colors p-1 -m-1"
                aria-label="Fermer le tour"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <h3
              id="product-tour-title"
              className="text-[16px] font-semibold text-[#1a1a1a] leading-tight mb-1.5"
            >
              {step.title}
            </h3>
            <p className="text-[13px] text-[#71717a] leading-relaxed mb-4">
              {step.description}
            </p>

            {/* Progress dots */}
            <div className="flex items-center gap-1.5 mb-4">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === currentStep
                      ? 'w-6 bg-cta'
                      : i < currentStep
                      ? 'w-1.5 bg-cta/40'
                      : 'w-1.5 bg-[#e5e5e5]'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                onClick={handleClose}
                className="text-[12px] font-medium text-[#9ca3af] hover:text-[#71717a] transition-colors"
              >
                Passer le tour
              </button>
              <div className="flex items-center gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={handlePrev}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#71717a] hover:bg-[#f5f5f5] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Précédent
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-[12px] font-semibold bg-cta text-white hover:bg-[#0c4d2a] transition-colors"
                >
                  {currentStep === total - 1 ? 'Terminer' : 'Suivant'}
                  {currentStep < total - 1 && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
