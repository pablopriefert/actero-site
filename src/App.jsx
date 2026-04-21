import React, { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
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
import { ProductPage } from "./pages/ProductPage";
import { FaqPage } from "./pages/FaqPage";
import { AuditPage } from "./pages/AuditPage";
import { DashboardGate } from "./components/auth/DashboardGate"
import { DemoDashboardPage } from "./components/ui/demo-dashboard";
import { ProspectDemoPage } from "./pages/ProspectDemoPage";
import { PromptLibraryPage } from "./components/ui/prompt-library-page";
import { SignupPage } from "./pages/SignupPage";
import { PlanSelectionPage } from "./pages/PlanSelectionPage";
import { StartPage } from "./pages/StartPage";
import { SuccessPage } from "./pages/SuccessPage";
import { ShopifySuccessPage } from "./pages/ShopifySuccessPage";
import { CancelPage } from "./pages/CancelPage";
import { ReferralLanding } from "./pages/ReferralLanding";
import { PartnerLandingPage } from "./pages/PartnerLandingPage";
import { PartnersLandingPage } from "./pages/PartnersLandingPage";
import { PartnerApplyPage } from "./pages/PartnerApplyPage";
import { PartnersDirectoryPage } from "./pages/PartnersDirectoryPage";
import { PartnerProfilePage } from "./pages/PartnerProfilePage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { SupportGuidePage } from "./pages/SupportGuidePage";
import { LegalPage } from "./pages/LegalPage";
import { TermsPage } from "./pages/TermsPage";
import { ActeroForStartupsPage } from "./pages/ActeroForStartupsPage";
import { AlternativeGorgias } from "./pages/AlternativeGorgias";
import { AlternativeTidio } from "./pages/AlternativeTidio";
import { AlternativeZendesk } from "./pages/AlternativeZendesk";
import PortalApp from './pages/portal/PortalApp.jsx';
import { CursorGlow } from "./components/ui/cursor-glow";
import { CommandPalette } from "./components/ui/command-palette";
import { ToastProvider } from "./components/ui/Toast";
import { Toaster } from "./components/ui/Toaster";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { resetUser } from "./lib/analytics";

const queryClient = new QueryClient();

function isPortalHostname(hostname) {
  if (!hostname) return false;
  if (hostname.endsWith('.portal.actero.fr')) return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get('portal') === '1') return true;
  return false;
}

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
  if (isPortalHostname(window.location.hostname)) {
    return <PortalApp />;
  }

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
    // Strip query params for route matching
    const pathname = path.split("?")[0].split("#")[0];
    setCurrentRoute(pathname);
    window.scrollTo(0, 0);
  };

  const handleLogout = async () => {
    // Reset Amplitude identity BEFORE signOut so any final queued events land on the
    // correct user, and subsequent anonymous browsing starts a fresh device id.
    resetUser();
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
  else if (currentRoute === "/produit") page = <ProductPage onNavigate={navigate} />;
  else if (currentRoute === "/faq") page = <FaqPage onNavigate={navigate} />;
  else if (currentRoute === "/signup") page = <SignupPage onNavigate={navigate} />;
  else if (currentRoute === "/signup/plan") page = <PlanSelectionPage onNavigate={navigate} />;
  else if (currentRoute === "/audit") page = <AuditPage onNavigate={navigate} />;
  else if (currentRoute === "/confidentialite") page = <PrivacyPage onNavigate={navigate} />;
  else if (currentRoute === "/support") page = <SupportGuidePage onNavigate={navigate} />;
  else if (currentRoute === "/mentions-legales") page = <LegalPage onNavigate={navigate} />;
  else if (currentRoute === "/utilisation") page = <TermsPage onNavigate={navigate} />;
  else if (currentRoute === "/demo") page = <DemoDashboardPage onNavigate={navigate} />;
  else if (currentRoute.startsWith("/demo-prospect")) page = <ProspectDemoPage onNavigate={navigate} />;
  else if (currentRoute === "/ressources") page = <PromptLibraryPage onNavigate={navigate} />;
  else if (currentRoute === "/marketplace" || currentRoute.startsWith("/marketplace/")) {
    page = (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🏪</span>
          </div>
          <h2 className="text-2xl font-bold text-[#1a1a1a] mb-2">Marketplace</h2>
          <p className="text-sm text-[#71717a] mb-6">Bientôt disponible — des templates, playbooks et intégrations créés par la communauté Actero.</p>
          <button onClick={() => navigate("/")} className="text-cta font-semibold text-sm hover:underline">Retour à l'accueil</button>
        </div>
      </div>
    );
  }
  else if (currentRoute === "/academy" || currentRoute.startsWith("/academy/")) {
    page = (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🎓</span>
          </div>
          <h2 className="text-2xl font-bold text-[#1a1a1a] mb-2">Actero Academy</h2>
          <p className="text-sm text-[#71717a] mb-6">Bientôt disponible — des cours et tutoriels pour maîtriser l'automatisation IA de votre e-commerce.</p>
          <button onClick={() => navigate("/")} className="text-cta font-semibold text-sm hover:underline">Retour à l'accueil</button>
        </div>
      </div>
    );
  }
  else if (currentRoute.startsWith("/r/")) {
    const referralCode = currentRoute.replace("/r/", "");
    page = <ReferralLanding code={referralCode} onNavigate={navigate} />;
  }
  else if (currentRoute.startsWith("/start/")) {
    const clientSlug = currentRoute.replace("/start/", "").split("?")[0];
    page = <StartPage clientSlug={clientSlug} />;
  }
  else if (currentRoute === "/success") page = <SuccessPage onNavigate={navigate} />;
  else if (currentRoute === "/shopify-success") page = <ShopifySuccessPage onNavigate={navigate} />;
  else if (currentRoute === "/cancel") page = <CancelPage onNavigate={navigate} />;
  else if (currentRoute === "/startups" || currentRoute === "/startup") page = <ActeroForStartupsPage onNavigate={navigate} />;
  else if (currentRoute === "/alternative-gorgias") page = <AlternativeGorgias onNavigate={navigate} />;
  else if (currentRoute === "/alternative-tidio") page = <AlternativeTidio onNavigate={navigate} />;
  else if (currentRoute === "/alternative-zendesk") page = <AlternativeZendesk onNavigate={navigate} />;
  else if (currentRoute === "/partner") page = <PartnerLandingPage onNavigate={navigate} />;
  else if (currentRoute === "/partners-program") page = <PartnersLandingPage onNavigate={navigate} />;
  else if (currentRoute === "/partners/apply") page = <PartnerApplyPage onNavigate={navigate} />;
  else if (currentRoute === "/partners") page = <PartnersDirectoryPage onNavigate={navigate} />;
  else if (currentRoute.startsWith("/partners/")) {
    const partnerSlug = currentRoute.replace("/partners/", "").split("?")[0];
    page = <PartnerProfilePage slug={partnerSlug} onNavigate={navigate} />;
  }
  else if (currentRoute === "/app" || currentRoute.startsWith("/admin") || currentRoute.startsWith("/client")) {
    page = <DashboardGate currentRoute={currentRoute} onNavigate={navigate} onLogout={handleLogout} />;
  } else if (currentRoute === "/payment/success") {
    page = <SuccessPage onNavigate={navigate} />;
  } else {
    page = (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0] text-[#262626]">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-[#716D5C] mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Page introuvable</h2>
          <button onClick={() => navigate("/")} className="mt-4 text-[#003725] font-bold underline underline-offset-4">Retour a l'accueil</button>
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

// ErrorBoundary moved to src/components/ErrorBoundary.jsx — imported above.

export default function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ErrorBoundary>
            <MainRouter />
            <Analytics />
            <Toaster />
          </ErrorBoundary>
        </ToastProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}
