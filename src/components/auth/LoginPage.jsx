import React, { useState } from 'react'
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
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
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
    <div className="min-h-screen bg-[#030303] flex font-sans">
      {/* ─── Left: Form ─── */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 sm:px-12 md:px-20 lg:px-16 xl:px-24 py-12">
        <div className="max-w-[420px] w-full mx-auto">
          {/* Logo + Brand */}
          <div className="flex items-center gap-3 mb-14">
            <button
              onClick={() => onNavigate("/")}
              aria-label="Retour à l'accueil"
              className="w-10 h-10 rounded-full bg-[#18181b] flex items-center justify-center border border-white/5 hover:scale-105 transition-transform"
            >
              <Logo light={true} className="w-5 h-5 text-white" />
            </button>
            <span className="text-white text-lg font-semibold tracking-tight">Actero</span>
          </div>

          {/* Heading */}
          <h1 className="text-white text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Bon retour parmi nous
          </h1>
          <p className="text-zinc-500 text-sm mb-10">
            Vous n'avez pas de compte ?{" "}
            <button
              onClick={() => onNavigate("/audit")}
              className="text-white hover:text-zinc-300 underline underline-offset-4 decoration-zinc-700 hover:decoration-zinc-500 transition-colors font-medium"
            >
              Contactez-nous
            </button>
          </p>

          <form className="space-y-5 flex flex-col" onSubmit={handleSubmit}>
            {/* Alerts */}
            {error && (
              <div role="alert" className="p-3 bg-red-500/10 text-red-400 text-xs font-medium rounded-xl border border-red-500/20 text-center">
                {error}
              </div>
            )}
            {success && (
              <div role="status" className="p-3 bg-emerald-500/10 text-emerald-400 text-xs font-medium rounded-xl border border-emerald-500/20 text-center">
                {success}
              </div>
            )}

            {/* OAuth Buttons */}
            {!isForgot && (
              <>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 rounded-[14px] text-sm font-semibold text-white bg-[#18181b] border border-white/10 hover:bg-[#27272a] hover:border-white/15 transition-all disabled:opacity-50 h-[48px]"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continuer avec Google
                </button>

                {/* Separator */}
                <div className="flex items-center gap-4 my-1">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-xs text-zinc-600 font-medium uppercase tracking-wider">ou</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              </>
            )}

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-zinc-400 mb-2">
                Adresse e-mail
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 bg-[#18181b] border border-white/10 rounded-[14px] focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500 outline-none transition-all text-sm text-white placeholder:text-zinc-600 font-medium disabled:opacity-50"
                placeholder="nom@entreprise.com"
              />
            </div>

            {/* Password */}
            {!isForgot && (
              <div>
                <label htmlFor="password" className="block text-xs font-medium text-zinc-400 mb-2">
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3.5 bg-[#18181b] border border-white/10 rounded-[14px] focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500 outline-none transition-all text-sm text-white placeholder:text-zinc-600 font-medium disabled:opacity-50"
                  placeholder="••••••••"
                />
                <p className="text-[11px] text-zinc-600 mt-2">Minimum 8 caractères</p>
              </div>
            )}

            {/* Submit */}
            {isForgot ? (
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 mt-2 rounded-[14px] text-sm font-semibold text-zinc-300 bg-[#27272a] hover:bg-[#3f3f46] hover:text-white transition-colors disabled:opacity-50 h-[48px] flex items-center justify-center"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  "Envoyer le lien"
                )}
              </button>
            ) : (
              <ButtonColorful
                type="submit"
                disabled={loading}
                className="w-full mt-2 disabled:opacity-50"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-zinc-500" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  "Se connecter"
                )}
              </ButtonColorful>
            )}

            {/* Forgot password link */}
            <div className="flex items-center justify-center mt-4 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsForgot(!isForgot);
                  setError("");
                  setSuccess("");
                }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium underline underline-offset-4 decoration-zinc-800 hover:decoration-zinc-600"
              >
                {isForgot ? "Retour à la connexion" : "Mot de passe oublié ?"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ─── Right: Cyan Aurora ─── */}
      <div className="hidden lg:block w-1/2 relative overflow-hidden bg-[#030303]">
        {/* Aurora band 1 */}
        <div
          className="absolute top-[15%] left-[-10%] w-[120%] h-[35%] pointer-events-none opacity-50"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.1) 25%, rgba(6,182,212,0.16) 50%, rgba(6,182,212,0.1) 75%, transparent 100%)',
            borderRadius: '50%',
            filter: 'blur(60px)',
            transform: 'rotate(-3deg)',
            animation: 'aurora-login-1 12s ease-in-out infinite alternate',
          }}
        />
        {/* Aurora band 2 */}
        <div
          className="absolute top-[30%] left-[-5%] w-[110%] h-[20%] pointer-events-none opacity-40"
          style={{
            background: 'linear-gradient(90deg, transparent 5%, rgba(6,182,212,0.12) 30%, rgba(6,182,212,0.18) 50%, rgba(6,182,212,0.1) 70%, transparent 95%)',
            borderRadius: '50%',
            filter: 'blur(50px)',
            transform: 'rotate(2deg)',
            animation: 'aurora-login-2 15s ease-in-out infinite alternate',
          }}
        />
        {/* Aurora band 3 */}
        <div
          className="absolute top-[50%] left-[5%] w-[90%] h-[15%] pointer-events-none opacity-30"
          style={{
            background: 'linear-gradient(90deg, transparent 10%, rgba(6,182,212,0.14) 35%, rgba(6,182,212,0.1) 65%, transparent 100%)',
            borderRadius: '50%',
            filter: 'blur(45px)',
            transform: 'rotate(-1deg)',
            animation: 'aurora-login-3 18s ease-in-out infinite alternate',
          }}
        />
        {/* Left edge fade */}
        <div className="absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-[#030303] to-transparent" />
        <style>{`
          @keyframes aurora-login-1 {
            0%   { transform: rotate(-3deg) translateX(-3%) translateY(0); }
            100% { transform: rotate(-1deg) translateX(3%) translateY(-8px); }
          }
          @keyframes aurora-login-2 {
            0%   { transform: rotate(2deg) translateX(2%) translateY(0); }
            100% { transform: rotate(0deg) translateX(-2%) translateY(10px); }
          }
          @keyframes aurora-login-3 {
            0%   { transform: rotate(-1deg) translateX(0) translateY(0); }
            100% { transform: rotate(1deg) translateX(4%) translateY(-5px); }
          }
        `}</style>
      </div>
    </div>
  );
};
