import React, { useState, useEffect } from 'react'
import { X, Loader2, CheckCircle, Settings } from 'lucide-react'
import { supabase } from '../../lib/supabase'

export const AdminClientSettingsModal = ({ client, onClose, onSaved, clientType }) => {
  const isImmo = clientType === 'immobilier' || client?.client_type === 'immobilier';
  const [hourlyCost, setHourlyCost] = useState("");
  const [avgTicketTime, setAvgTicketTime] = useState("");
  const [acteroPrice, setActeroPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("client_settings")
        .select("hourly_cost, avg_ticket_time_min, actero_monthly_price")
        .eq("client_id", client.id)
        .maybeSingle();

      if (data) {
        setHourlyCost(data.hourly_cost?.toString() || "");
        setAvgTicketTime(data.avg_ticket_time_min?.toString() || "");
        setActeroPrice(data.actero_monthly_price?.toString() || "");
      }
      setFetching(false);
    };
    fetchSettings();
  }, [client.id]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSaved(false);

    try {
      const { error: upsertError } = await supabase
        .from("client_settings")
        .upsert({
          client_id: client.id,
          hourly_cost: hourlyCost ? parseFloat(hourlyCost) : 0,
          avg_ticket_time_min: avgTicketTime ? parseInt(avgTicketTime, 10) : 5,
          actero_monthly_price: acteroPrice ? parseFloat(acteroPrice) : 0,
          currency: "EUR",
        }, { onConflict: "client_id" });

      if (upsertError) throw upsertError;
      setSaved(true);
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-zinc-400" />
            <h3 className="text-lg font-bold text-white">{client.brand_name}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {fetching ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-white mb-2">
                {isImmo ? 'Coût horaire agent (€/h)' : 'Coût horaire support (€/h)'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={hourlyCost}
                onChange={(e) => setHourlyCost(e.target.value)}
                placeholder={isImmo ? 'Ex: 30' : 'Ex: 25'}
                className="w-full px-4 py-3 bg-[#030303] border border-white/10 rounded-xl focus:ring-2 focus:ring-zinc-400 outline-none transition-all text-sm text-white"
              />
              <p className="text-xs text-zinc-500 mt-1">
                {isImmo ? 'Utilisé pour calculer money_saved = temps traitement lead × coût' : 'Utilisé pour calculer money_saved = temps × coût'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-bold text-white mb-2">
                {isImmo ? 'Temps moyen / lead (min)' : 'Temps moyen / ticket (min)'}
              </label>
              <input
                type="number"
                min="1"
                value={avgTicketTime}
                onChange={(e) => setAvgTicketTime(e.target.value)}
                placeholder={isImmo ? 'Ex: 8' : 'Ex: 5'}
                className="w-full px-4 py-3 bg-[#030303] border border-white/10 rounded-xl focus:ring-2 focus:ring-zinc-400 outline-none transition-all text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-white mb-2">
                Prix Actero mensuel (€)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={acteroPrice}
                onChange={(e) => setActeroPrice(e.target.value)}
                placeholder="Ex: 490"
                className="w-full px-4 py-3 bg-[#030303] border border-white/10 rounded-xl focus:ring-2 focus:ring-zinc-400 outline-none transition-all text-sm text-white"
              />
              <p className="text-xs text-zinc-500 mt-1">Pour le calcul du ROI net</p>
            </div>

            {error && (
              <p className="text-sm text-red-400 font-medium">{error}</p>
            )}

            {saved && (
              <p className="text-sm text-emerald-400 font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Configuration sauvegardée
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-3 px-6 rounded-xl text-sm font-bold text-white bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sauvegarde...</>
              ) : (
                "Sauvegarder"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
