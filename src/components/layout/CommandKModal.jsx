import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, LayoutDashboard, Sparkles, ArrowRight } from 'lucide-react'

export const CommandKModal = ({ isOpen, onClose, clients = [], setActiveTab }) => {
  const [search, setSearch] = useState("");

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredClients = clients.filter((c) =>
    c.brand_name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] px-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      ></div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="w-full max-w-2xl bg-[#111] border border-white/10 rounded-2xl shadow-2xl relative overflow-hidden"
      >
        <div className="flex items-center px-4 py-3 border-b border-white/10 relative">
          <label htmlFor="command-k-search" className="sr-only">Rechercher</label>
          <Search className="w-5 h-5 text-zinc-500 absolute left-4" />
          <input
            id="command-k-search"
            autoFocus
            type="text"
            placeholder="Rechercher un client, une commande, une page..."
            className="w-full bg-transparent border-none outline-none text-white pl-10 py-2 placeholder:text-zinc-600 font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex items-center gap-1.5 ml-4">
            <kbd className="bg-white/10 text-zinc-400 text-xs px-2 py-1 rounded font-mono font-bold tracking-widest leading-none">
              ESC
            </kbd>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {search === "" && (
            <div className="mb-4">
              <div className="text-xs font-bold text-zinc-600 uppercase tracking-widest px-3 py-2">
                Raccourcis Rapides
              </div>
              <button
                onClick={() => {
                  setActiveTab("overview");
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-3 hover:bg-white/5 rounded-xl transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <LayoutDashboard className="w-5 h-5 text-zinc-400 group-hover:text-white" />
                  <span className="text-zinc-300 group-hover:text-white font-medium">
                    Aller à Vue Globale
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all" />
              </button>
              <button
                onClick={() => {
                  setActiveTab("requests");
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-3 hover:bg-white/5 rounded-xl transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-amber-400 group-hover:text-amber-300" />
                  <span className="text-zinc-300 group-hover:text-white font-medium">
                    Aller aux Demandes IA
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all" />
              </button>
            </div>
          )}

          <div className="text-xs font-bold text-zinc-600 uppercase tracking-widest px-3 py-2">
            Clients
          </div>
          {filteredClients.length > 0 ? (
            filteredClients.map((client) => (
              <button
                key={client.id}
                onClick={() => {
                  setActiveTab("clients");
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3 py-3 hover:bg-white/5 rounded-xl transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center border border-white/5 font-bold text-white text-xs">
                    {client.brand_name?.charAt(0)}
                  </div>
                  <span className="text-zinc-300 group-hover:text-white font-medium">
                    {client.brand_name}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all" />
              </button>
            ))
          ) : (
            <div className="p-12 text-center">
              <p className="text-zinc-600 font-medium">Aucun résultat trouvé.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
