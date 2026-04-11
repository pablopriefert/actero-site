import React from 'react';
import { tokens } from '../../lib/design-tokens';

const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * EmptyState — Etat vide universel.
 *
 * Utilise tokens.colors.bg.page (#fafafa), bg.border (#f0f0f0),
 * text.primary (#1a1a1a) et text.muted (#9ca3af).
 *
 * @param {Object} props
 * @param {React.ComponentType} props.icon  Composant lucide. Requis.
 * @param {string} props.title              Titre. Requis.
 * @param {string} [props.description]      Description secondaire.
 * @param {React.ReactNode} [props.action]  CTA optionnel (bouton).
 * @param {string} [props.className]
 */
export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-12 px-6', className)}>
      <div className="w-14 h-14 rounded-2xl bg-[#fafafa] border border-[#f0f0f0] flex items-center justify-center mb-4">
        {Icon && <Icon className="w-7 h-7 text-[#9ca3af]" />}
      </div>
      <div className="text-[14px] font-semibold text-[#1a1a1a]">{title}</div>
      {description && (
        <div className="text-[12px] text-[#9ca3af] max-w-sm mt-1 leading-relaxed">{description}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export const __EMPTY_STATE_TOKENS__ = tokens;
