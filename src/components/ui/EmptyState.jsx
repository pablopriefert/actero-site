import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { tokens } from '../../lib/design-tokens';

const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * EmptyState — Calm, opinionated placeholder for no-data screens.
 * Inspired by Linear (contextual + action-oriented) and Notion (generous whitespace).
 *
 * @param {Object} props
 * @param {React.ComponentType} props.icon              Lucide icon component.
 * @param {string} props.title                          Title text.
 * @param {string} [props.description]                  Secondary description.
 * @param {React.ReactNode | {label, onClick}} [props.action]
 *        Either a ReactNode (legacy) or a structured action {label, onClick}.
 * @param {{label, onClick}} [props.secondaryAction]    Optional secondary button.
 * @param {'neutral'|'success'|'info'|'cta'} [props.tone='neutral']
 *        neutral = gray (default) · success = emerald · info = cream · cta = primary-tint.
 * @param {string} [props.className]
 */
const TONE_STYLES = {
  neutral: {
    bg: 'bg-[#f5f5f5]',
    ring: 'ring-1 ring-[#e5e5e5]',
    icon: 'text-[#9ca3af]',
  },
  success: {
    bg: 'bg-emerald-50',
    ring: 'ring-1 ring-emerald-100',
    icon: 'text-emerald-600',
  },
  info: {
    bg: 'bg-cream',
    ring: 'ring-1 ring-[#E8DFC9]',
    icon: 'text-primary',
  },
  cta: {
    bg: 'bg-primary-tint',
    ring: 'ring-1 ring-cta/20',
    icon: 'text-cta',
  },
};

function renderAction(action) {
  if (!action) return null;
  // Legacy: already a ReactNode (e.g. full button element)
  if (React.isValidElement(action)) return action;
  // Structured: {label, onClick}
  if (typeof action === 'object' && action.label && typeof action.onClick === 'function') {
    return (
      <button
        onClick={action.onClick}
        className="px-4 py-2 rounded-full bg-cta text-white text-[12px] font-semibold hover:bg-cta-hover transition-colors"
      >
        {action.label}
      </button>
    );
  }
  return null;
}

function renderSecondary(action) {
  if (!action || !action.label || typeof action.onClick !== 'function') return null;
  return (
    <button
      onClick={action.onClick}
      className="px-4 py-2 rounded-full bg-white text-[#3A3A3A] text-[12px] font-semibold border border-[#e5e5e5] hover:bg-[#fafafa] transition-colors"
    >
      {action.label}
    </button>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  tone = 'neutral',
  className,
  children,
}) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.neutral;
  const actionEl = renderAction(action);
  const secondaryEl = renderSecondary(secondaryAction);
  const shouldReduceMotion = useReducedMotion();

  const floatAnimation = shouldReduceMotion
    ? {}
    : {
        animate: { y: [0, -4, 0] },
        transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
      };

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}
    >
      {Icon && (
        <motion.div
          className={cn('w-14 h-14 rounded-2xl flex items-center justify-center mb-5', styles.bg, styles.ring)}
          {...floatAnimation}
        >
          <Icon className={cn('w-6 h-6', styles.icon)} aria-hidden="true" />
        </motion.div>
      )}
      <div className="text-[15px] font-semibold text-[#1a1a1a] tracking-tight">{title}</div>
      {description && (
        <div className="text-[13px] text-[#5A5A5A] max-w-md mt-1.5 leading-relaxed">{description}</div>
      )}
      {(actionEl || secondaryEl) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
          {actionEl}
          {secondaryEl}
        </div>
      )}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

/** Inline variant — empty state inside a card/panel, less padding, horizontal layout. */
export function EmptyStateInline({ icon: Icon, title, description, action, tone = 'neutral' }) {
  const styles = TONE_STYLES[tone] || TONE_STYLES.neutral;
  const actionEl = renderAction(action);
  return (
    <div className="flex items-center gap-3 py-6 px-4" role="status" aria-live="polite">
      {Icon && (
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0', styles.bg, styles.ring)}>
          <Icon className={cn('w-5 h-5', styles.icon)} aria-hidden="true" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        {title && <p className="text-[13px] font-semibold text-[#1a1a1a]">{title}</p>}
        {description && <p className="text-[12px] text-[#5A5A5A] mt-0.5">{description}</p>}
      </div>
      {actionEl}
    </div>
  );
}

export const __EMPTY_STATE_TOKENS__ = tokens;
