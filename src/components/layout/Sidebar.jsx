import React, { useState, useRef, useEffect } from 'react'
import { X, LogOut, ChevronDown, Bell, Users, Gift, User, CreditCard } from 'lucide-react'
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
    { id: 'team', label: 'Equipe', icon: Users },
    { id: 'referral', label: 'Parrainage', icon: Gift },
  ]

  return (
    <div className="w-full md:w-[230px] flex flex-col h-full bg-white">
      {/* Header */}
      <div className="h-[52px] flex items-center px-4 justify-between md:justify-start">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#0F5F35] flex items-center justify-center">
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

      {/* Navigation */}
      <nav
        role="navigation"
        aria-label="Navigation principale"
        className="flex-1 py-2 px-3 space-y-[1px] overflow-y-auto"
      >
        {items.map((item, idx) => {
          if (item.type === 'section') {
            return (
              <div key={idx} className="pt-6 pb-2 px-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#c4c4c4]">
                  {item.label}
                </p>
              </div>
            );
          }

          if (item.type === 'expandable') {
            const isExpanded = expandedSections[item.label] ?? item.defaultOpen ?? false
            const hasActiveChild = (item.children || []).some(c => c.id === activeTab)
            return (
              <div key={idx}>
                <button
                  onClick={() => toggleSection(item.label)}
                  className={`w-full flex items-center justify-between px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 ${
                    hasActiveChild ? "text-[#1a1a1a]" : "text-[#71717a] hover:text-[#1a1a1a] hover:bg-[#f5f5f5]"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    {item.icon && <item.icon className="w-[16px] h-[16px] opacity-50" />}
                    <span>{item.label}</span>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 opacity-40 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="ml-[18px] pl-3 border-l border-[#efefef] space-y-[1px] mt-0.5 mb-1">
                    {(item.children || []).map(child => {
                      const isActive = activeTab === child.id
                      return (
                        <button
                          key={child.id}
                          onClick={() => { setActiveTab(child.id); if (onClose) onClose() }}
                          aria-current={isActive ? 'page' : undefined}
                          className={`w-full flex items-center justify-between px-2.5 py-[5px] rounded-lg text-[12px] font-medium transition-all duration-150 ${
                            isActive ? "text-[#0F5F35] bg-[#0F5F35]/[0.06]" : "text-[#71717a] hover:text-[#1a1a1a] hover:bg-[#f5f5f5]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {child.icon && <child.icon className={`w-[14px] h-[14px] ${isActive ? 'text-[#0F5F35]' : 'opacity-40'}`} />}
                            <span>{child.label}</span>
                          </div>
                          {child.badge && (
                            <span className={`min-w-[18px] text-center py-0.5 px-1.5 rounded-full text-[9px] font-bold ${
                              isActive ? "bg-[#0F5F35]/10 text-[#0F5F35]" : (child.badgeColor || "bg-[#f5f5f5] text-[#71717a]")
                            }`}>{child.badge}</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); if (onClose) onClose() }}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-2.5 py-[7px] rounded-lg text-[13px] font-medium transition-all duration-150 group ${
                isActive ? "text-[#0F5F35] bg-[#0F5F35]/[0.06]" : "text-[#71717a] hover:text-[#1a1a1a] hover:bg-[#f5f5f5]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {item.icon && (
                  <div className={`w-[18px] h-[18px] flex items-center justify-center ${isActive ? 'text-[#0F5F35]' : 'opacity-40 group-hover:opacity-60'}`}>
                    <item.icon className="w-[16px] h-[16px]" />
                  </div>
                )}
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`min-w-[18px] text-center py-0.5 px-1.5 rounded-full text-[9px] font-bold ${
                  isActive ? "bg-[#0F5F35]/10 text-[#0F5F35]" : (item.badgeColor || "bg-[#f5f5f5] text-[#71717a]")
                }`}>{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

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
                    isActive ? 'text-[#0F5F35] bg-[#0F5F35]/[0.04]' : 'text-[#71717a] hover:text-[#1a1a1a] hover:bg-[#f9f9f9]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#0F5F35]' : 'opacity-40'}`} />
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
                Deconnexion
              </button>
            </div>
          </div>
        )}

        {/* Profile button */}
        <button
          onClick={() => setShowAccountMenu(!showAccountMenu)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#fafafa] transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-[#0F5F35]/10 text-[#0F5F35] flex items-center justify-center text-[11px] font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-[12px] font-semibold text-[#1a1a1a] truncate">{userName || 'Mon compte'}</p>
            <p className="text-[10px] text-[#9ca3af] truncate">{userEmail || ''}</p>
          </div>
          <ChevronDown className={`w-3.5 h-3.5 text-[#c4c4c4] flex-shrink-0 transition-transform duration-200 ${showAccountMenu ? 'rotate-180' : ''}`} />
        </button>
      </div>
    </div>
  );
};
