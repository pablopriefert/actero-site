import React from 'react'
import { motion } from 'framer-motion'

export const AdminKanbanBoard = ({ requests }) => {
  const columns = [
    {
      id: "en_attente",
      title: "À qualifier",
      statusFilter: ["en_attente", "nouveau", null, ""],
      color: "border-amber-500/30 bg-amber-500/5",
      badge: "bg-amber-100 text-amber-700",
    },
    {
      id: "en_cours",
      title: "Architecture en cours",
      statusFilter: ["en_cours", "analyse"],
      color: "border-blue-500/30 bg-blue-500/5",
      badge: "bg-blue-100 text-blue-700",
    },
    {
      id: "termine",
      title: "Déployé",
      statusFilter: ["termine", "valide", "deploye"],
      color: "border-emerald-500/30 bg-emerald-500/5",
      badge: "bg-emerald-100 text-emerald-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
      {columns.map((col) => {
        const columnTasks = requests.filter((r) =>
          col.statusFilter.includes(r.status?.toLowerCase() || ""),
        );
        return (
          <div
            key={col.id}
            className={`rounded-3xl border border-white/5 bg-[#0a0a0a]/50 p-4 flex flex-col gap-4 shadow-inner min-h-[60vh]`}
          >
            <div className="flex items-center justify-between mb-2 px-2">
              <h3 className="font-bold text-white text-sm tracking-widest uppercase">
                {col.title}
              </h3>
              <span className="bg-white/10 text-zinc-400 px-2.5 py-0.5 rounded-full text-xs font-bold">
                {columnTasks.length}
              </span>
            </div>
            {columnTasks.map((req) => (
              <motion.div
                layoutId={req.id}
                key={req.id}
                className={`bg-[#111] border ${col.color} p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow group cursor-pointer`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${col.badge}`}
                  >
                    {req.status || "Nouveau"}
                  </span>
                  {req.priority === "high" && (
                    <span className="text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">
                      Prio
                    </span>
                  )}
                </div>
                <h4 className="font-bold text-white text-base leading-tight mb-2 group-hover:text-emerald-400 transition-colors">
                  {req.title || "Projet IA"}
                </h4>
                <p className="text-xs text-zinc-500 font-medium line-clamp-2 mb-4">
                  {req.description}
                </p>
                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                      {req.clients?.brand_name?.charAt(0) || "?"}
                    </div>
                    <span className="text-xs font-bold text-zinc-400 truncate max-w-[100px]">
                      {req.clients?.brand_name || "Client Inconnu"}
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-600 font-mono">
                    {new Date(req.created_at).toLocaleDateString("fr-FR", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              </motion.div>
            ))}
            {columnTasks.length === 0 && (
              <div className="text-center p-8 border border-white/5 border-dashed rounded-2xl text-zinc-600 text-sm font-medium">
                Vide
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
