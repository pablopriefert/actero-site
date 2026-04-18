import React from 'react';
import { tokens } from '../../lib/design-tokens';

const cn = (...classes) => classes.filter(Boolean).join(' ');

const VARIANT_MAP = {
  success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border border-amber-200',
  danger: 'bg-red-50 text-red-700 border border-red-200',
  info: 'bg-blue-50 text-blue-700 border border-blue-200',
  neutral: 'bg-[#fafafa] text-[#71717a] border border-[#f0f0f0]',
  brand: 'bg-cta/10 text-cta border border-cta/20',
};

const DOT_MAP = {
  success: 'bg-[#10b981]',
  warning: 'bg-[#f59e0b]',
  danger: 'bg-[#ef4444]',
  info: 'bg-[#3b82f6]',
  neutral: 'bg-[#9ca3af]',
  brand: 'bg-cta',
};

const SIZE_MAP = {
  sm: 'text-[10px] px-2 py-0.5',
  md: 'text-[11px] px-2.5 py-1',
};

/**
 * StatusPill — Badge arrondi pour statuts.
 *
 * Couleurs issues de tokens.colors.semantic (success/warning/danger/info)
 * et tokens.colors.brand pour la variante brand.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children   Libellé du badge. Requis.
 * @param {'success'|'warning'|'danger'|'info'|'neutral'|'brand'} [props.variant='neutral']
 * @param {'sm'|'md'} [props.size='sm']
 * @param {boolean} [props.dot]              Affiche une pastille pulsante.
 * @param {React.ComponentType} [props.icon] Composant lucide affiché à gauche.
 * @param {string} [props.className]
 */
export function StatusPill({
  children,
  variant = 'neutral',
  size = 'sm',
  dot = false,
  icon: Icon,
  className,
}) {
  const variantClasses = VARIANT_MAP[variant] || VARIANT_MAP.neutral;
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.sm;
  const dotColor = DOT_MAP[variant] || DOT_MAP.neutral;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        variantClasses,
        sizeClasses,
        className
      )}
    >
      {dot && (
        <span className="relative inline-flex w-1.5 h-1.5 flex-shrink-0">
          <span className={cn('absolute inset-0 rounded-full animate-ping opacity-75', dotColor)} />
          <span className={cn('relative inline-flex w-1.5 h-1.5 rounded-full', dotColor)} />
        </span>
      )}
      {Icon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  );
}

export const __STATUS_PILL_TOKENS__ = tokens;
