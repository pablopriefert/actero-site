import React, { useState, useEffect } from 'react'
import { AlertCircle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { fetchUserRole } from '../../lib/auth-utils'
import { TenantContext } from '../../context/TenantContext'
import { AdminDashboard } from '../../pages/AdminDashboard'
import { ClientDashboard } from '../../pages/ClientDashboard'
import { RealEstateDashboard } from '../../pages/RealEstateDashboard'
import { ZendeskClientWidget } from '../ZendeskClientWidget'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_URL !== "REPLACE_ME");

const dLog = (..._args) => {
  // if (true) console.log("[GATE]", ...args);
};

export const DashboardGate = ({ onNavigate, onLogout, currentRoute }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [clientId, setClientId] = useState(null);
  const [clientType, setClientType] = useState(null);
  const [role, setRole] = useState(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [tenantError, setTenantError] = useState(null);

  useEffect(() => {
    let mounted = true;

    const fetchWithRetry = async (fn, maxRetries = 3, delayMs = 1500) => {
      let attempts = 0;
      while (attempts < maxRetries) {
        try {
          return await fn();
        } catch (error) {
          attempts++;
          dLog(`Attempt ${attempts} failed:`, error.message);
          if (attempts >= maxRetries) throw error;
          await new Promise((r) => setTimeout(r, delayMs * attempts)); 
        }
      }
    };

    const checkTenant = async () => {
      try {
        dLog(`Initiating Tenant Check... (Current Route: ${currentRoute})`);
        if (!isSupabaseConfigured || !supabase) {
          throw new Error("Base de données non configurée.");
        }

        const {
          data: { session: activeSession },
          error: authError,
        } = await supabase.auth.getSession();

        if (authError) throw authError;

        if (!activeSession) {
          dLog("Session status: Unauthenticated, redirecting to login.");
          if (mounted) onNavigate("/login");
          return;
        }

        if (mounted) {
          setSession(activeSession);
          setUser(activeSession.user);
        }

        const userRole = await fetchWithRetry(async () => {
          return await fetchUserRole(activeSession.user.id);
        });

        if (userRole === "admin") {
          if (mounted) {
            setRole("admin");
            setClientId("ADMIN_BYPASS");
            if (currentRoute === "/app" || currentRoute.startsWith("/client")) {
              onNavigate("/admin");
            }
          }
        } else {
          if (currentRoute.startsWith("/admin")) {
            if (mounted) onNavigate("/client");
          }
          if (currentRoute === "/app") {
            if (mounted) onNavigate("/client");
          }

          const mappingResult = await fetchWithRetry(async () => {
            const { data, error } = await supabase
              .from("client_users")
              .select("client_id, role")
              .eq("user_id", activeSession.user.id)
              .maybeSingle();

            if (error) throw error;
            return data;
          });

          if (mounted) {
            let resolvedClientId = null;

            if (mappingResult) {
              resolvedClientId = mappingResult.client_id;
              setClientId(resolvedClientId);
              setRole(mappingResult.role || "client");
            } else {
              const { data: ownedClient } = await supabase
                .from("clients")
                .select("id")
                .eq("owner_user_id", activeSession.user.id)
                .maybeSingle();

              if (ownedClient) {
                resolvedClientId = ownedClient.id;
                setClientId(resolvedClientId);
                setRole("client");
              } else {
                setClientId(null);
                setRole("client");
              }
            }

            // Fetch client_type to route to correct dashboard
            if (resolvedClientId) {
              const { data: clientData } = await supabase
                .from("clients")
                .select("client_type")
                .eq("id", resolvedClientId)
                .maybeSingle();

              if (clientData?.client_type) {
                setClientType(clientData.client_type);
              } else {
                setClientType("ecommerce");
              }
            }
          }
        }
      } catch (_err) {
        if (mounted)
          setTenantError(
            "Nous n'avons pas pu valider votre environnement (Erreur DB). Veuillez réessayer ou contacter le support.",
          );
      } finally {
        if (mounted) setLoadingTenant(false);
      }
    };

    checkTenant();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!currentSession) {
        if (mounted) {
          setSession(null);
          setUser(null);
          setClientId(null);
          setRole(null);
          onNavigate("/login");
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [onNavigate, currentRoute]);

  if (tenantError) {
    return (
      <div className="min-h-screen bg-[#030303] flex flex-col justify-center items-center py-12 px-6 font-sans text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
          Erreur de connexion
        </h2>
        <p className="text-gray-400 font-medium max-w-sm mb-8">{tenantError}</p>
        <button
          onClick={() => window.location.reload()}
          className="bg-[#0a0a0a] border border-white/10 text-gray-300 px-6 py-3 rounded-xl font-bold text-sm shadow-sm hover:bg-white/5 transition-colors"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (loadingTenant || !role) {
    return (
      <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center font-sans">
        <svg
          className="animate-spin h-10 w-10 text-white mb-4"
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
        <p className="text-gray-400 text-sm font-medium">Chargement de votre espace...</p>
      </div>
    );
  }

  return (
    <TenantContext.Provider
      value={{ session, user, clientId, clientType, role, loadingTenant }}
    >
      {role === "admin" ? (
        <AdminDashboard onNavigate={onNavigate} onLogout={onLogout} currentRoute={currentRoute} />
      ) : (
        <>
          {/* Widget Zendesk client — support dédié aux clients connectés uniquement */}
          <ZendeskClientWidget />
          {clientType === "immobilier" ? (
            <RealEstateDashboard onNavigate={onNavigate} onLogout={onLogout} currentRoute={currentRoute} />
          ) : (
            <ClientDashboard onNavigate={onNavigate} onLogout={onLogout} currentRoute={currentRoute} />
          )}
        </>
      )}
    </TenantContext.Provider>
  );
};
