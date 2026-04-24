import React, { useState, useEffect, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HelmetProvider } from "react-helmet-async";
import { Analytics } from "@vercel/analytics/react";
import { AlertCircle } from "lucide-react";
import { supabase, INITIAL_URL } from "./lib/supabase";
// Eager: high-traffic landing pages where TTFB matters and the user is on the
// first hop in. Everything else is lazy to slim the initial bundle.
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./components/auth/LoginPage";
import { DashboardGate } from "./components/auth/DashboardGate"

// Lazy: secondary pages — most users never visit them in a single session.
// Each becomes its own chunk, removing recharts/framer-motion/three from the
// main bundle when they're only used here.
const ResetPasswordPage = lazy(() => import("./components/auth/ResetPasswordPage").then(m => ({ default: m.ResetPasswordPage })));
const SetPasswordPage = lazy(() => import("./components/auth/SetPasswordPage").then(m => ({ default: m.SetPasswordPage })));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage").then(m => ({ default: m.AuthCallbackPage })));
const CompanyPage = lazy(() => import("./pages/CompanyPage").then(m => ({ default: m.CompanyPage })));
const PricingPage = lazy(() => import("./pages/PricingPage").then(m => ({ default: m.PricingPage })));
const ProductPage = lazy(() => import("./pages/ProductPage").then(m => ({ default: m.ProductPage })));
const FaqPage = lazy(() => import("./pages/FaqPage").then(m => ({ default: m.FaqPage })));
const AuditPage = lazy(() => import("./pages/AuditPage").then(m => ({ default: m.AuditPage })));
const DemoDashboardPage = lazy(() => import("./components/ui/demo-dashboard").then(m => ({ default: m.DemoDashboardPage })));
const ProspectDemoPage = lazy(() => import("./pages/ProspectDemoPage").then(m => ({ default: m.ProspectDemoPage })));
const PromptLibraryPage = lazy(() => import("./components/ui/prompt-library-page").then(m => ({ default: m.PromptLibraryPage })));
const SignupPage = lazy(() => import("./pages/SignupPage").then(m => ({ default: m.SignupPage })));
const PlanSelectionPage = lazy(() => import("./pages/PlanSelectionPage").then(m => ({ default: m.PlanSelectionPage })));
const StartPage = lazy(() => import("./pages/StartPage").then(m => ({ default: m.StartPage })));
const SuccessPage = lazy(() => import("./pages/SuccessPage").then(m => ({ default: m.SuccessPage })));
const ShopifySuccessPage = lazy(() => import("./pages/ShopifySuccessPage").then(m => ({ default: m.ShopifySuccessPage })));
const CancelPage = lazy(() => import("./pages/CancelPage").then(m => ({ default: m.CancelPage })));
const ReferralLanding = lazy(() => import("./pages/ReferralLanding").then(m => ({ default: m.ReferralLanding })));
const PartnerLandingPage = lazy(() => import("./pages/PartnerLandingPage").then(m => ({ default: m.PartnerLandingPage })));
const PartnersLandingPage = lazy(() => import("./pages/PartnersLandingPage").then(m => ({ default: m.PartnersLandingPage })));
const PartnerApplyPage = lazy(() => import("./pages/PartnerApplyPage").then(m => ({ default: m.PartnerApplyPage })));
const PartnersDirectoryPage = lazy(() => import("./pages/PartnersDirectoryPage").then(m => ({ default: m.PartnersDirectoryPage })));
const PartnerProfilePage = lazy(() => import("./pages/PartnerProfilePage").then(m => ({ default: m.PartnerProfilePage })));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage").then(m => ({ default: m.PrivacyPage })));
const SupportGuidePage = lazy(() => import("./pages/SupportGuidePage").then(m => ({ default: m.SupportGuidePage })));
const LegalPage = lazy(() => import("./pages/LegalPage").then(m => ({ default: m.LegalPage })));
const TermsPage = lazy(() => import("./pages/TermsPage").then(m => ({ default: m.TermsPage })));
const ActeroForStartupsPage = lazy(() => import("./pages/ActeroForStartupsPage").then(m => ({ default: m.ActeroForStartupsPage })));
const AlternativeGorgias = lazy(() => import("./pages/AlternativeGorgias").then(m => ({ default: m.AlternativeGorgias })));
const AlternativeTidio = lazy(() => import("./pages/AlternativeTidio").then(m => ({ default: m.AlternativeTidio })));
const AlternativeZendesk = lazy(() => import("./pages/AlternativeZendesk").then(m => ({ default: m.AlternativeZendesk })));
const PortalApp = lazy(() => import('./pages/portal/PortalApp.jsx'));
import { MotionConfig } from "framer-motion";
import { CursorGlow } from "./components/ui/cursor-glow";
import { CommandPalette } from "./components/ui/command-palette";
import { ToastProvider } from "./components/ui/Toast";
import { Toaster } from "./components/ui/Toaster";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { resetUser } from "./lib/analytics";

// React Query defaults tuned for the Actero dashboard:
//  - staleTime 60s: prevents the queryClient from refetching every query each
//    time the user switches dashboard tabs / re-focuses the window. Saves
//    ~10-20 redundant Supabase round-trips per minute.
//  - retry 1: a single retry on transient failures, no exponential storm.
//  - refetchOnWindowFocus false: same rationale as staleTime — explicit
//    refresh actions still work via queryClient.invalidateQueries().
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

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

  // Wire Sentry user context to Supabase auth state — any error captured
  // after this point is tagged with the current user id/email so we can tell
  // WHICH client hit the bug, not just "someone". Cleared on sign-out.
  useEffect(() => {
    if (!supabase || typeof window === "undefined" || !window.Sentry) return;
    const applyUser = (session) => {
      if (session?.user) {
        window.Sentry.setUser({
          id: session.user.id,
          email: session.user.email,
        });
      } else {
        window.Sentry.setUser(null);
      }
    };
    supabase.auth.getSession().then(({ data }) => applyUser(data?.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => applyUser(session));
    return () => sub?.subscription?.unsubscribe();
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
    // Clear Sentry user context too — the onAuthStateChange listener will
    // also clear it, but being explicit avoids a brief window where a
    // post-logout error is still attributed to the previous user.
    if (typeof window !== "undefined" && window.Sentry) {
      window.Sentry.setUser(null);
    }
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
      {/* Suspense fallback covers the brief moment a lazy chunk is loading.
          Empty fallback = no flash; the prerendered SEO HTML is already
          painted for crawlers and the page swap is near-instant on cache. */}
      <Suspense fallback={null}>
        {page}
      </Suspense>
    </>
  );
}

// ErrorBoundary moved to src/components/ErrorBoundary.jsx — imported above.

export default function App() {
  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MotionConfig reducedMotion="user">
          <ToastProvider>
            <ErrorBoundary>
              <MainRouter />
              <Analytics />
              <Toaster />
            </ErrorBoundary>
          </ToastProvider>
        </MotionConfig>
      </QueryClientProvider>
    </HelmetProvider>
  );
}
