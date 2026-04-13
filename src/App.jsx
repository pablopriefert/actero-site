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
import { FaqPage } from "./pages/FaqPage";
import { AuditPage } from "./pages/AuditPage";
import { DashboardGate } from "./components/auth/DashboardGate"
import { DemoDashboardPage } from "./components/ui/demo-dashboard";
import { ProspectDemoPage } from "./pages/ProspectDemoPage";
import { PromptLibraryPage } from "./components/ui/prompt-library-page";
import { SignupPage } from "./pages/SignupPage";
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
import { MarketplacePage } from "./pages/MarketplacePage";
import { MarketplaceTemplatePage } from "./pages/MarketplaceTemplatePage";
import { AcademyPage } from "./pages/AcademyPage";
import { AcademyCoursePage } from "./pages/AcademyCoursePage";
import { AcademyModulePage } from "./pages/AcademyModulePage";
import { ActeroForStartupsPage } from "./pages/ActeroForStartupsPage";
import { CursorGlow } from "./components/ui/cursor-glow";
import { CommandPalette } from "./components/ui/command-palette";
import { ToastProvider } from "./components/ui/Toast";

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
    // Strip query params for route matching
    const pathname = path.split("?")[0].split("#")[0];
    setCurrentRoute(pathname);
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
  else if (currentRoute === "/signup") page = <SignupPage onNavigate={navigate} />;
  else if (currentRoute === "/audit") page = <AuditPage onNavigate={navigate} />;
  else if (currentRoute === "/confidentialite") page = <PrivacyPage onNavigate={navigate} />;
  else if (currentRoute === "/support") page = <SupportGuidePage onNavigate={navigate} />;
  else if (currentRoute === "/mentions-legales") page = <LegalPage onNavigate={navigate} />;
  else if (currentRoute === "/utilisation") page = <TermsPage onNavigate={navigate} />;
  else if (currentRoute === "/demo") page = <DemoDashboardPage onNavigate={navigate} />;
  else if (currentRoute.startsWith("/demo-prospect")) page = <ProspectDemoPage onNavigate={navigate} />;
  else if (currentRoute === "/ressources") page = <PromptLibraryPage onNavigate={navigate} />;
  else if (currentRoute === "/marketplace") page = <MarketplacePage onNavigate={navigate} />;
  else if (currentRoute.startsWith("/marketplace/")) {
    const slug = currentRoute.replace("/marketplace/", "").split("?")[0];
    page = <MarketplaceTemplatePage slug={slug} onNavigate={navigate} />;
  }
  else if (currentRoute === "/academy") page = <AcademyPage onNavigate={navigate} />;
  else if (currentRoute.startsWith("/academy/")) {
    const parts = currentRoute.replace("/academy/", "").split("/").filter(Boolean);
    if (parts.length === 1) {
      page = <AcademyCoursePage slug={parts[0]} onNavigate={navigate} />;
    } else if (parts.length >= 2) {
      page = <AcademyModulePage courseSlug={parts[0]} moduleSlug={parts[1]} onNavigate={navigate} />;
    }
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
  else if (currentRoute === "/startups") page = <ActeroForStartupsPage onNavigate={navigate} />;
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

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(_error) { return { hasError: true, error: _error }; }
  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught:', error?.message, error?.stack?.split('\n').slice(0, 5).join('\n'))
    console.error('[ErrorBoundary] Component stack:', errorInfo?.componentStack?.split('\n').slice(0, 10).join('\n'))
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-950 text-white p-10">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold mb-4">Erreur Inattendue</h1>
            <p className="opacity-70 mb-6">L'application a rencontré un problème critique.</p>
            <pre className="text-left text-[10px] opacity-50 mb-4 max-h-40 overflow-auto bg-black/30 p-3 rounded">{this.state.error?.message || 'Unknown error'}</pre>
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload() }} className="px-6 py-2 bg-white text-red-950 rounded-lg font-bold">Recharger</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <ErrorBoundary>
            <MainRouter />
            <Analytics />
          </ErrorBoundary>
        </ToastProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}
