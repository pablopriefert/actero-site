import React from 'react'
import { X, LogOut } from 'lucide-react'
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
  return (
    <div className="w-full md:w-[260px] flex flex-col h-full bg-white border-r border-gray-100">
      {/* Header */}
      <div className="h-16 flex items-center px-5 justify-between md:justify-start border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <Logo className="w-7 h-7 text-[#003725]" />
          <span className="font-bold text-[17px] text-[#262626] tracking-tight">{title}</span>
        </div>
        <button
          className="md:hidden text-[#716D5C] hover:text-[#262626]"
          onClick={onClose}
          aria-label="Fermer le menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
        {items.map((item, idx) => {
          if (item.type === 'section') {
            return (
              <div key={idx} className="px-3 pt-6 pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[#716D5C]/70">
                  {item.label}
                </p>
              </div>
            );
          }

          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (onClose) onClose();
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                isActive
                  ? "bg-[#003725] text-white shadow-sm"
                  : "text-[#716D5C] hover:bg-[#F9F7F1] hover:text-[#262626]"
              }`}
            >
              <div className="flex items-center gap-2.5">
                {item.icon && <item.icon className={`w-[18px] h-[18px] ${isActive ? 'text-white/80' : ''}`} />}
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`min-w-[20px] text-center py-0.5 px-1.5 rounded-md text-[10px] font-bold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : (item.badgeColor || "bg-gray-100 text-[#716D5C]")
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors text-[#716D5C] hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="w-[18px] h-[18px]" /> Deconnexion
        </button>
      </div>
    </div>
  );
};
