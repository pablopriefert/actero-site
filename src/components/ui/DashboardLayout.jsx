import React, { useEffect, useRef } from 'react';
import { Menu, X } from 'lucide-react';
import { tokens } from '../../lib/design-tokens';

const cn = (...classes) => classes.filter(Boolean).join(' ');

/**
 * DashboardLayout — Shell complet (sidebar + main) pour uniformiser
 * admin et client dashboards.
 *
 * Tokens utilisés :
 * - tokens.colors.bg.page (#fafafa)
 * - tokens.colors.bg.surface (#ffffff)
 * - tokens.colors.bg.border (#f0f0f0)
 * - tokens.colors.text.primary (#1a1a1a)
 * - tokens.colors.brand.primary (#0F5F35)
 *
 * Desktop : sidebar fixe (240px md / 256px lg) + main flex-1.
 * Mobile : header + sidebar off-canvas drawer.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.sidebar             Contenu sidebar. Requis.
 * @param {React.ReactNode} props.children            Contenu main. Requis.
 * @param {React.ReactNode} [props.header]            PageHeader optionnel au-dessus du contenu.
 * @param {boolean} props.mobileMenuOpen              Etat drawer mobile. Requis.
 * @param {Function} props.setMobileMenuOpen          Setter drawer mobile. Requis.
 * @param {React.ReactNode} [props.mobileLogo]        Logo affiché dans le header mobile.
 * @param {string} [props.className]
 */
export function DashboardLayout({
  sidebar,
  children,
  header,
  mobileMenuOpen,
  setMobileMenuOpen,
  mobileLogo,
  className,
}) {
  const drawerRef = useRef(null);

  // Ferme le drawer au clic extérieur
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClickOutside = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen, setMobileMenuOpen]);

  // Ferme le drawer sur Escape
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleEscape = (e) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen, setMobileMenuOpen]);

  return (
    <div className={cn('min-h-screen bg-[#fafafa]', className)}>
      {/* Header mobile (< md) */}
      <div className="md:hidden flex items-center justify-between h-12 px-4 bg-white border-b border-[#f0f0f0] sticky top-0 z-40">
        <div className="flex items-center gap-2 min-w-0">
          {mobileLogo || <span className="text-[14px] font-semibold text-[#1a1a1a]">Actero</span>}
        </div>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-[#71717a] hover:bg-[#fafafa] transition-colors"
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Overlay mobile */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-40 transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Drawer mobile */}
      <aside
        ref={drawerRef}
        className={cn(
          'md:hidden fixed top-0 left-0 bottom-0 w-[260px] bg-white border-r border-[#f0f0f0] z-50 transform transition-transform duration-200 overflow-y-auto',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {sidebar}
      </aside>

      {/* Layout desktop */}
      <div className="flex">
        {/* Sidebar desktop (fixe) */}
        <aside className="hidden md:block fixed top-0 left-0 bottom-0 w-[240px] lg:w-[256px] bg-white border-r border-[#f0f0f0] overflow-y-auto z-30">
          {sidebar}
        </aside>

        {/* Main */}
        <main className="flex flex-col min-h-screen flex-1 md:ml-[240px] lg:ml-[256px]">
          {header}
          <div className="flex-1 p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

export const __DASHBOARD_LAYOUT_TOKENS__ = tokens;
