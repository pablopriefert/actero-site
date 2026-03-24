import React, { useState, useEffect } from 'react'
import { X, Loader2, CheckCircle, Settings, Rocket, Globe, Sparkles } from 'lucide-react'
import { supabase } from '../../lib/supabase'

const WORKFLOW_TEMPLATES = [
  { id: 'tpl_sav_ecommerce', label: 'SAV E-commerce' },
  { id: 'tpl_paniers_abandonnes', label: 'Paniers abandonnés' },
  { id: 'tpl_prise_rdv_immobilier', label: 'Prise RDV Immobilier' },
  { id: 'tpl_collecte_documents', label: 'Collecte Documents' },
  { id: 'tpl_relance_prospects', label: 'Relance Prospects' },
];

export const AdminClientSettingsModal = ({ client, onClose, onSaved, onOpenCallNotes }) => {
  const [hourlyCost, setHourlyCost] = useState("");
  const [avgTicketTime, setAvgTicketTime] = useState("");
  const [acteroPrice, setActeroPrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Deploy workflow state
  const [selectedTemplate, setSelectedTemplate] = useState(WORKFLOW_TEMPLATES[0].id);
  const [deploying, setDeploying] = useState(false);
  const [deployMsg, setDeployMsg] = useState(null);

  // Brand context state
  const [brandUrl, setBrandUrl] = useState("");
  const [brandContext, setBrandContext] = useState("");
  const [generatingBrand, setGeneratingBrand] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [brandMsg, setBrandMsg] = useState(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase
        .from("client_settings")
        .select("hourly_cost, avg_ticket_time_min, actero_monthly_price, brand_context")
        .eq("client_id", client.id)
        .maybeSingle();

      if (data) {
        setHourlyCost(data.hourly_cost?.toString() || "");
        setAvgTicketTime(data.avg_ticket_time_min?.toString() || "");
        setActeroPrice(data.actero_monthly_price?.toString() || "");
        if (data.brand_context) setBrandContext(data.brand_context);
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

  const handleDeploy = async () => {
    setDeploying(true);
    setDeployMsg(null);
    try {
      const res = await fetch("/api/deploy-workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate,
          clientId: client.id,
          clientName: client.brand_name,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur serveur" }));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      setDeployMsg({ type: "success", text: "Workflow déployé avec succès !" });
    } catch (err) {
      setDeployMsg({ type: "error", text: err.message });
    } finally {
      setDeploying(false);
    }
  };

  const handleGenerateBrandContext = async () => {
    if (!brandUrl.trim()) return;
    setGeneratingBrand(true);
    setBrandMsg(null);
    try {
      const res = await fetch("/api/generate-brand-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: brandUrl.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erreur serveur" }));
        throw new Error(err.error || `Erreur ${res.status}`);
      }
      const data = await res.json();
      setBrandContext(data.brand_context || data.result || "");
      setBrandMsg({ type: "success", text: "Brand context généré !" });
    } catch (err) {
      setBrandMsg({ type: "error", text: err.message });
    } finally {
      setGeneratingBrand(false);
    }
  };

  const handleSaveBrandContext = async () => {
    setSavingBrand(true);
    setBrandMsg(null);
    try {
      const { error: upsertError } = await supabase
        .from("client_settings")
        .upsert({
          client_id: client.id,
          brand_context: brandContext,
        }, { onConflict: "client_id" });
      if (upsertError) throw upsertError;
      setBrandMsg({ type: "success", text: "Brand context sauvegardé !" });
    } catch (err) {
      setBrandMsg({ type: "error", text: err.message });
    } finally {
      setSavingBrand(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-zinc-400" />
            <h3 className="text-lg font-bold text-white">{client.brand_name}</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick access: Call Notes */}
        {onOpenCallNotes && (
          <button
            onClick={onOpenCallNotes}
            className="w-full mb-6 flex items-center gap-3 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl hover:bg-emerald-500/15 transition-colors text-left"
          >
            <Rocket className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-sm font-bold text-emerald-400">Notes de call & Deploiement</p>
              <p className="text-xs text-gray-500">Formulaire structure + deploiement automatise</p>
            </div>
          </button>
        )}

        {fetching ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-white mb-2">
                Coût horaire client (€/h)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={hourlyCost}
                onChange={(e) => setHourlyCost(e.target.value)}
                placeholder="Ex: 25"
                className="w-full px-4 py-3 bg-[#030303] border border-white/10 rounded-xl focus:ring-2 focus:ring-zinc-400 outline-none transition-all text-sm text-white"
              />
              <p className="text-xs text-zinc-500 mt-1">Utilisé pour calculer money_saved = temps × coût</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-white mb-2">
                Temps moyen / ticket (min)
              </label>
              <input
                type="number"
                min="1"
                value={avgTicketTime}
                onChange={(e) => setAvgTicketTime(e.target.value)}
                placeholder="Ex: 5"
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

        {/* Déploiement workflow */}
        {!fetching && (
          <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Rocket className="w-4 h-4 text-blue-400" />
              <h4 className="text-sm font-bold text-white">Déploiement workflow</h4>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1.5">Template</label>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-4 py-3 bg-[#030303] border border-white/10 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/40 transition-all appearance-none"
              >
                {WORKFLOW_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleDeploy}
              disabled={deploying}
              className="w-full flex justify-center items-center gap-2 py-3 px-6 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {deploying ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Déploiement...</>
              ) : (
                <><Rocket className="w-4 h-4" /> Déployer</>
              )}
            </button>
            {deployMsg && (
              <p className={`text-sm font-medium flex items-center gap-2 ${deployMsg.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                {deployMsg.type === "success" && <CheckCircle className="w-4 h-4" />}
                {deployMsg.text}
              </p>
            )}
          </div>
        )}

        {/* Brand Context */}
        {!fetching && (
          <div className="mt-6 pt-6 border-t border-white/10 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe className="w-4 h-4 text-violet-400" />
              <h4 className="text-sm font-bold text-white">Brand Context</h4>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1.5">URL du site</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={brandUrl}
                  onChange={(e) => setBrandUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="flex-1 px-4 py-3 bg-[#030303] border border-white/10 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/40 transition-all"
                />
                <button
                  onClick={handleGenerateBrandContext}
                  disabled={generatingBrand || !brandUrl.trim()}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {generatingBrand ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Générer
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-400 mb-1.5">Brand context</label>
              <textarea
                value={brandContext}
                onChange={(e) => setBrandContext(e.target.value)}
                rows={5}
                placeholder="Le brand context apparaîtra ici après génération..."
                className="w-full px-4 py-3 bg-[#030303] border border-white/10 rounded-xl text-sm text-white outline-none focus:ring-2 focus:ring-violet-500/40 transition-all resize-y"
              />
            </div>
            <button
              onClick={handleSaveBrandContext}
              disabled={savingBrand || !brandContext.trim()}
              className="w-full flex justify-center items-center gap-2 py-3 px-6 rounded-xl text-sm font-bold text-white bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
            >
              {savingBrand ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Sauvegarde...</>
              ) : (
                "Sauvegarder le brand context"
              )}
            </button>
            {brandMsg && (
              <p className={`text-sm font-medium flex items-center gap-2 ${brandMsg.type === "success" ? "text-emerald-400" : "text-red-400"}`}>
                {brandMsg.type === "success" && <CheckCircle className="w-4 h-4" />}
                {brandMsg.text}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
