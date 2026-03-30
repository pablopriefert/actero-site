import React, { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  LayoutDashboard,
  BarChart2,
  Settings,
  HelpCircle,
  FileText,
  Zap,
  ArrowRight,
  Command
} from 'lucide-react'

const defaultCommands = [
  { id: 'dashboard', label: 'Aller au Dashboard', icon: LayoutDashboard, section: 'Navigation', route: '/client' },
  { id: 'pricing', label: 'Voir les tarifs', icon: BarChart2, section: 'Navigation', route: '/tarifs' },
  { id: 'audit', label: 'Lancer un audit IA', icon: Zap, section: 'Actions', route: '/audit' },
  { id: 'faq', label: 'Questions fréquentes', icon: HelpCircle, section: 'Navigation', route: '/faq' },
  { id: 'company', label: "À propos d'Actero", icon: FileText, section: 'Navigation', route: '/entreprise' },
  { id: 'demo', label: 'Voir la démo', icon: LayoutDashboard, section: 'Actions', route: '/demo' },
  { id: 'resources', label: 'Ressources & Prompts', icon: FileText, section: 'Navigation', route: '/ressources' },
  { id: 'login', label: 'Se connecter', icon: Settings, section: 'Actions', route: '/login' },
];

/**
 * CommandPalette — Cmd+K spotlight search for navigating the app.
 * Linear/Raycast style. Renders globally, listens for keyboard shortcut.
 */
export const CommandPalette = ({ onNavigate, commands = defaultCommands }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);

  // Open/close with Cmd+K or Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
        setQuery('');
        setSelectedIndex(0);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.section.toLowerCase().includes(q)
    );
  }, [query, commands]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  const handleSelect = (cmd) => {
    setIsOpen(false);
    setQuery('');
    if (onNavigate && cmd.route) {
      onNavigate(cmd.route);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      handleSelect(filtered[selectedIndex]);
    }
  };

  // Group by section
  const sections = useMemo(() => {
    const map = {};
    filtered.forEach((cmd) => {
      if (!map[cmd.section]) map[cmd.section] = [];
      map[cmd.section].push(cmd);
    });
    return map;
  }, [filtered]);

  let flatIndex = -1;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[10000]"
            onClick={() => setIsOpen(false)}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-[10001]"
          >
            <div className="bg-[#0E1424] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                <Search className="w-5 h-5 text-gray-500 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Rechercher une page ou action..."
                  className="flex-1 bg-transparent text-white text-sm placeholder:text-gray-500 outline-none"
                />
                <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-1 text-[10px] font-mono text-gray-500 bg-white/5 border border-white/10 rounded-md">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-[320px] overflow-y-auto py-2">
                {filtered.length === 0 && (
                  <div className="px-5 py-8 text-center text-gray-500 text-sm">
                    Aucun résultat pour "{query}"
                  </div>
                )}

                {Object.entries(sections).map(([section, cmds]) => (
                  <div key={section}>
                    <div className="px-5 py-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
                        {section}
                      </span>
                    </div>
                    {cmds.map((cmd) => {
                      flatIndex++;
                      const currentIdx = flatIndex;
                      const Icon = cmd.icon;
                      return (
                        <button
                          key={cmd.id}
                          onClick={() => handleSelect(cmd)}
                          onMouseEnter={() => setSelectedIndex(currentIdx)}
                          className={`w-full flex items-center gap-3 px-5 py-3 text-left transition-colors ${
                            selectedIndex === currentIdx
                              ? 'bg-white/5 text-white'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          <Icon className="w-4 h-4 shrink-0" />
                          <span className="text-sm font-medium flex-1">{cmd.label}</span>
                          {selectedIndex === currentIdx && (
                            <ArrowRight className="w-3 h-3 text-emerald-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
                <div className="flex items-center gap-4 text-[10px] text-gray-600">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[9px]">↑↓</kbd> naviguer
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-white/5 border border-white/10 rounded text-[9px]">↵</kbd> sélectionner
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-600">
                  <Command className="w-3 h-3" />
                  <span>K</span>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
