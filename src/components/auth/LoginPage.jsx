import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Mail, Lock } from 'lucide-react'
import { Logo } from '../layout/Logo'
import { ButtonColorful } from '../ui/button-colorful'
import { supabase } from '../../lib/supabase'

export const LoginPage = ({ onNavigate }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isForgot, setIsForgot] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setSuccess("Lien de réinitialisation envoyé par e-mail.");
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;

        const userId = signInData?.user?.id;
        if (userId) {
          const { data: profile } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();
          if (profile?.role === 'ambassador') {
            onNavigate("/ambassador/overview");
            return;
          } else if (profile?.role === 'admin') {
            onNavigate("/admin");
            return;
          }
        }
        onNavigate("/app");
      }
    } catch (_err) {
      setError(
        isForgot
          ? "Erreur lors de l'envoi du lien."
          : "Identifiants incorrects.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError("");
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (_err) {
      setError("Erreur Google Auth.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F7F1] flex items-center justify-center font-sans relative overflow-hidden">
      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-[420px] mx-4"
      >
        <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-lg">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[#F9F7F1] border border-gray-200 flex items-center justify-center mb-5">
              <Logo className="w-7 h-7 text-[#262626]" />
            </div>
            <h1 className="text-[#262626] text-2xl font-bold tracking-tight">
              {isForgot ? "Réinitialiser" : "Bon retour parmi nous"}
            </h1>
            <p className="text-[#716D5C] text-sm mt-1.5">
              {isForgot ? "Entrez votre email pour recevoir un lien." : (
                <>
                  Pas encore de compte ?{" "}
                  <button
                    onClick={() => onNavigate("/signup")}
                    className="text-[#003725] font-semibold hover:text-cta transition-colors"
                  >
                    Créer un compte gratuitement
                  </button>
                </>
              )}
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="p-3 mb-4 bg-red-50 text-red-600 text-xs font-medium rounded-xl border border-red-100 text-center">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 mb-4 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-xl border border-emerald-100 text-center">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716D5C]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-[#F9F7F1] border border-gray-200 rounded-xl text-sm text-[#262626] placeholder:text-[#716D5C]/60 focus:outline-none focus:border-cta/40 transition-all"
                placeholder="adresse email"
              />
            </div>

            {/* Password */}
            {!isForgot && (
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716D5C]" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-[#F9F7F1] border border-gray-200 rounded-xl text-sm text-[#262626] placeholder:text-[#716D5C]/60 focus:outline-none focus:border-cta/40 transition-all"
                  placeholder="Mot de passe"
                />
              </div>
            )}

            {/* Submit */}
            {isForgot ? (
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-full text-sm font-semibold text-white bg-cta hover:bg-[#003725] transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-white mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : "Envoyer le lien"}
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-full text-sm font-bold text-white bg-cta hover:bg-[#003725] transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-white mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : "Se connecter"}
              </button>
            )}
          </form>

          {/* Forgot password */}
          <div className="text-center mt-4">
            <button
              onClick={() => { setIsForgot(!isForgot); setError(""); setSuccess(""); }}
              className="text-xs text-[#716D5C] hover:text-[#262626] transition-colors font-medium"
            >
              {isForgot ? "Retour à la connexion" : "Mot de passe oublié ?"}
            </button>
          </div>

          {/* OAuth separator */}
          {!isForgot && (
            <>
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-[10px] text-[#716D5C] font-medium uppercase tracking-widest">ou</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>

              {/* OAuth buttons */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  className="flex items-center justify-center py-3 rounded-xl bg-[#F9F7F1] border border-gray-200 hover:bg-gray-100 transition-all"
                  disabled
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#262626]" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="flex items-center justify-center py-3 rounded-xl bg-[#F9F7F1] border border-gray-200 hover:bg-gray-100 transition-all disabled:opacity-50"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center py-3 rounded-xl bg-[#F9F7F1] border border-gray-200 hover:bg-gray-100 transition-all"
                  disabled
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#262626]" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </button>
              </div>
            </>
          )}

          <p className="text-center text-[13px] text-[#71717a] mt-6">
            Pas encore de compte ?{' '}
            <a href="/signup" onClick={(e) => { e.preventDefault(); onNavigate('/signup'); }} className="text-cta font-semibold hover:underline">
              Créer un compte gratuitement
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
};
