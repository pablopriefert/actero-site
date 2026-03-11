import React, { useState } from 'react'
import { supabase } from '../../lib/supabase'

export const ResetPasswordPage = ({ onNavigate }) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 8)
      return setError("Mot de passe trop court (8 caractères min).");
    if (password !== confirm)
      return setError("Les mots de passe ne correspondent pas.");

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess("✅ Mot de passe mis à jour. Tu peux te connecter.");
      setTimeout(() => onNavigate("/login"), 800);
    } catch (_e) {
      setError("Erreur pendant la mise à jour. Réessaie via le lien du mail.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white">
          Nouveau mot de passe
        </h2>
        <p className="mt-2 text-sm text-zinc-500 font-medium">
          Choisis un nouveau mot de passe.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#0a0a0a] py-8 px-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/10 sm:rounded-3xl sm:px-10">
          <form className="space-y-6" onSubmit={handleUpdate}>
            {error && (
              <div role="alert" className="p-4 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-100">
                {error}
              </div>
            )}
            {success && (
              <div role="status" className="p-4 bg-emerald-50 text-emerald-600 text-sm font-medium rounded-xl border border-emerald-100">
                {success}
              </div>
            )}

            <div>
              <label htmlFor="new-password" title="Nouveau mot de passe" className="block text-sm font-bold text-white mb-2">
                Nouveau mot de passe
              </label>
              <input
                id="new-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400 sm:text-sm outline-none transition-all text-white placeholder:text-gray-500"
                placeholder="••••••••"
                required
              />
            </div>

            <div>
              <label htmlFor="confirm-password" title="Confirmer le mot de passe" className="block text-sm font-bold text-white mb-2">
                Confirmer
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="block w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400 sm:text-sm outline-none transition-all text-white placeholder:text-gray-500"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3.5 px-4 rounded-xl shadow-sm text-sm font-bold text-black bg-white hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              {loading ? "Mise à jour..." : "Changer le mot de passe"}
            </button>

            <button
              type="button"
              onClick={() => onNavigate("/login")}
              className="w-full text-center text-sm text-zinc-500 hover:text-white font-medium mt-2"
            >
              Retour à la connexion
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
