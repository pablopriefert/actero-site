import React from 'react';
import { tokens } from '../../lib/design-tokens';

/**
 * Helper cn minimaliste.
 */
const cn = (...classes) => classes.filter(Boolean).join(' ');

const PADDING_MAP = {
  sm: { header: 'px-4 py-3', body: 'p-4' },
  md: { header: 'px-5 py-4', body: 'p-5' },
  lg: { header: 'px-6 py-5', body: 'p-6' },
};

/**
 * SectionCard — Wrapper générique pour une section de contenu.
 *
 * Consomme les tokens design-tokens.js :
 * - tokens.colors.bg.surface (#ffffff)
 * - tokens.colors.bg.border (#f0f0f0)
 * - tokens.colors.text.primary (#1a1a1a)
 * - tokens.colors.text.muted (#9ca3af)
 *
 * @param {Object} props
 * @param {string} props.title                Titre de la section. Requis.
 * @param {string} [props.subtitle]           Sous-titre discret.
 * @param {React.ReactNode} [props.action]    Action à droite du header (bouton, lien).
 * @param {React.ComponentType} [props.icon]  Composant lucide en icône de header.
 * @param {React.ReactNode} props.children    Contenu du body. Requis.
 * @param {'sm'|'md'|'lg'} [props.padding='md'] Taille du padding.
 * @param {string} [props.className]          Classes additionnelles mergées.
 */
export function SectionCard({
  title,
  subtitle,
  action,
  icon: Icon,
  children,
  padding = 'md',
  className,
}) {
  const pad = PADDING_MAP[padding] || PADDING_MAP.md;

  return (
    <div
      className={cn(
        'rounded-2xl bg-white border border-[#f0f0f0] shadow-[0_1px_3px_rgba(0,0,0,0.08)] overflow-hidden',
        className
      )}
    >
      <div className={cn('flex items-center justify-between border-b border-[#f0f0f0]', pad.header)}>
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="w-8 h-8 rounded-lg bg-cta/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-cta" />
            </div>
          )}
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-[#1a1a1a] truncate">{title}</div>
            {subtitle && <div className="text-[12px] text-[#9ca3af] truncate mt-0.5">{subtitle}</div>}
          </div>
        </div>
        {action && <div className="flex-shrink-0 ml-4">{action}</div>}
      </div>
      <div className={pad.body}>{children}</div>
    </div>
  );
}

export const __SECTION_CARD_TOKENS__ = tokens;
