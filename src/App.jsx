import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { AlertCircle } from "lucide-react";
import { supabase, INITIAL_URL } from "./lib/supabase";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./components/auth/LoginPage";
import { ResetPasswordPage } from "./components/auth/ResetPasswordPage";
import { SetPasswordPage } from "./components/auth/SetPasswordPage";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { CompanyPage } from "./pages/CompanyPage";
import { PricingPage } from "./pages/PricingPage";
import { FaqPage } from "./pages/FaqPage";
import { AuditPage } from "./pages/AuditPage";
import { DashboardGate } from "./components/auth/DashboardGate"
import { DemoDashboardPage } from "./components/ui/demo-dashboard";
import { PromptLibraryPage } from "./components/ui/prompt-library-page";
import { StartPage } from "./pages/StartPage";
import { SuccessPage } from "./pages/SuccessPage";
import { CancelPage } from "./pages/CancelPage";
import { CursorGlow } from "./components/ui/cursor-glow";
import { CommandPalette } from "./components/ui/command-palette";

const queryClient = new QueryClient();

function getInitialRoute() {
  // Use INITIAL_URL saved BEFORE Supabase client consumed the hash fragment
  const path = INITIAL_URL.path;
  const hash = INITIAL_URL.hash;
  const search = INITIAL_URL.search;

  if (hash.includes("type=recovery")) return "/reset-password";
  if (path === "/auth/callback" || hash.includes("access_token=")) return "/auth/callback";
  // PKCE flow: Supabase may use a ?code= query param instead of hash
  // But if the redirect already points to a specific page (e.g. /setup-password),
  // let that page handle the session exchange itself
  if (new URLSearchParams(search).has("code") && path === "/") return "/auth/callback";
  return path;
}

function MainRouter() {
  const [currentRoute, setCurrentRoute] = useState(getInitialRoute);
  const [isRouting, _setIsRouting] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState({}, "", path);
    setCurrentRoute(path);
    window.scrollTo(0, 0);
  };

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    navigate("/");
  };

  if (isRouting) return null;

  let page;
  if (currentRoute === "/") page = <LandingPage onNavigate={navigate} />;
  else if (currentRoute === "/login") page = <LoginPage onNavigate={navigate} />;
  else if (currentRoute === "/reset-password") page = <ResetPasswordPage onNavigate={navigate} />;
  else if (currentRoute === "/setup-password") page = <SetPasswordPage onNavigate={navigate} />;
  else if (currentRoute === "/auth/callback") page = <AuthCallbackPage onNavigate={navigate} />;
  else if (currentRoute === "/entreprise") page = <CompanyPage onNavigate={navigate} />;
  else if (currentRoute === "/tarifs") page = <PricingPage onNavigate={navigate} />;
  else if (currentRoute === "/faq") page = <FaqPage onNavigate={navigate} />;
  else if (currentRoute === "/audit") page = <AuditPage onNavigate={navigate} />;
  else if (currentRoute === "/demo") page = <DemoDashboardPage onNavigate={navigate} />;
  else if (currentRoute === "/ressources") page = <PromptLibraryPage onNavigate={navigate} />;
  else if (currentRoute.startsWith("/start/")) {
    const slug = currentRoute.replace("/start/", "").split("?")[0];
    page = <StartPage clientSlug={slug} />;
  }
  else if (currentRoute === "/success") page = <SuccessPage onNavigate={navigate} />;
  else if (currentRoute === "/cancel") page = <CancelPage onNavigate={navigate} />;
  else if (currentRoute === "/app" || currentRoute.startsWith("/admin") || currentRoute.startsWith("/client")) {
    page = <DashboardGate currentRoute={currentRoute} onNavigate={navigate} onLogout={handleLogout} />;
  } else if (currentRoute === "/payment/success") {
    page = (
      <div className="min-h-screen flex items-center justify-center bg-[#030303] font-sans px-6">
        <div className="text-center p-12 bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-2xl max-w-md w-full">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-6">
             <div className="w-10 h-10 text-emerald-500">✓</div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Paiement validé !</h2>
          <p className="text-gray-400 mb-8">Merci pour votre confiance. Préparez-vous à l'autonomie.</p>
          <button onClick={() => navigate("/client")} className="w-full bg-white text-black py-4 rounded-xl font-bold">Accéder à mon espace</button>
        </div>
      </div>
    );
  } else {
    page = (
      <div className="min-h-screen flex items-center justify-center bg-[#030303] text-white">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Page introuvable</h2>
          <button onClick={() => navigate("/")} className="mt-4 text-emerald-400 font-bold">Retour à l'accueil</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <CursorGlow />
      <CommandPalette onNavigate={navigate} />
      {page}
    </>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(_error) { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-950 text-white p-10">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-4">Erreur Inattendue</h1>
            <p className="opacity-70 mb-6">L'application a rencontré un problème critique.</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-white text-red-950 rounded-lg font-bold">Recharger</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <MainRouter />
        <Analytics />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}
