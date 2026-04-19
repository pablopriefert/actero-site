import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, Lock, Store, Gift, ArrowLeft } from "lucide-react";
import { Logo } from "../components/layout/Logo";
import { supabase } from "../lib/supabase";
import { SEO } from "../components/SEO";
import { useMotion } from "../lib/motion";
import { trackEvent } from "../lib/analytics";

export const SignupPage = ({ onNavigate }) => {
  const m = useMotion();
  const [step, setStep] = useState("form"); // 'form' | 'verify'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [brandName, setBrandName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Verification step
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [attemptsLeft, setAttemptsLeft] = useState(null);
  const codeRefs = useRef([]);

  // Referral: URL param for display, cookie as silent fallback for API only
  const referralFromUrl = useMemo(() => {
    return new URLSearchParams(window.location.search).get("referral_code") || null;
  }, []);
  const referralCode = useMemo(() => {
    if (referralFromUrl) return referralFromUrl;
    const match = document.cookie.match(/(?:^|;\s*)referral_code=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [referralFromUrl]);

  // UTM attribution — capture query string params + referrer at mount time.
  // Sent along with signup requests for server-side storage in clients.acquisition_source.
  const acquisitionSource = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const payload = {
      source: params.get("utm_source"),
      medium: params.get("utm_medium"),
      campaign: params.get("utm_campaign"),
      content: params.get("utm_content"),
      term: params.get("utm_term"),
      referrer: document.referrer || null,
      captured_at: new Date().toISOString(),
    };
    // Drop null keys to keep the JSONB clean — backend stores only what was present.
    const cleaned = Object.fromEntries(
      Object.entries(payload).filter(([, v]) => v !== null && v !== "")
    );
    return Object.keys(cleaned).length > 0 ? cleaned : null;
  }, []);

  useEffect(() => {
    if (step === "verify") {
      setTimeout(() => codeRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Veuillez entrer un email valide.");
      return;
    }
    if (!password || password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    if (!brandName.trim()) {
      setError("Le nom de la boutique est requis.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          brand_name: brandName.trim(),
          ...(referralCode && { referral_code: referralCode }),
          ...(acquisitionSource && { acquisition_source: acquisitionSource }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoading(false);
        return;
      }
      setStep("verify");
      setLoading(false);
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
      setLoading(false);
    }
  };

  const handleCodeChange = (i, value) => {
    const v = value.replace(/\D/g, "").slice(-1);
    const newCode = [...code];
    newCode[i] = v;
    setCode(newCode);
    setError("");
    if (v && i < 5) codeRefs.current[i + 1]?.focus();
  };

  const handleCodePaste = (e) => {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      e.preventDefault();
      setCode(pasted.split(""));
      codeRefs.current[5]?.focus();
    }
  };

  const handleVerifyCode = async () => {
    const fullCode = code.join("");
    if (fullCode.length !== 6) {
      setError("Entrez les 6 chiffres.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: fullCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Code invalide.");
        if (typeof data.attempts_left === "number") setAttemptsLeft(data.attempts_left);
        setCode(["", "", "", "", "", ""]);
        codeRefs.current[0]?.focus();
        setLoading(false);
        return;
      }
      // Analytics
      trackEvent('Signed Up', { plan: 'free', source: document.referrer || 'direct' });
      // Auto-login after successful verification
      try {
        await supabase.auth.signInWithPassword({ email, password });
      } catch { /* fallback: user can login manually */ }
      setSuccessMessage("Compte créé ! Redirection…");
      // Go straight to dashboard — Free plan is auto-provisioned on account creation.
      // Upsell to Starter/Pro happens from the dashboard (sidebar CTA + billing tab),
      // not as a forced intermediate step. Reduces signup friction by ~30s + 1 decision.
      setTimeout(() => onNavigate(data.redirect || "/client"), 1200);
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setLoading(true);
    setError("");
    try {
      await fetch("/api/auth/send-verification-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          brand_name: brandName.trim(),
          ...(referralCode && { referral_code: referralCode }),
          ...(acquisitionSource && { acquisition_source: acquisitionSource }),
        }),
      });
      setSuccessMessage("Nouveau code envoyé !");
      setCode(["", "", "", "", "", ""]);
      setAttemptsLeft(null);
      setTimeout(() => setSuccessMessage(""), 3000);
    } catch {
      setError("Erreur réseau.");
    }
    setLoading(false);
  };

  const handleGoogleSignup = async () => {
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
    <>
      <SEO
        title="Inscription — Actero"
        description="Créez votre compte Actero et automatisez votre e-commerce avec l'IA."
      />
      <div className="min-h-screen bg-[#F9F7F1] flex items-center justify-center font-sans relative overflow-hidden">
        <motion.div
          {...m.fadeUp}
          className="relative z-10 w-full max-w-[420px] mx-4"
        >
          <div className="bg-white border border-gray-200 rounded-3xl p-8 shadow-lg">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-14 h-14 rounded-2xl bg-[#F9F7F1] border border-gray-200 flex items-center justify-center mb-5">
                <Logo className="w-7 h-7 text-[#262626]" />
              </div>
              <h1 className="text-[#262626] text-2xl font-bold tracking-tight">
                {step === "verify" ? "Vérifiez votre email" : "Commencez en 30 secondes"}
              </h1>
              <p className="text-[#716D5C] text-sm mt-1.5 text-center">
                {step === "verify" ? (
                  <>Un code à 6 chiffres a été envoyé à <strong className="text-[#262626]">{email}</strong></>
                ) : (
                  "Compte gratuit. Sans carte bancaire. Annulable en 1 clic."
                )}
              </p>
            </div>

            {/* Verification step */}
            {step === "verify" && (
              <>
                {/* Alerts */}
                {error && (
                  <div className="p-3 mb-4 bg-red-50 text-red-600 text-xs font-medium rounded-xl border border-red-100 text-center">
                    {error}
                    {attemptsLeft !== null && attemptsLeft > 0 && ` (${attemptsLeft} essai${attemptsLeft > 1 ? 's' : ''} restant${attemptsLeft > 1 ? 's' : ''})`}
                  </div>
                )}
                {successMessage && (
                  <div className="p-3 mb-4 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-xl border border-emerald-100 text-center">
                    {successMessage}
                  </div>
                )}

                <div role="group" aria-label="Code de vérification à 6 chiffres" className="flex items-center justify-between gap-2 mb-6" onPaste={handleCodePaste}>
                  {code.map((digit, i) => (
                    <input
                      key={i}
                      ref={(el) => (codeRefs.current[i] = el)}
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !digit && i > 0) codeRefs.current[i - 1]?.focus();
                        if (e.key === "Enter") handleVerifyCode();
                      }}
                      disabled={loading}
                      aria-label={`Chiffre ${i + 1} du code de vérification`}
                      className="w-12 h-14 text-center text-2xl font-bold bg-[#F9F7F1] border-2 border-gray-200 rounded-xl focus:outline-none focus:border-cta transition-all disabled:opacity-50"
                    />
                  ))}
                </div>

                <button
                  onClick={handleVerifyCode}
                  disabled={loading || code.join("").length !== 6}
                  className="w-full py-3.5 rounded-full text-sm font-bold text-white bg-cta hover:bg-[#003725] transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <svg className="animate-spin h-5 w-5 text-white mx-auto" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : "Vérifier le code"}
                </button>

                <div className="flex items-center justify-between mt-4 text-xs">
                  <button
                    onClick={() => { setStep("form"); setCode(["","","","","",""]); setError(""); }}
                    className="flex items-center gap-1 text-[#716D5C] hover:text-[#262626]"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Modifier l'email
                  </button>
                  <button
                    onClick={handleResendCode}
                    disabled={loading}
                    className="text-cta hover:underline font-semibold disabled:opacity-50"
                  >
                    Renvoyer le code
                  </button>
                </div>
              </>
            )}

            {/* Form step */}
            {step === "form" && <>

            {/* Referral banner */}
            {referralFromUrl && (
              <div className="flex items-center gap-2 p-3 mb-4 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-xl border border-emerald-100 text-center justify-center">
                <Gift className="w-4 h-4 flex-shrink-0" />
                <span>Votre premier mois est offert grace a votre parrain !</span>
              </div>
            )}

            {/* Alerts */}
            {error && (
              <div className="p-3 mb-4 bg-red-50 text-red-600 text-xs font-medium rounded-xl border border-red-100 text-center">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="p-3 mb-4 bg-emerald-50 text-emerald-600 text-xs font-medium rounded-xl border border-emerald-100 text-center">
                {successMessage}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716D5C]" aria-hidden="true" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  aria-label="Adresse email"
                  className="w-full pl-11 pr-4 py-3.5 bg-[#F9F7F1] border border-gray-200 rounded-xl text-sm text-[#262626] placeholder:text-[#716D5C]/60 focus:outline-none focus:border-cta/40 transition-all"
                  placeholder="adresse email"
                />
              </div>

              {/* Password */}
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716D5C]" aria-hidden="true" />
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-label="Mot de passe (minimum 8 caractères)"
                  className="w-full pl-11 pr-4 py-3.5 bg-[#F9F7F1] border border-gray-200 rounded-xl text-sm text-[#262626] placeholder:text-[#716D5C]/60 focus:outline-none focus:border-cta/40 transition-all"
                  placeholder="Mot de passe (min. 8 caractères)"
                />
              </div>

              {/* Confirm password */}
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716D5C]" aria-hidden="true" />
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  aria-label="Confirmer le mot de passe"
                  aria-invalid={!!(confirmPassword && password !== confirmPassword)}
                  className={`w-full pl-11 pr-4 py-3.5 bg-[#F9F7F1] border rounded-xl text-sm text-[#262626] placeholder:text-[#716D5C]/60 focus:outline-none transition-all ${
                    confirmPassword && password !== confirmPassword
                      ? 'border-red-300 focus:border-red-400'
                      : 'border-gray-200 focus:border-cta/40'
                  }`}
                  placeholder="Confirmer le mot de passe"
                />
              </div>

              {/* Brand name */}
              <div className="relative">
                <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#716D5C]" aria-hidden="true" />
                <input
                  type="text"
                  required
                  autoComplete="organization"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  aria-label="Nom de votre boutique"
                  className="w-full pl-11 pr-4 py-3.5 bg-[#F9F7F1] border border-gray-200 rounded-xl text-sm text-[#262626] placeholder:text-[#716D5C]/60 focus:outline-none focus:border-cta/40 transition-all"
                  placeholder="Nom de la boutique"
                />
              </div>

              {/* Submit */}
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
                ) : "Commencer mon essai gratuit"}
              </button>
            </form>

            {/* OAuth separator */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-[10px] text-[#716D5C] font-medium uppercase tracking-widest">ou</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* OAuth buttons */}
            <div className="grid grid-cols-3 gap-3" role="group" aria-label="Inscription via réseaux sociaux">
              <button
                type="button"
                aria-label="S'inscrire avec Apple (bientôt disponible)"
                title="Apple — bientôt disponible"
                className="flex items-center justify-center py-3 rounded-xl bg-[#F9F7F1] border border-gray-200 hover:bg-gray-100 transition-all"
                disabled
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#262626]" fill="currentColor" aria-hidden="true">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={loading}
                aria-label="S'inscrire avec Google"
                className="flex items-center justify-center py-3 rounded-xl bg-[#F9F7F1] border border-gray-200 hover:bg-gray-100 transition-all disabled:opacity-50"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="S'inscrire avec X / Twitter (bientôt disponible)"
                title="X — bientôt disponible"
                className="flex items-center justify-center py-3 rounded-xl bg-[#F9F7F1] border border-gray-200 hover:bg-gray-100 transition-all"
                disabled
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 text-[#262626]" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </button>
            </div>

            <p className="text-center text-[13px] text-[#71717a] mt-6">
              Déjà un compte ?{" "}
              <button
                onClick={() => onNavigate("/login")}
                className="text-cta font-semibold hover:underline"
              >
                Se connecter
              </button>
            </p>
            </>}
          </div>
        </motion.div>
      </div>
    </>
  );
};
