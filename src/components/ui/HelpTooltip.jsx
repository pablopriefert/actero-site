import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HelpCircle } from 'lucide-react'

/**
 * HelpTooltip — small gray "?" icon that shows a popover on hover/focus.
 *
 * Usage:
 *   <HelpTooltip text="Explanation of what this KPI means" />
 *   <HelpTooltip text="..." side="bottom" />
 *
 * Props:
 *  - text: string (required)
 *  - side: 'top' | 'bottom' | 'right' | 'left' (default: 'top')
 *  - className: optional wrapper className
 */
export const HelpTooltip = ({ text, side = 'top', className = '' }) => {
  const [open, setOpen] = useState(false)

  const placement = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  }

  const originY = side === 'bottom' ? -4 : side === 'top' ? 4 : 0
  const originX = side === 'right' ? -4 : side === 'left' ? 4 : 0

  return (
    <span
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      <button
        type="button"
        tabIndex={0}
        aria-label="Aide"
        className="inline-flex items-center justify-center text-[#c4c4c4] hover:text-[#9ca3af] transition-colors outline-none focus-visible:text-cta"
        onClick={(e) => e.preventDefault()}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, x: originX, y: originY, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: originX, y: originY, scale: 0.96 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className={`absolute z-50 w-56 px-3 py-2 rounded-lg bg-[#1a1a1a] text-white text-[11px] leading-snug font-medium shadow-lg pointer-events-none ${placement[side]}`}
          >
            {text}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

export default HelpTooltip
