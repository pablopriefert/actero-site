import { supabase } from "../../lib/supabase"
import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, ChevronLeft, Check, Trash2, X, Eye } from 'lucide-react'


const COLUMNS = [
  {
    id: "en_attente",
    title: "À qualifier",
    statusFilter: ["en_attente", "nouveau", null, ""],
    statusValue: "en_attente",
    color: "border-amber-500/30 bg-amber-500/5",
    badge: "bg-amber-100 text-amber-700",
  },
  {
    id: "en_cours",
    title: "Architecture en cours",
    statusFilter: ["en_cours", "analyse"],
    statusValue: "en_cours",
    color: "border-blue-500/30 bg-blue-500/5",
    badge: "bg-blue-100 text-blue-700",
  },
  {
    id: "termine",
    title: "Déployé",
    statusFilter: ["termine", "valide", "deploye"],
    statusValue: "termine",
    color: "border-emerald-500/30 bg-emerald-500/5",
    badge: "bg-emerald-100 text-emerald-700",
  },
]

export const AdminKanbanBoard = ({ requests, onRefresh }) => {
  const [updating, setUpdating] = useState(null)
  const [detail, setDetail] = useState(null)

  const updateStatus = async (requestId, newStatus) => {
    setUpdating(requestId)
    try {
      await supabase
        .from('requests')
        .update({ status: newStatus })
        .eq('id', requestId)
      if (onRefresh) onRefresh()
      else window.location.reload()
    } catch (e) {
      console.error('Update failed:', e)
    }
    setUpdating(null)
  }

  const deleteRequest = async (requestId) => {
    if (!confirm('Supprimer cette demande ?')) return
    setUpdating(requestId)
    try {
      await supabase.from('requests').delete().eq('id', requestId)
      if (onRefresh) onRefresh()
      else window.location.reload()
    } catch (e) {
      console.error('Delete failed:', e)
    }
    setUpdating(null)
  }

  const getColumnIndex = (status) => {
    const s = (status || '').toLowerCase()
    return COLUMNS.findIndex(c => c.statusFilter.includes(s))
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        {COLUMNS.map((col, colIdx) => {
          const columnTasks = requests.filter((r) =>
            col.statusFilter.includes(r.status?.toLowerCase() || ""),
          )
          return (
            <div
              key={col.id}
              className="rounded-3xl border border-[#f0f0f0] bg-[#ffffff]/50 p-4 flex flex-col gap-4 shadow-inner min-h-[60vh]"
            >
              <div className="flex items-center justify-between mb-2 px-2">
                <h3 className="font-bold text-[#1a1a1a] text-[13px] tracking-widest uppercase">
                  {col.title}
                </h3>
                <span className="bg-[#fafafa] text-[#71717a] px-2.5 py-0.5 rounded-full text-[12px] font-bold">
                  {columnTasks.length}
                </span>
              </div>
              {columnTasks.map((req) => {
                const isUpdating = updating === req.id
                const currentColIdx = colIdx
                const canGoLeft = currentColIdx > 0
                const canGoRight = currentColIdx < COLUMNS.length - 1
                const isDeployed = currentColIdx === COLUMNS.length - 1

                return (
                  <motion.div
                    layoutId={req.id}
                    key={req.id}
                    className={`bg-[#ffffff] border ${col.color} p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow group ${isUpdating ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${col.badge}`}
                      >
                        {req.status || "Nouveau"}
                      </span>
                      <div className="flex items-center gap-1">
                        {req.priority === "high" && (
                          <span className="text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">
                            Prio
                          </span>
                        )}
                        <button
                          onClick={() => setDetail(req)}
                          className="p-1 rounded hover:bg-[#fafafa] text-[#71717a] hover:text-[#1a1a1a] transition-colors"
                          title="Voir détails"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <h4 className="font-bold text-[#1a1a1a] text-[14px] leading-tight mb-2 group-hover:text-emerald-500 transition-colors">
                      {req.title || "Projet IA"}
                    </h4>
                    <p className="text-[12px] text-[#71717a] font-medium line-clamp-2 mb-4">
                      {req.description}
                    </p>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 mb-3">
                      {canGoLeft && (
                        <button
                          onClick={() => updateStatus(req.id, COLUMNS[currentColIdx - 1].statusValue)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-[#fafafa] hover:bg-[#fafafa] text-[#71717a] hover:text-[#1a1a1a] text-[11px] font-medium transition-all border border-[#f0f0f0]"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          {COLUMNS[currentColIdx - 1].title.split(' ')[0]}
                        </button>
                      )}
                      {canGoRight && (
                        <button
                          onClick={() => updateStatus(req.id, COLUMNS[currentColIdx + 1].statusValue)}
                          className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all border ${
                            currentColIdx === COLUMNS.length - 2
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 hover:text-emerald-300 border-emerald-500/20'
                              : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border-blue-500/20'
                          }`}
                        >
                          {COLUMNS[currentColIdx + 1].title.split(' ')[0]}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isDeployed && (
                        <button
                          onClick={() => deleteRequest(req.id)}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-[11px] font-medium transition-all border border-red-500/20"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Archiver
                        </button>
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-[#f0f0f0] pt-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded bg-[#fafafa] flex items-center justify-center text-[10px] font-bold text-[#1a1a1a] uppercase">
                          {req.clients?.brand_name?.charAt(0) || "?"}
                        </div>
                        <span className="text-[12px] font-bold text-[#71717a] truncate max-w-[100px]">
                          {req.clients?.brand_name || "Client Inconnu"}
                        </span>
                      </div>
                      <span className="text-[10px] text-[#71717a] font-mono">
                        {new Date(req.created_at).toLocaleDateString("fr-FR", {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>
                  </motion.div>
                )
              })}
              {columnTasks.length === 0 && (
                <div className="text-center p-8 border border-[#f0f0f0] border-dashed rounded-2xl text-[#71717a] text-[13px] font-medium">
                  Vide
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {detail && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDetail(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#ffffff] border border-[#f0f0f0] rounded-2xl p-6 max-w-lg w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[15px] font-bold text-[#1a1a1a]">{detail.title || 'Demande'}</h3>
                <button onClick={() => setDetail(null)} className="p-1 hover:bg-[#fafafa] rounded-lg transition-colors">
                  <X className="w-5 h-5 text-[#71717a]" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <span className="text-[12px] text-[#71717a] font-medium">Client</span>
                  <p className="text-[13px] text-[#1a1a1a]">{detail.clients?.brand_name || 'Inconnu'}</p>
                </div>
                <div>
                  <span className="text-[12px] text-[#71717a] font-medium">Description</span>
                  <p className="text-[13px] text-[#71717a] whitespace-pre-wrap">{detail.description || 'Aucune description'}</p>
                </div>
                <div>
                  <span className="text-[12px] text-[#71717a] font-medium">Statut</span>
                  <p className="text-[13px] text-[#1a1a1a] capitalize">{detail.status || 'en_attente'}</p>
                </div>
                <div>
                  <span className="text-[12px] text-[#71717a] font-medium">Priorité</span>
                  <p className={`text-[13px] font-medium ${detail.priority === 'high' ? 'text-red-400' : 'text-[#71717a]'}`}>
                    {detail.priority === 'high' ? 'Haute' : 'Normale'}
                  </p>
                </div>
                <div>
                  <span className="text-[12px] text-[#71717a] font-medium">Date</span>
                  <p className="text-[13px] text-[#71717a]">
                    {new Date(detail.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                {(() => {
                  const idx = getColumnIndex(detail.status)
                  return (
                    <>
                      {idx > 0 && (
                        <button
                          onClick={() => { updateStatus(detail.id, COLUMNS[idx - 1].statusValue); setDetail(null) }}
                          className="flex-1 px-3 py-2 rounded-lg bg-[#fafafa] hover:bg-[#fafafa] text-[#71717a] text-[13px] font-medium transition-all border border-[#f0f0f0]"
                        >
                          ← {COLUMNS[idx - 1].title}
                        </button>
                      )}
                      {idx < COLUMNS.length - 1 && (
                        <button
                          onClick={() => { updateStatus(detail.id, COLUMNS[idx + 1].statusValue); setDetail(null) }}
                          className="flex-1 px-3 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-[13px] font-medium transition-all border border-emerald-500/20"
                        >
                          {COLUMNS[idx + 1].title} →
                        </button>
                      )}
                    </>
                  )
                })()}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
