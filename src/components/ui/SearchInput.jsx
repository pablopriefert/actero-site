import React from 'react';
import { Search, X } from 'lucide-react';
import { tokens } from '../../lib/design-tokens';

const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * SearchInput — Input de recherche stylé avec icône et bouton clear.
 *
 * Utilise les tokens design-tokens.js :
 * - tokens.colors.bg.page (#fafafa)
 * - tokens.colors.bg.border (#f0f0f0)
 * - tokens.colors.text.primary (#1a1a1a)
 * - tokens.colors.text.muted (#9ca3af) pour placeholder
 * - tokens.colors.brand.primary (#0E653A) pour focus ring
 *
 * @param {Object} props
 * @param {string} props.value                 Valeur contrôlée. Requis.
 * @param {Function} props.onChange            Handler onChange. Requis.
 * @param {string} [props.placeholder='Rechercher...']
 * @param {Function} [props.onClear]           Si fourni + value non vide, bouton X affiché.
 * @param {string} [props.className]
 * @param {boolean} [props.autoFocus]
 */
export function SearchInput({
  value,
  onChange,
  placeholder = 'Rechercher...',
  onClear,
  className,
  autoFocus = false,
  ...rest
}) {
  const showClear = onClear && value && value.length > 0;

  return (
    <div className={cn('relative', className)}>
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9ca3af] pointer-events-none"
        aria-hidden="true"
      />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#fafafa] border border-[#f0f0f0] text-[13px] text-[#1a1a1a] placeholder:text-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-cta/20 focus:border-cta/30 transition-all"
        {...rest}
      />
      {showClear && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Effacer la recherche"
          className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-[#9ca3af] hover:text-[#1a1a1a] hover:bg-[#f0f0f0] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export const __SEARCH_INPUT_TOKENS__ = tokens;
