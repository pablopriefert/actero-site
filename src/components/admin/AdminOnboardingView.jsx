import React, { useState } from 'react'
import { 
  UserPlus, 
  AlertCircle, 
  Loader2, 
  CheckCircle, 
  CheckCircle2, 
  Clock, 
  RefreshCw 
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

export const AdminOnboardingView = () => {
  const [brandName, setBrandName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successData, setSuccessData] = useState(null);

  const handleCreateAndInvite = async (e) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessData(null);
    setLoading(true);

    try {
      if (!brandName.trim() || !email.trim()) {
        throw new Error("Le nom de l'entreprise et l'email sont requis.");
      }

      if (!supabase) {
        throw new Error("Backend non configuré.");
      }

      const { data, error } = await supabase.rpc("admin_onboard_client", {
        p_brand_name: brandName.trim(),
        p_email: email.trim(),
      });

      if (error) throw error;
      if (!data?.ok)
        throw new Error(data?.message || "Erreur indéterminée via RPC.");

      setSuccessData(data);
      setBrandName("");
      setEmail("");
    } catch (err) {
      console.error("[ONBOARDING ERROR]", err);
      setErrorMsg(err.message || "Une erreur est survenue.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendMagicLink = async (targetEmail) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: targetEmail });
      if (error) throw error;
      alert("Nouveau lien envoyé !");
    } catch (err) {
      alert("Erreur: " + err.message);
    }
  };

  const handleCheckStatus = async (targetEmail) => {
    try {
      const { data, error } = await supabase.rpc("admin_get_onboarding_status", {
        p_email: targetEmail,
      });
      if (error) throw error;
      if (!data?.ok)
        throw new Error(data?.message || "Erreur de vérification.");
      alert(`Statut: ${data.status}\nLié: ${data.linked ? "Oui" : "Non"}`);
    } catch (err) {
      console.error(err);
      alert("Erreur: " + err.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">
          Onboarding Client
        </h2>
        <p className="text-gray-400 font-normal mt-1 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-zinc-400" />
          Créez un profil client et envoyez-lui un accès immédiat (SaaS fermé).
        </p>
      </div>

      <div className="bg-[#0a0a0a] p-8 rounded-2xl border border-white/10 shadow-sm mb-8">
        <form onSubmit={handleCreateAndInvite} className="space-y-6">
          {errorMsg && (
            <div role="alert" className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-500/20 flex items-start gap-3 text-sm font-medium">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="brand-name" className="block text-sm font-bold text-white mb-2">
                Nom de l'entreprise (Brand)
              </label>
              <input
                id="brand-name"
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Ex: Koma"
                className="w-full px-4 py-3 bg-[#030303] border border-white/10 rounded-xl focus:ring-2 focus:ring-zinc-400 outline-none transition-all text-sm text-white"
                required
              />
            </div>
            <div>
              <label htmlFor="client-email" className="block text-sm font-bold text-white mb-2">
                Email du client
              </label>
              <input
                id="client-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: contact@koma.com"
                className="w-full px-4 py-3 bg-[#030303] border border-white/10 rounded-xl focus:ring-2 focus:ring-zinc-400 outline-none transition-all text-sm text-white"
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto flex justify-center items-center gap-2 py-3 px-6 rounded-xl shadow-sm text-sm font-bold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Création en
                  cours...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" /> Créer & envoyer l'accès
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {successData && (
        <div className="bg-emerald-500/5 border border-emerald-500/20 p-8 rounded-2xl shadow-sm animate-fade-in-up">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white mt-1">
                Client onboardé avec succès !
              </h3>
              <p className="text-emerald-500 text-sm font-medium mt-1">
                Le profil a été créé et l'invitation a été envoyée.
              </p>
            </div>
          </div>

          <div className="bg-[#0a0a0a] rounded-xl border border-white/5 p-4 space-y-3 text-sm mb-6">
            <div className="flex justify-between border-b border-white/5 pb-2 flex-wrap gap-2">
              <span className="text-gray-400 font-medium whitespace-nowrap">
                Client ID
              </span>
              <span className="font-mono font-bold text-white truncate max-w-xs">
                {successData.client_id}
              </span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2 flex-wrap gap-2">
              <span className="text-gray-400 font-medium whitespace-nowrap">
                Email invité
              </span>
              <span className="font-bold text-white truncate max-w-xs">
                {successData.email}
              </span>
            </div>
            <div className="flex justify-between flex-wrap gap-2">
              <span className="text-gray-400 font-medium whitespace-nowrap">
                Statut liaison
              </span>
              <span className="font-bold text-white">
                {successData.linked ? (
                  <span className="text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Lié (
                    {successData.user_id})
                  </span>
                ) : (
                  <span className="text-amber-500 flex items-center gap-1">
                    <Clock className="w-4 h-4" /> En attente de connexion du client
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleResendMagicLink(successData.email)}
              className="bg-white/5 text-white hover:bg-white/10 border border-white/10 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Renvoyer magic link
            </button>
            <button
              onClick={() => handleCheckStatus(successData.email)}
              className="bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              Vérifier le statut
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
