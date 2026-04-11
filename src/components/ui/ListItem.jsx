import React from 'react';
import { tokens } from '../../lib/design-tokens';

const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * Résout le contenu de l'avatar : URL image ou initiales.
 */
function Avatar({ avatar }) {
  if (!avatar) return null;
  const isUrl = typeof avatar === 'string' && (avatar.startsWith('http') || avatar.startsWith('/'));
  if (isUrl) {
    return (
      <img
        src={avatar}
        alt=""
        className="w-8 h-8 rounded-lg flex-shrink-0 object-cover bg-[#fafafa]"
      />
    );
  }
  // Initiales
  return (
    <div className="w-8 h-8 rounded-lg flex-shrink-0 bg-[#0F5F35]/10 text-[#0F5F35] flex items-center justify-center text-[11px] font-semibold">
      {String(avatar).slice(0, 2).toUpperCase()}
    </div>
  );
}

/**
 * ListItem — Ligne d'une liste (clients, events, escalades, etc.).
 *
 * Couleurs issues des tokens :
 * - tokens.colors.bg.border (#f0f0f0) pour le séparateur
 * - tokens.colors.bg.page (#fafafa) pour le hover
 * - tokens.colors.brand.primary (#0F5F35) pour l'état sélectionné
 * - tokens.colors.text.primary/muted pour la typographie
 *
 * @param {Object} props
 * @param {React.ReactNode} [props.icon]      Icône (ou wrapper coloré custom).
 * @param {string} [props.avatar]             URL ou initiales.
 * @param {string} props.title                Titre. Requis.
 * @param {string} [props.subtitle]           Sous-titre discret.
 * @param {React.ReactNode} [props.meta]      Contenu à droite (date, badge).
 * @param {React.ReactNode} [props.action]    Action supplémentaire (kebab, icône).
 * @param {Function} [props.onClick]          Rend la ligne cliquable.
 * @param {boolean} [props.selected]
 * @param {string} [props.className]
 */
export function ListItem({
  icon,
  avatar,
  title,
  subtitle,
  meta,
  action,
  onClick,
  selected = false,
  className,
}) {
  const clickable = typeof onClick === 'function';

  const handleKeyDown = (e) => {
    if (!clickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(e);
    }
  };

  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={clickable ? handleKeyDown : undefined}
      className={cn(
        'flex items-center gap-3 px-5 py-3 border-b border-[#f0f0f0] transition-colors',
        clickable && 'cursor-pointer',
        !selected && 'hover:bg-[#fafafa]',
        selected && 'bg-[#0F5F35]/5 border-l-2 border-l-[#0F5F35]',
        className
      )}
    >
      {icon && !avatar && <div className="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center">{icon}</div>}
      {avatar && <Avatar avatar={avatar} />}
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[#1a1a1a] truncate">{title}</div>
        {subtitle && <div className="text-[11px] text-[#9ca3af] truncate mt-0.5">{subtitle}</div>}
      </div>
      {meta && <div className="text-right flex-shrink-0 ml-4 text-[11px] text-[#71717a]">{meta}</div>}
      {action && <div className="flex-shrink-0 ml-2">{action}</div>}
    </div>
  );
}

export const __LIST_ITEM_TOKENS__ = tokens;
