import React, { useState, useRef, useEffect } from 'react'
import { X, LogOut, ChevronDown, Bell, Users, Gift, User, CreditCard, Award, Search } from 'lucide-react'
import { Logo } from './Logo'

export const Sidebar = ({
  title = "Actero",
  items = [],
  activeTab,
  setActiveTab,
  onLogout,
  isOpen: _isOpen,
  onClose,
  theme = "light",
  userName,
  userEmail,
  upgradeCta,
}) => {
  const [expandedSections, setExpandedSections] = useState({})
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const accountRef = useRef(null)

  const toggleSection = (label) => {
    setExpandedSections(prev => ({ ...prev, [label]: !prev[label] }))
  }

  // Close account menu on click outside
  useEffect(() => {
    const handleClick = (e) => {
      if (accountRef.current && !accountRef.current.contains(e.target)) {
        setShowAccountMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const initials = userName
    ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : userEmail ? userEmail[0].toUpperCase() : 'A'

  const ACCOUNT_ITEMS = [
    { id: 'profile', label: 'Mon Profil', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'billing', label: 'Facturation', icon: CreditCard },
    { id: 'team', label: 'Équipe', icon: Users },
    { id: 'referral', label: 'Parrainage', icon: Gift },
    { id: 'partner', label: 'Actero Partners', icon: Award },
  ]

  return (
    <div data-tour="sidebar" className="w-full md:w-[230px] flex flex-col h-full bg-white">
      {/* Header */}
      <div className="h-[52px] flex items-center px-4 justify-between md:justify-start">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-cta flex items-center justify-center">
            <Logo className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-[14px] text-[#1a1a1a] tracking-tight">{title}</span>
        </div>
        <button
          className="md:hidden text-[#9ca3af] hover:text-[#1a1a1a]"
          onClick={onClose}
          aria-label="Fermer le menu de navigation"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search bar (visual only) */}
      <div className="px-3 pt-1 pb-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#9ca3af] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Rechercher..."
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-[#fafafa] border border-[#f0f0f0] text-[12px] text-[#1a1a1a] placeholder:text-[#9ca3af] focus:outline-none focus:border-cta/30 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Navigation */}
      <nav
        role="navigation"
        aria-label="Navigation principale"
        className="flex-1 py-1 px-3 space-y-[2px] overflow-y-auto"
      >
        {items.map((item, idx) => {
          if (item.type === 'section') {
            // First section has no top margin/border to avoid visual gap
            const firstInList = !items.slice(0, idx).some(p => p.type === 'section')
            return (
              <div
                key={idx}
                className={`px-2 py-2 ${firstInList ? 'mt-1' : 'mt-4 pt-4 border-t border-[#f0f0f0]'}`}
              >
                <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#9ca3af]">
                  {item.label}
                </p>
              </div>
            );
          }

          if (item.type === 'star') {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                data-tour={item.dataTour}
                onClick={() => { setActiveTab(item.id); if (onClose) onClose() }}
                aria-current={isActive ? 'page' : undefined}
                className={`relative w-full h-10 flex items-center justify-between px-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 group my-1.5 ${
                  isActive
                    ? "bg-gradient-to-r from-cta to-[#003725] text-white shadow-[0_2px_8px_rgba(15,95,53,0.25)]"
                    : "bg-gradient-to-r from-cta/[0.06] to-cta/[0.02] text-cta hover:from-cta/[0.1] hover:to-cta/[0.04] border border-cta/15"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                    isActive ? 'bg-white/20' : 'bg-cta/10 group-hover:bg-cta/15'
                  }`}>
                    {item.icon && <item.icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-cta'}`} />}
                  </div>
                  <span className="tracking-tight">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`flex-shrink-0 text-center px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${
                      isActive ? 'bg-white/25 text-white' : 'bg-cta/12 text-cta'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          }

          if (item.type === 'expandable') {
            const isExpanded = expandedSections[item.label] ?? item.defaultOpen ?? false
            const hasActiveChild = (item.children || []).some(c => c.id === activeTab)
            const childCount = (item.children || []).length
            const isPrimary = item.primary === true
            return (
              <div key={idx} data-tour={item.dataTour} className={isPrimary ? 'my-1.5' : ''}>
                <button
                  onClick={() => toggleSection(item.label)}
                  className={
                    isPrimary
                      ? `relative w-full h-10 flex items-center justify-between px-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 group ${
                          hasActiveChild
                            ? 'bg-gradient-to-r from-cta to-[#003725] text-white shadow-[0_2px_8px_rgba(15,95,53,0.25)]'
                            : 'bg-gradient-to-r from-cta/[0.06] to-cta/[0.02] text-cta hover:from-cta/[0.1] hover:to-cta/[0.04] border border-cta/15'
                        }`
                      : `w-full h-9 flex items-center justify-between px-2.5 rounded-lg text-[13px] transition-all duration-150 ${
                          hasActiveChild
                            ? 'text-[#1a1a1a] font-semibold'
                            : 'text-[#1a1a1a] font-medium hover:bg-[#fafafa]'
                        }`
                  }
                >
                  <div className="flex items-center gap-2.5">
                    {isPrimary ? (
                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                        hasActiveChild ? 'bg-white/20' : 'bg-cta/10 group-hover:bg-cta/15'
                      }`}>
                        {item.icon && <item.icon className={`w-3.5 h-3.5 ${hasActiveChild ? 'text-white' : 'text-cta'}`} />}
                      </div>
                    ) : (
                      item.icon && <item.icon className={`w-4 h-4 ${hasActiveChild ? 'text-cta' : 'text-[#9ca3af]'}`} />
                    )}
                    <span className={isPrimary ? 'tracking-tight' : ''}>{item.label}</span>
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform duration-200 ease-out ${
                      isPrimary
                        ? hasActiveChild ? 'text-white/80' : 'text-cta/60'
                        : 'text-[#9ca3af]'
                    } ${isExpanded ? 'rotate-180' : ''}`}
                  />
                </button>
                <div
                  className="overflow-hidden transition-[max-height,opacity] duration-200 ease-out"
                  style={{
                    maxHeight: isExpanded ? `${childCount * 34 + 8}px` : '0px',
                    opacity: isExpanded ? 1 : 0,
                  }}
                >
                  <div className="pt-0.5 pb-1 space-y-[1px]">
                    {(item.children || []).map(child => {
                      const isActive = activeTab === child.id
                      const isNumericBadge = child.badge != null && !isNaN(Number(child.badge))
                      return (
                        <button
                          key={child.id}
                          onClick={() => { setActiveTab(child.id); if (onClose) onClose() }}
                          aria-current={isActive ? 'page' : undefined}
                          className={`w-full h-8 flex items-center justify-between pl-9 pr-2.5 rounded-lg text-[12px] transition-all duration-150 ${
                            isActive
                              ? "text-cta font-semibold bg-cta/[0.08] border-l-2 border-cta"
                              : "text-[#71717a] font-normal hover:text-[#1a1a1a] hover:bg-[#fafafa]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {child.icon && <child.icon className={`w-3.5 h-3.5 ${isActive ? 'text-cta' : 'text-[#9ca3af]'}`} />}
                            <span className="truncate">{child.label}</span>
                          </div>
                          {child.badge && (
                            <span
                              className={`flex-shrink-0 min-w-[18px] text-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                isNumericBadge
                                  ? "bg-[#ef4444] text-white"
                                  : isActive
                                    ? "bg-cta/10 text-cta"
                                    : (child.badgeColor || "bg-[#f0f0f0] text-[#71717a]")
                              }`}
                            >
                              {child.badge}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          }

          const isActive = activeTab === item.id;
          const isNumericBadge = item.badge != null && !isNaN(Number(item.badge))
          return (
            <button
              key={item.id}
              data-tour={item.dataTour}
              onClick={() => { setActiveTab(item.id); if (onClose) onClose() }}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full h-9 flex items-center justify-between px-2.5 rounded-lg text-[13px] transition-all duration-150 group ${
                isActive
                  ? "text-cta font-semibold bg-cta/[0.08] border-l-2 border-cta"
                  : "text-[#1a1a1a] font-medium hover:bg-[#fafafa]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {item.icon && (
                  <item.icon className={`w-4 h-4 ${isActive ? 'text-cta' : 'text-[#9ca3af] group-hover:text-[#71717a]'}`} />
                )}
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`flex-shrink-0 min-w-[18px] text-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    isNumericBadge
                      ? "bg-[#ef4444] text-white"
                      : isActive
                        ? "bg-cta/10 text-cta"
                        : (item.badgeColor || "bg-[#f0f0f0] text-[#71717a]")
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Upgrade CTA */}
      {upgradeCta && (
        <div className="px-3 pb-2">
          {upgradeCta}
        </div>
      )}

      {/* Footer — User profile with dropdown */}
      <div className="relative border-t border-[#f0f0f0]" ref={accountRef}>
        {/* Dropdown menu */}
        {showAccountMenu && (
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.12)] border border-[#f0f0f0] py-1.5 z-50">
            {ACCOUNT_ITEMS.map(item => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id)
                    setShowAccountMenu(false)
                    if (onClose) onClose()
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors ${
                    isActive ? 'text-cta bg-cta/[0.04]' : 'text-[#71717a] hover:text-[#1a1a1a] hover:bg-[#f9f9f9]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cta' : 'opacity-40'}`} />
                  {item.label}
                </button>
              )
            })}
            <div className="border-t border-[#f0f0f0] mt-1.5 pt-1.5">
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Déconnexion
              </button>
            </div>
          </div>
        )}

        {/* Profile button */}
        <button
          onClick={() => setShowAccountMenu(!showAccountMenu)}
          className="w-full flex items-center gap-3 px-3 py-3 hover:bg-[#fafafa] transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-cta text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[12px] font-semibold text-[#1a1a1a] truncate leading-tight">{userName || 'Mon compte'}</p>
            <p className="text-[10px] text-[#9ca3af] truncate leading-tight mt-0.5">{userEmail || ''}</p>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-[#9ca3af] flex-shrink-0 transition-transform duration-200 ${showAccountMenu ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};
