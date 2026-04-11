import React from 'react';
import { tokens } from '../../lib/design-tokens';

const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * PageHeader — Header de page standardisé (h-12 = 48px).
 *
 * Aligné sur le client dashboard. Utilise tokens.colors.bg.surface (#ffffff)
 * et tokens.colors.bg.border (#f0f0f0).
 *
 * @param {Object} props
 * @param {string} props.title                    Titre de la page. Requis.
 * @param {string} [props.subtitle]               Sous-titre (affiché sous le titre en text-[11px]).
 * @param {React.ReactNode} [props.actions]       Boutons à droite.
 * @param {React.ReactNode} [props.breadcrumb]    Breadcrumb au-dessus du titre.
 * @param {React.ReactNode} [props.badge]         Badge à côté du titre.
 * @param {string} [props.className]
 */
export function PageHeader({ title, subtitle, actions, breadcrumb, badge, className }) {
  return (
    <header
      className={cn(
        'flex items-center justify-between h-12 px-6 bg-white border-b border-[#f0f0f0]',
        className
      )}
    >
      <div className="flex flex-col justify-center min-w-0">
        {breadcrumb && <div className="text-[11px] text-[#9ca3af] mb-0.5 truncate">{breadcrumb}</div>}
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-[14px] font-semibold text-[#1a1a1a] truncate">{title}</h1>
          {badge && <div className="flex-shrink-0">{badge}</div>}
        </div>
        {subtitle && <div className="text-[11px] text-[#9ca3af] truncate">{subtitle}</div>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0 ml-4">{actions}</div>}
    </header>
  );
}

export const __PAGE_HEADER_TOKENS__ = tokens;
