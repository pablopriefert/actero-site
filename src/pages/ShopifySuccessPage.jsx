import { useState, useEffect } from "react";
import { CheckCircle, Zap, Loader2, ArrowRight } from "lucide-react";
import { trackEvent } from "../lib/analytics";
import { OnboardingProgress } from "../components/dashboard/OnboardingProgress";
import { SEO } from "../components/SEO";
import { supabase } from "../lib/supabase";
import { storeShopifyClaim, consumeShopifyClaim } from "../lib/shopify-claim";

export function ShopifySuccessPage({ onNavigate }) {
  const params = new URLSearchParams(window.location.search);
  const shop = params.get("shop") || "votre boutique";
  const clientId = params.get("client_id");
  const initialJobId = params.get("onboarding_job");
  // Le jeton qui rattache la boutique au compte. Sans lui, le client créé par
  // le callback OAuth reste orphelin et le marchand n'a accès à rien.
  const claimToken = params.get("claim");
  const spawnFailed = params.get("onboarding_failed") === "1";
  const [onboardingJobId, setOnboardingJobId] = useState(initialJobId);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState(null);
  // True when the OAuth callback could not even spawn the job, OR a retry has
  // not yet produced a fresh job id.
  const [onboardingFailed, setOnboardingFailed] = useState(spawnFailed);

  // Analytics — fire once per landing on /shopify-success (= post-OAuth callback)
  useEffect(() => {
    // Analytics
    trackEvent('Shopify Connected', { shop_domain: shop, plan: 'unknown' });
    // Run once per URL param set; depend on shop so navigating away+back doesn't double-fire in SPA edge cases
  }, [shop]);

  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [error, setError] = useState(null);
  // Gate the "Activer mes automations" card until the OnboardingProgress component
  // reports completion. Without a job id (and no spawn failure), treat onboarding
  // as already done so the card still appears (legacy paths that don't pass an
  // onboarding_job query param).
  const [onboardingDone, setOnboardingDone] = useState(!initialJobId && !spawnFailed);
  // 'checking' → 'attached' (boutique rattachée) | 'needs-account' (il faut
  // d'abord créer un compte) | 'none' (install depuis un compte existant).
  const [claimState, setClaimState] = useState(claimToken ? "checking" : "none");

  // Rattacher la boutique dès qu'on peut, et sinon mémoriser le jeton pour le
  // consommer après l'inscription (voir src/lib/shopify-claim.js).
  useEffect(() => {
    if (!claimToken) return;
    let cancelled = false;
    storeShopifyClaim(claimToken);
    (async () => {
      const { status } = await consumeShopifyClaim(supabase);
      if (cancelled) return;
      setClaimState(status === "done" ? "attached" : status === "needs-account" ? "needs-account" : "needs-account");
    })();
    return () => { cancelled = true; };
  }, [claimToken]);

  const handleRetryOnboarding = async () => {
    if (!clientId) {
      setRetryError("Identifiant client manquant. Contactez support@actero.fr.");
      return;
    }
    setRetrying(true);
    setRetryError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const res = await fetch("/api/jobs/shopify-onboard", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ clientId, shopDomain: shop }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && res.status !== 409) {
        throw new Error(data.error || `Erreur ${res.status}`);
      }
      // 409 means a job is already in progress — reuse its id.
      if (data.jobId) {
        setOnboardingJobId(data.jobId);
        setOnboardingFailed(false);
      } else {
        throw new Error("Aucun identifiant de tâche renvoyé");
      }
    } catch (err) {
      setRetryError(err.message || "Échec du relancement");
    } finally {
      setRetrying(false);
    }
  };

  const handleActivate = async () => {
    if (!clientId) {
      setError("Impossible d'activer : identifiant client manquant. Contactez support@actero.fr.");
      return;
    }

    setActivating(true);
    setError(null);

    try {
      // request-deployment exige un Bearer (api/request-deployment.js:16-19).
      // Sans lui l'activation renvoyait 401 : le marchand cliquait, voyait une
      // erreur, et repartait.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error("Créez votre compte Actero pour activer vos automatisations.");
      }
      const res = await fetch("/api/request-deployment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ client_id: clientId, shop_domain: shop }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de la demande");
      }

      setActivated(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center px-4">
      <SEO
        title="Connexion Shopify réussie | Actero"
        description="Votre boutique Shopify est connectée à Actero. L'onboarding démarre."
        noindex={true}
      />
      <div className="text-center max-w-lg w-full">
        <div className="w-20 h-20 rounded-full bg-cta/10 flex items-center justify-center mx-auto mb-8">
          <CheckCircle className="w-10 h-10 text-[#003725]" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-[#1a1a1a] mb-4">
          Application installée !
        </h1>

        <p className="text-[#71717a] text-lg mb-2 leading-relaxed">
          L'app Actero est connectée à
        </p>
        <p className="text-[#003725] font-bold text-lg mb-8">
          {shop}
        </p>

        {onboardingJobId && (
          <div className="mb-6 text-left">
            <OnboardingProgress
              jobId={onboardingJobId}
              onComplete={() => setOnboardingDone(true)}
              onFailed={() => setOnboardingFailed(true)}
            />
          </div>
        )}

        {onboardingFailed ? (
          <div className="bg-white border border-red-100 rounded-2xl p-6 mb-6">
            <p className="text-sm font-semibold text-[#1a1a1a] mb-2">
              La synchronisation a échoué
            </p>
            <p className="text-xs text-[#71717a] leading-relaxed mb-4">
              Le démarrage de l'import de votre boutique n'a pas abouti. Notre
              équipe a été alertée. Vous pouvez relancer la synchronisation
              maintenant.
            </p>
            {retryError && (
              <p className="text-sm text-red-600 mb-4 bg-red-50 border border-red-100 rounded-xl p-3">
                {retryError}
              </p>
            )}
            <button
              onClick={handleRetryOnboarding}
              disabled={retrying}
              className="w-full px-6 py-3 bg-cta hover:bg-[#0d5430] text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {retrying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Relancement…
                </>
              ) : (
                "Réessayer la synchronisation"
              )}
            </button>
          </div>
        ) : !onboardingDone ? (
          <div className="bg-white border border-[#f0f0f0] rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Loader2 className="w-4 h-4 text-[#003725] animate-spin" />
              <span className="text-sm font-semibold text-[#1a1a1a]">Configuration en cours…</span>
            </div>
            <p className="text-xs text-[#71717a] leading-relaxed mb-3">
              On importe votre catalogue et on lit vos politiques pour préparer votre agent. Cela prend généralement 5 à 15 minutes — l'activation des automations apparaîtra dès que tout est prêt.
            </p>
            <p className="text-xs text-[#9ca3af] leading-relaxed">
              Vous pouvez fermer cet onglet : votre agent continue de se préparer en arrière-plan.
            </p>
          </div>
        ) : claimState === "needs-account" ? (
          /* Install depuis l'App Store : la boutique est connectée mais le
             marchand n'a pas encore de compte Actero. C'est ce CTA qui manquait
             — sans lui, les seules issues étaient une activation en 401 ou un
             écran de connexion sans identifiants. */
          <div className="bg-white border border-[#f0f0f0] rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-[#003725]" />
              <span className="text-sm font-bold text-[#1a1a1a]">Dernière étape</span>
            </div>
            <p className="text-sm text-[#71717a] leading-relaxed mb-5">
              <span className="font-semibold text-[#1a1a1a]">{shop}</span> est connectée.
              Créez votre compte Actero pour y rattacher la boutique et accéder à votre agent —
              c'est gratuit et sans carte bancaire.
            </p>
            <button
              onClick={() => onNavigate("/signup")}
              className="w-full px-6 py-4 bg-cta hover:bg-[#0d5430] text-white rounded-full text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              Créer mon compte
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate("/login")}
              className="mt-3 w-full text-sm text-[#71717a] hover:text-[#1a1a1a] transition-colors cursor-pointer"
            >
              J'ai déjà un compte Actero
            </button>
          </div>
        ) : !activated ? (
          <div className="bg-white border border-[#f0f0f0] rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-[#003725]" />
              <span className="text-sm font-bold text-[#1a1a1a]">Dernière étape</span>
            </div>
            <p className="text-sm text-[#71717a] leading-relaxed mb-5">
              Activez vos automatisations SAV en un clic. Votre agent IA commencera immédiatement à traiter les tickets et relancer les paniers abandonnés.
            </p>

            {error && (
              <p className="text-sm text-red-600 mb-4 bg-red-50 border border-red-100 rounded-xl p-3">
                {error}
              </p>
            )}

            <button
              onClick={handleActivate}
              disabled={activating}
              className="w-full px-6 py-4 bg-cta hover:bg-[#0d5430] text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {activating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Déploiement en cours...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Activer mes automations
                </>
              )}
            </button>
          </div>
        ) : (
          <div className="bg-white border border-[#A8C490]/40 rounded-2xl p-6 mb-6">
            <div className="w-14 h-14 rounded-full bg-cta/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-[#003725]" />
            </div>
            <h3 className="text-lg font-bold text-[#1a1a1a] mb-2">
              Demande envoyée !
            </h3>
            <p className="text-sm text-[#71717a] leading-relaxed mb-5">
              Notre équipe configure vos automations sur-mesure. Vous serez notifié dès qu'elles seront actives.
            </p>
            <button
              onClick={() => onNavigate("/client")}
              className="px-6 py-3 bg-cta hover:bg-[#0d5430] text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              Accéder à mon dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <button
          onClick={() => onNavigate("/")}
          className="text-sm text-[#71717a] hover:text-[#1a1a1a] transition-colors cursor-pointer"
        >
          Retour au site
        </button>
      </div>
    </div>
  );
}
