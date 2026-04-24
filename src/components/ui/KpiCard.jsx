import React, { useRef, useEffect } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useSpring, useTransform, animate, useInView, motion } from 'framer-motion';
import { tokens } from '../../lib/design-tokens';

/**
 * Helper minimaliste pour concaténer des classes.
 * @param {...(string|false|null|undefined)} classes
 * @returns {string}
 */
const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * Mapping variantes -> classes Tailwind s'appuyant sur les tokens design-tokens.js.
 * - brand    -> tokens.colors.brand.primary (#0E653A)
 * - success  -> tokens.colors.semantic.success (#10b981)
 * - warning  -> tokens.colors.semantic.warning (#f59e0b)
 * - danger   -> tokens.colors.semantic.danger (#ef4444)
 * - info     -> tokens.colors.semantic.info (#3b82f6)
 * - neutral  -> tokens.colors.text.muted (#9ca3af)
 */
const COLOR_MAP = {
  brand: {
    iconBg: 'bg-cta/10',
    iconText: 'text-cta',
  },
  success: {
    iconBg: 'bg-[#10b981]/10',
    iconText: 'text-[#10b981]',
  },
  warning: {
    iconBg: 'bg-[#f59e0b]/10',
    iconText: 'text-[#f59e0b]',
  },
  danger: {
    iconBg: 'bg-[#ef4444]/10',
    iconText: 'text-[#ef4444]',
  },
  info: {
    iconBg: 'bg-[#3b82f6]/10',
    iconText: 'text-[#3b82f6]',
  },
  neutral: {
    iconBg: 'bg-[#fafafa]',
    iconText: 'text-[#9ca3af]',
  },
};

/**
 * AnimatedNumber — count-up from 0 to `value` on first intersection.
 * Falls back to plain text when value is not a finite number.
 * Framer-motion natively respects `prefers-reduced-motion` when wrapped
 * in <MotionConfig reducedMotion="user"> — and also because useSpring
 * skips animation when the reduced-motion media query fires.
 */
function AnimatedNumber({ value, className }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, amount: 0.4 })
  const spring = useSpring(0, { damping: 30, stiffness: 80 })
  const display = useTransform(spring, (v) => Math.round(v).toLocaleString('fr-FR'))

  useEffect(() => {
    if (inView && typeof value === 'number' && isFinite(value)) {
      animate(spring, value, { duration: 1.5, ease: 'easeOut' })
    }
  }, [inView, value, spring])

  if (typeof value !== 'number' || !isFinite(value)) {
    return <span className={className}>{value}</span>
  }

  return <motion.span ref={ref} className={className}>{display}</motion.span>
}

/**
 * KpiCard — Card métrique KPI réutilisable.
 *
 * @param {Object} props
 * @param {string} props.label            Label en uppercase (ex: "Demandes traitées"). Requis.
 * @param {string|number} props.value     Valeur principale (ex: "1,247"). Requis.
 * @param {string} [props.sublabel]       Sous-label gris discret.
 * @param {number} [props.delta]          Delta numérique (ex: +15, -3). Badge coloré.
 * @param {'up'|'down'|'neutral'} [props.trend]  Tendance (auto-déduite de delta si absent).
 * @param {React.ComponentType} [props.icon]     Composant lucide (ex: Users).
 * @param {'brand'|'success'|'warning'|'danger'|'info'|'neutral'} [props.color='brand'] Couleur de l'icône.
 * @param {string} [props.href]           Si fourni, la card devient un <a> cliquable.
 * @param {boolean} [props.loading]       Skeleton state.
 * @param {string} [props.className]      Classes additionnelles.
 */
export function KpiCard({
  label,
  value,
  sublabel,
  delta,
  trend,
  icon: Icon,
  color = 'brand',
  href,
  loading = false,
  className,
}) {
  const palette = COLOR_MAP[color] || COLOR_MAP.brand;
  const resolvedTrend =
    trend || (typeof delta === 'number' ? (delta > 0 ? 'up' : delta < 0 ? 'down' : 'neutral') : undefined);

  const baseClasses = cn(
    'rounded-2xl bg-surface-2 border border-[#E5E5E0] shadow-elev-2 p-5 transition-all',
    href && 'hover:border-cta/20 hover:shadow-elev-3 cursor-pointer block',
    className
  );

  if (loading) {
    return (
      <div className={baseClasses}>
        <div className="w-8 h-8 rounded-lg bg-[#f5f5f5] animate-pulse" />
        <div className="mt-4 h-3 w-24 rounded bg-[#f5f5f5] animate-pulse" />
        <div className="mt-2 h-7 w-32 rounded bg-[#f5f5f5] animate-pulse" />
        <div className="mt-2 h-3 w-20 rounded bg-[#f5f5f5] animate-pulse" />
      </div>
    );
  }

  const content = (
    <>
      {Icon && (
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', palette.iconBg)}>
          <Icon className={cn('w-4 h-4', palette.iconText)} />
        </div>
      )}
      <div className={cn('text-[11px] uppercase tracking-wider text-[#9ca3af] font-medium', Icon && 'mt-3')}>
        {label}
      </div>
      <div className="flex items-baseline gap-2 mt-2">
        <AnimatedNumber
          value={value}
          className="text-[28px] font-bold text-[#1a1a1a] tabular-nums leading-none"
        />
        {typeof delta === 'number' && (
          <DeltaBadge delta={delta} trend={resolvedTrend} />
        )}
      </div>
      {sublabel && <div className="text-[11px] text-[#9ca3af] mt-1">{sublabel}</div>}
    </>
  );

  if (href) {
    return (
      <a href={href} className={baseClasses}>
        {content}
      </a>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}

/**
 * Badge delta coloré interne.
 */
function DeltaBadge({ delta, trend }) {
  const positive = trend === 'up';
  const negative = trend === 'down';
  const Icon = positive ? TrendingUp : negative ? TrendingDown : Minus;
  const classes = positive
    ? 'text-[#10b981] bg-[#10b981]/10'
    : negative
    ? 'text-[#ef4444] bg-[#ef4444]/10'
    : 'text-[#9ca3af] bg-[#fafafa]';
  const sign = delta > 0 ? '+' : '';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
        classes
      )}
    >
      <Icon className="w-3 h-3" />
      {sign}
      {delta}
    </span>
  );
}

/**
 * KpiRow — Wrapper grid responsive pour aligner des KpiCard.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.className]
 */
export function KpiRow({ children, className }) {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4', className)}>
      {children}
    </div>
  );
}

// Référence tokens pour éviter un warning d'import inutilisé si tree-shake désactivé.
export const __KPI_CARD_TOKENS__ = tokens;
