import React, { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { fetchUserRole } from '../lib/auth-utils'

const DEBUG_AUTH = false;
const logger = (...args) => {
  if (DEBUG_AUTH) console.log("[AUTH CALLBACK]", ...args);
};

export function AuthCallbackPage({ onNavigate }) {
  const [errorMsg, setErrorMsg] = useState(null);

  // Detect if this callback is from an invite link
  const isInviteFlow = () => {
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);
    return hash.includes("type=invite") || params.get("type") === "invite";
  };

  const redirectUser = async (session) => {
    // If this is an invite flow, redirect to set password page
    if (isInviteFlow()) {
      logger("Invite flow detected → redirecting to /setup-password");
      onNavigate("/setup-password");
      return;
    }
    // Otherwise, redirect based on role
    const userRole = await fetchUserRole(session.user.id);
    onNavigate(userRole === "admin" ? "/admin" : "/client");
  };

  useEffect(() => {
    logger("Mounted. Checking for session...");

    let mounted = true;

    const checkSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();
        logger(
          "Initial getSession result:",
          session ? "Session Found" : "No Session",
          error,
        );

        if (error) throw error;
        if (session && mounted) {
          logger("Session existante ! Routing...");
          await redirectUser(session);
        }
      } catch (err) {
        if (mounted)
          setErrorMsg(
            err.message || "Erreur lors de la récupération de la session.",
          );
      }
    };

    // First check
    checkSession();

    // Listen for the hash resolution
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      logger(
        "onAuthStateChange emitted:",
        event,
        session ? "Session Active" : "No Session",
      );
      if (session && mounted) {
        logger("Session caught via listener. Routing...");
        redirectUser(session);
      }
    });

    // 8s timeout fallback if something gets stuck
    const timeout = setTimeout(() => {
      if (mounted) {
        logger("Timeout reached. No session resolved.");
        setErrorMsg("Le lien a expiré ou est invalide. Veuillez réessayer.");
      }
    }, 8000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [onNavigate]);

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#030303] flex flex-col justify-center items-center py-12 px-6 font-sans text-center">
        <div className="w-20 h-20 bg-[#0a0a0a] rounded-3xl border border-white/5 shadow-sm flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
          Lien invalide
        </h2>
        <p className="text-gray-400 font-medium max-w-sm mb-10 leading-relaxed">
          {errorMsg}
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => onNavigate("/login")}
            className="bg-zinc-300 text-white px-8 py-3.5 rounded-xl font-bold shadow-md hover:bg-zinc-400 transition-colors"
          >
            Revenir à la connexion
          </button>
          <button
            onClick={() => window.location.replace("/")}
            className="bg-[#0a0a0a] border border-white/10 text-gray-300 px-8 py-3.5 rounded-xl font-bold shadow-sm hover:bg-white/5 transition-colors"
          >
            Retour accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#030303] gap-4 font-sans text-white">
      <svg
        className="animate-spin h-8 w-8 text-white"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      <p className="text-gray-400 text-sm font-medium">Validation du lien en cours...</p>
    </div>
  );
}
