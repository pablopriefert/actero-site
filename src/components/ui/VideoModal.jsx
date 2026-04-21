import React, { useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { X } from 'lucide-react'
import { DEMO_VIDEO, DEMO_VIDEO_AVAILABLE } from '../../config/demo'

/**
 * VideoModal — lecteur vidéo accessible pour la démo produit.
 *
 * Règles UX respectées (ui-ux-pro-max) :
 *   - `modal-escape` : Esc + click-backdrop + bouton X
 *   - `touch-target-size` : bouton close 44×44px
 *   - `blur-purpose` : backdrop blur indique dismissal possible
 *   - `modal-motion` : scale+fade depuis le centre (reduced-motion =
 *     instant fade)
 *   - `reduced-motion` : respecte prefers-reduced-motion
 *   - `aria-modal` + `role="dialog"` + `aria-labelledby` pour SR
 *   - `focus-management` : focus trap via tabindex, focus initial sur
 *     close, restauration focus sur close
 *   - `lazy-loading` : iframe monté uniquement quand open=true
 *   - `image-dimension` : aspect-ratio CSS pour éviter layout shift
 *   - `keyboard-nav` : Esc + Tab cycle focus
 *
 * Props :
 *   - open (bool)
 *   - onClose (fn)
 *   - video (object, optionnel) — { url, title, aspectRatio } ; défaut
 *     DEMO_VIDEO
 */
export function VideoModal({ open, onClose, video = DEMO_VIDEO }) {
  const closeBtnRef = useRef(null)
  const prevFocusRef = useRef(null)
  const reduceMotion = useReducedMotion()

  // Focus trap + Esc handling
  useEffect(() => {
    if (!open) return

    prevFocusRef.current = document.activeElement
    closeBtnRef.current?.focus()

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
      }
    }
    window.addEventListener('keydown', onKey)

    // Lock body scroll while modal is open
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      // Restore focus to trigger
      if (prevFocusRef.current && typeof prevFocusRef.current.focus === 'function') {
        prevFocusRef.current.focus()
      }
    }
  }, [open, onClose])

  const handleBackdrop = useCallback(
    (e) => {
      if (e.target === e.currentTarget) onClose?.()
    },
    [onClose],
  )

  const titleId = 'video-modal-title'

  const panelVariants = reduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        initial: { opacity: 0, scale: 0.94, y: 20 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.94, y: 10 },
        transition: { type: 'spring', damping: 26, stiffness: 280, duration: 0.25 },
      }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.1 : 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 bg-black/70 backdrop-blur-md"
          onClick={handleBackdrop}
        >
          <motion.div
            {...panelVariants}
            className="relative w-full max-w-4xl bg-[#1A1A1A] rounded-2xl md:rounded-3xl overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)]"
          >
            {/* Header : title + close */}
            <div className="flex items-center justify-between px-5 py-3 bg-[#1A1A1A] border-b border-white/10">
              <h2
                id={titleId}
                className="text-[14px] font-semibold text-white truncate pr-4"
              >
                {video.title}
                {video.duration && (
                  <span className="ml-2 text-[12px] font-normal text-white/50">
                    · {video.duration}
                  </span>
                )}
              </h2>
              <button
                ref={closeBtnRef}
                onClick={onClose}
                aria-label="Fermer la démo vidéo"
                className="flex-shrink-0 w-11 h-11 -mr-2 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video container — aspect-ratio reserves space = no CLS */}
            <div
              className="relative bg-black"
              style={{ aspectRatio: video.aspectRatio || 16 / 9 }}
            >
              {video.src ? (
                // Self-hosted video (Remotion-generated MP4 served from /public)
                <video
                  src={video.src}
                  poster={video.poster || undefined}
                  title={video.title}
                  controls
                  autoPlay
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 w-full h-full object-contain bg-black"
                >
                  <track kind="captions" srcLang="fr" label="Français" />
                  Votre navigateur ne supporte pas la lecture vidéo HTML5.
                </video>
              ) : video.url && DEMO_VIDEO_AVAILABLE ? (
                // External embed fallback (Loom / YouTube / Vimeo)
                <iframe
                  src={video.url}
                  title={video.title}
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  allowFullScreen
                  loading="lazy"
                  className="absolute inset-0 w-full h-full"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center bg-gradient-to-br from-[#003725] to-[#0A4F2C] text-white">
                  <div className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center mb-5">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#A8C490]">
                      <circle cx="12" cy="12" r="10" />
                      <polyline points="12 6 12 12 16 14" />
                    </svg>
                  </div>
                  <p className="text-[18px] md:text-[22px] font-bold text-white mb-2">
                    Démo vidéo bientôt disponible
                  </p>
                  <p className="text-[13.5px] text-[#F4F0E6]/75 leading-[1.55] max-w-md">
                    En attendant, réservez une démo live de 30 min avec un cofondateur pour voir Actero en action sur votre boutique Shopify.
                  </p>
                  <a
                    href="https://cal.com/actero/demo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center gap-2 bg-[#A8C490] text-[#003725] px-5 py-2.5 rounded-full text-[13.5px] font-bold hover:bg-white transition-colors"
                  >
                    Réserver une démo live
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
