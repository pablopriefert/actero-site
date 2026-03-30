import React from 'react'
import { X, Copy } from 'lucide-react'
import { Badge } from '../ui/badge'

export const ActivityModal = ({ log, onClose }) => {
  if (!log) return null;
  const copyId = () => navigator.clipboard.writeText(log.id);
  const timeSavedStr = log.time_saved_seconds
    ? `${Math.round(log.time_saved_seconds / 60)} min`
    : "-";
  const revStr = log.revenue_amount
    ? `${Number(log.revenue_amount).toLocaleString("fr-FR")} €`
    : "-";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      ></div>
      <div className="bg-[#0E1424] rounded-2xl w-full max-w-lg relative z-10 shadow-xl overflow-hidden animate-fade-in-up border border-white/10">
        <div className="p-6 md:p-8 flex items-center justify-between border-b border-white/5 bg-[#0A0E1A]">
          <h3 className="text-xl font-bold text-white tracking-tight">
            Détail de l'événement
          </h3>
          <button
            onClick={onClose}
            className="p-2 bg-[#0E1424] rounded-full border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white shadow-sm transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 md:p-8 space-y-6">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              ID Événement
            </p>
            <div className="flex items-center gap-3">
              <code className="bg-white/5 text-gray-400 px-3 py-1.5 rounded-lg text-sm font-mono flex-1 truncate border border-white/5">
                {log.id}
              </code>
              <button
                onClick={copyId}
                className="p-2 bg-[#0E1424] border border-white/10 rounded-lg hover:bg-white/5 text-gray-400 transition-colors shadow-sm"
                title="Copier l'ID"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                Date d'exécution
              </p>
              <p className="font-bold text-white">
                {new Date(log.created_at).toLocaleString("fr-FR")}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                Catégorie
              </p>
              <Badge variant="gray">{log.event_category || "N/A"}</Badge>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                Type de ticket / Source
              </p>
              <p className="font-bold text-white">
                {log.ticket_type || "Standard"}
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                Temps économisé
              </p>
              <p className="font-bold text-emerald-600">{timeSavedStr}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                Impact (Revenu)
              </p>
              <p className="font-bold text-amber-600">{revStr}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
