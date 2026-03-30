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
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center font-sans relative overflow-hidden">
      {/* Circuit board background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="circuit" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
              <path d="M0 100h80m40 0h80M100 0v80m0 40v80" stroke="white" strokeWidth="1" fill="none" />
              <rect x="80" y="80" width="40" height="40" rx="4" stroke="white" strokeWidth="1" fill="none" />
              <circle cx="80" cy="100" r="3" fill="white" />
              <circle cx="120" cy="100" r="3" fill="white" />
              <circle cx="100" cy="80" r="3" fill="white" />
              <circle cx="100" cy="120" r="3" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#circuit)" />
        </svg>
      </div>

      {/* Corner nodes */}
      <div className="absolute top-12 left-12 w-20 h-10 rounded-lg border border-white/10 bg-white/[0.02] hidden lg:flex items-center justify-center">
        <div className="flex gap-1.5">
          {[...Array(6)].map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/20" />)}
        </div>
      </div>
      <div className="absolute top-12 right-12 w-20 h-10 rounded-lg border border-white/10 bg-white/[0.02] hidden lg:flex items-center justify-center">
        <div className="flex gap-1.5">
          {[...Array(6)].map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/20" />)}
        </div>
      </div>
      <div className="absolute bottom-12 left-12 w-20 h-10 rounded-lg border border-white/10 bg-white/[0.02] hidden lg:flex items-center justify-center">
        <div className="flex gap-1.5">
          {[...Array(6)].map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/20" />)}
        </div>
      </div>
      <div className="absolute bottom-12 right-12 w-20 h-10 rounded-lg border border-white/10 bg-white/[0.02] hidden lg:flex items-center justify-center">
        <div className="flex gap-1.5">
          {[...Array(6)].map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/20" />)}
        </div>
      </div>

      {/* Lines connecting corners */}
      <div className="absolute top-[3.25rem] left-32 right-32 h-px bg-gradient-to-r from-white/5 via-white/10 to-white/5 hidden lg:block" />
      <div className="absolute bottom-[3.25rem] left-32 right-32 h-px bg-gradient-to-r from-white/5 via-white/10 to-white/5 hidden lg:block" />
      <div className="absolute left-[5.5rem] top-24 bottom-24 w-px bg-gradient-to-b from-white/5 via-white/10 to-white/5 hidden lg:block" />
      <div className="absolute right-[5.5rem] top-24 bottom-24 w-px bg-gradient-to-b from-white/5 via-white/10 to-white/5 hidden lg:block" />

      {/* Login card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-[420px] mx-4"
      >
        <div className="bg-[#0a0a0f]/80 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-8 shadow-2xl shadow-black/50">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[#111] border border-white/10 flex items-center justify-center mb-5">
              <Logo light={true} className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-white text-2xl font-bold tracking-tight">
              {isForgot ? "Réinitialiser" : "Bon retour parmi nous"}
            </h1>
            <p className="text-zinc-500 text-sm mt-1.5">
              {isForgot ? "Entrez votre email pour recevoir un lien." : (
                <>
                  Pas encore de compte ?{" "}
                  <button
                    onClick={() => onNavigate("/audit")}
                    className="text-white font-semibold hover:text-zinc-300 transition-colors"
                  >
                    Contactez-nous
                  </button>
                </>
              )}
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <div className="p-3 mb-4 bg-red-500/10 text-red-400 text-xs font-medium rounded-xl border border-red-500/20 text-center">
              {error}
            </div>
          )}
          {success && (
            <div className="p-3 mb-4 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-xl border border-emerald-500/20 text-center">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3.5 bg-[#111] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-all"
                placeholder="adresse email"
              />
            </div>

            {/* Password */}
            {!isForgot && (
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 bg-[#111] border border-white/[0.08] rounded-xl text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-white/20 transition-all"
                  placeholder="Mot de passe"
                />
              </div>
            )}

            {/* Submit */}
            {isForgot ? (
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-zinc-300 bg-[#27272a] hover:bg-[#3f3f46] hover:text-white transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-zinc-400 mx-auto" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : "Envoyer le lien"}
              </button>
            ) : (
              <ButtonColorful
                type="submit"
                disabled={loading}
                className="w-full disabled:opacity-50"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : "Se connecter"}
              </ButtonColorful>
            )}
          </form>

          {/* Forgot password */}
          <div className="text-center mt-4">
            <button
              onClick={() => { setIsForgot(!isForgot); setError(""); setSuccess(""); }}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium"
            >
              {isForgot ? "Retour à la connexion" : "Mot de passe oublié ?"}
            </button>
          </div>

          {/* OAuth separator */}
          {!isForgot && (
            <>
              <div className="flex items-center gap-4 my-6">
                <div className="flex-1 h-px bg-white/[0.06]" />
                <span className="text-[10px] text-zinc-600 font-medium uppercase tracking-widest">ou</span>
                <div className="flex-1 h-px bg-white/[0.06]" />
              </div>

              {/* OAuth buttons */}
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  className="flex items-center justify-center py-3 rounded-xl bg-[#111] border border-white/[0.08] hover:bg-[#1a1a1a] hover:border-white/15 transition-all"
                  disabled
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="flex items-center justify-center py-3 rounded-xl bg-[#111] border border-white/[0.08] hover:bg-[#1a1a1a] hover:border-white/15 transition-all disabled:opacity-50"
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
                  className="flex items-center justify-center py-3 rounded-xl bg-[#111] border border-white/[0.08] hover:bg-[#1a1a1a] hover:border-white/15 transition-all"
                  disabled
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 text-white" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
};
