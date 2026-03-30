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
  theme = "dark"
}) => {
  const isLight = theme === "light";

  return (
    <div className={`w-full md:w-64 flex flex-col h-full border-r ${isLight ? "bg-white border-slate-200" : "bg-[#0E1424] border-white/10"}`}>
      <div className={`h-16 flex items-center px-6 border-b justify-between md:justify-start ${isLight ? "border-slate-100" : "border-white/10"}`}>
        <div className="flex items-center gap-2">
          <Logo className={`w-6 h-6 ${isLight ? "text-blue-600" : "text-white"}`} />
          <span className={`font-bold text-lg ${isLight ? "text-slate-900" : "text-white"}`}>{title}</span>
        </div>
        <button
          className={`md:hidden ${isLight ? "text-slate-400 hover:text-slate-900" : "text-gray-400 hover:text-white"}`}
          onClick={onClose}
          aria-label="Fermer le menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
        {items.map((item, idx) => {
          if (item.type === 'section') {
            return (
              <div key={idx} className={`px-3 text-[10px] font-bold uppercase tracking-widest mb-3 mt-6 ${isLight ? "text-slate-400" : "text-gray-500"}`}>
                {item.label}
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
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-all ${
                isActive 
                  ? (isLight ? "bg-blue-50 text-blue-600" : "bg-white/10 text-white")
                  : (isLight ? "text-slate-500 hover:bg-slate-50 hover:text-slate-900" : "text-gray-400 hover:bg-white/5 hover:text-white")
              }`}
            >
              <div className="flex items-center gap-3">
                {item.icon && <item.icon className="w-4 h-4" />}
                {item.label}
              </div>
              {item.badge && (
                <span className={`py-0.5 px-2 rounded-full text-[10px] font-bold ${
                  item.badgeColor || (isLight ? "bg-slate-100 text-slate-600" : "bg-white/10 text-gray-400")
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className={`p-4 border-t ${isLight ? "border-slate-100" : "border-white/10"}`}>
        <button
          onClick={onLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            isLight ? "text-slate-500 hover:bg-rose-50 hover:text-rose-600" : "text-gray-400 hover:bg-red-50/10 hover:text-red-500"
          }`}
        >
          <LogOut className="w-4 h-4" /> Déconnexion
        </button>
      </div>
    </div>
  );
};
