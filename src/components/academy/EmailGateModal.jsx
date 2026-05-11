import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lock, ArrowRight } from "lucide-react";

const STORAGE_KEY = "actero_academy_email";

// eslint-disable-next-line react-refresh/only-export-components
export function getStoredAcademyEmail() {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function setStoredAcademyEmail(email) {
  try {
    localStorage.setItem(STORAGE_KEY, email);
  } catch {
    // ignore
  }
}

export function EmailGateModal({ open, onClose, onSubmit, courseTitle }) {
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError("Email invalide");
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(email.trim().toLowerCase());
      setStoredAcademyEmail(email.trim().toLowerCase());
    } catch (err) {
      setError(err?.message || "Une erreur est survenue.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: "spring", damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
              aria-label="Fermer"
            >
              <X className="w-4 h-4 text-[#262626]" />
            </button>
            <div className="w-12 h-12 rounded-2xl bg-[#003725]/10 flex items-center justify-center mb-4">
              <Lock className="w-5 h-5 text-[#003725]" />
            </div>
            <h2 className="text-2xl font-bold text-[#262626] mb-2">
              Acceder gratuitement au cours
            </h2>
            <p className="text-sm text-[#716D5C] mb-6">
              {courseTitle
                ? `Entrez votre email pour debloquer "${courseTitle}" et tous les cours de l'Academy.`
                : "Entrez votre email pour acceder aux cours de l'Actero Academy."}
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@entreprise.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#003725] font-medium"
                  autoFocus
                  required
                />
              </div>
              <label className="flex items-start gap-2 text-xs text-[#716D5C] cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  J'accepte de recevoir des mises a jour sur les nouveaux cours et conseils Actero.
                  Vous pouvez vous desinscrire a tout moment.
                </span>
              </label>
              {error && <div className="text-xs text-red-600 font-semibold">{error}</div>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-[#003725] hover:bg-[#00291c] text-white font-bold px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? "Inscription..." : "Acceder au cours"}
                {!submitting && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
