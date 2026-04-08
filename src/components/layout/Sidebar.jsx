import React, { useState } from 'react'
import { X, LogOut, ChevronDown } from 'lucide-react'
import { Logo } from './Logo'

export const Sidebar = ({
  title = "Actero",
  items = [],
  activeTab,
  setActiveTab,
  onLogout,
  isOpen: _isOpen,
  onClose,
  theme = "light"
}) => {
  const [expandedSections, setExpandedSections] = useState({})

  const toggleSection = (label) => {
    setExpandedSections(prev => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <div className="w-full md:w-[220px] flex flex-col h-full bg-white border-r border-[#e5e5e5]">
      {/* Header */}
      <div className="h-14 flex items-center px-4 justify-between md:justify-start border-b border-[#e5e5e5]">
        <div className="flex items-center gap-2">
          <Logo className="w-6 h-6 text-[#0F5F35]" />
          <span className="font-semibold text-[15px] text-[#1a1a1a]">{title}</span>
        </div>
        <button className="md:hidden text-[#6b7280] hover:text-[#1a1a1a]" onClick={onClose} aria-label="Fermer">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {items.map((item, idx) => {
          if (item.type === 'section') {
            return (
              <div key={idx} className="px-3 pt-5 pb-1">
                <p className="text-[11px] font-medium uppercase tracking-wider text-[#9ca3af]">
                  {item.label}
                </p>
              </div>
            );
          }

          // Expandable section
          if (item.type === 'expandable') {
            const isExpanded = expandedSections[item.label] ?? item.defaultOpen ?? false
            const hasActiveChild = (item.children || []).some(c => c.id === activeTab)
            return (
              <div key={idx}>
                <button
                  onClick={() => toggleSection(item.label)}
                  className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                    hasActiveChild ? "text-[#1a1a1a]" : "text-[#6b7280] hover:text-[#1a1a1a] hover:bg-[#f9fafb]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {item.icon && <item.icon className="w-4 h-4" />}
                    <span>{item.label}</span>
                  </div>
                  <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>
                {isExpanded && (
                  <div className="ml-3 pl-3 border-l border-[#e5e5e5] space-y-0.5 mt-0.5 mb-1">
                    {(item.children || []).map(child => {
                      const isActive = activeTab === child.id
                      return (
                        <button
                          key={child.id}
                          onClick={() => { setActiveTab(child.id); if (onClose) onClose() }}
                          className={`w-full flex items-center justify-between px-3 py-1 rounded-md text-[12px] font-medium transition-colors ${
                            isActive ? "text-[#0F5F35] bg-[#f0fdf4]" : "text-[#6b7280] hover:text-[#1a1a1a] hover:bg-[#f9fafb]"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {child.icon && <child.icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#0F5F35]' : ''}`} />}
                            <span>{child.label}</span>
                          </div>
                          {child.badge && (
                            <span className={`min-w-[18px] text-center py-0.5 px-1 rounded text-[9px] font-semibold ${
                              isActive ? "bg-[#0F5F35]/10 text-[#0F5F35]" : (child.badgeColor || "bg-gray-100 text-[#6b7280]")
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
              className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
                isActive
                  ? "text-[#0F5F35] bg-[#f0fdf4]"
                  : "text-[#6b7280] hover:text-[#1a1a1a] hover:bg-[#f9fafb]"
              }`}
            >
              <div className="flex items-center gap-2">
                {item.icon && <item.icon className={`w-4 h-4 ${isActive ? 'text-[#0F5F35]' : ''}`} />}
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`min-w-[18px] text-center py-0.5 px-1.5 rounded text-[10px] font-semibold ${
                  isActive ? "bg-[#0F5F35]/10 text-[#0F5F35]" : (item.badgeColor || "bg-gray-100 text-[#6b7280]")
                }`}>{item.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-[#e5e5e5]">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium text-[#6b7280] hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" /> Deconnexion
        </button>
      </div>
    </div>
  );
};
