import { useState, useEffect } from "react";
import { CheckCircle, Zap, Loader2, ArrowRight } from "lucide-react";
import { trackEvent } from "../lib/analytics";
import { OnboardingProgress } from "../components/dashboard/OnboardingProgress";

export function ShopifySuccessPage({ onNavigate }) {
  const params = new URLSearchParams(window.location.search);
  const shop = params.get("shop") || "votre boutique";
  const clientId = params.get("client_id");
  const onboardingJobId = params.get("onboarding_job");

  // Analytics — fire once per landing on /shopify-success (= post-OAuth callback)
  useEffect(() => {
    // Analytics
    trackEvent('Shopify Connected', { shop_domain: shop, plan: 'unknown' });
    // Run once per URL param set; depend on shop so navigating away+back doesn't double-fire in SPA edge cases
  }, [shop]);

  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [error, setError] = useState(null);

  const handleActivate = async () => {
    if (!clientId) {
      setError("Impossible d'activer : identifiant client manquant. Contactez support@actero.fr.");
      return;
    }

    setActivating(true);
    setError(null);

    try {
      const res = await fetch("/api/request-deployment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
    <div className="min-h-screen bg-[#030303] flex items-center justify-center px-4">
      <div className="text-center max-w-lg w-full">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-8">
          <CheckCircle className="w-10 h-10 text-emerald-500" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Application installée !
        </h1>

        <p className="text-gray-400 text-lg mb-2 leading-relaxed">
          L'app Actero est connectée à
        </p>
        <p className="text-emerald-400 font-bold text-lg mb-8">
          {shop}
        </p>

        {onboardingJobId && (
          <div className="mb-6 text-left">
            <OnboardingProgress jobId={onboardingJobId} />
          </div>
        )}

        {!activated ? (
          <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Zap className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-bold text-white">Dernière étape</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">
              Activez vos automatisations SAV en un clic. Votre agent IA commencera immédiatement à traiter les tickets et relancer les paniers abandonnés.
            </p>

            {error && (
              <p className="text-sm text-red-400 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                {error}
              </p>
            )}

            <button
              onClick={handleActivate}
              disabled={activating}
              className="w-full px-6 py-4 bg-white hover:bg-gray-200 text-black rounded-xl text-sm font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          <div className="bg-[#0a0a0a] border border-emerald-500/20 rounded-2xl p-6 mb-6">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-7 h-7 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Demande envoyée !
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">
              Notre équipe configure vos automations sur-mesure. Vous serez notifié dès qu'elles seront actives.
            </p>
            <button
              onClick={() => onNavigate("/login")}
              className="px-6 py-3 bg-white hover:bg-gray-200 text-black rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 mx-auto"
            >
              Accéder à mon dashboard
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <button
          onClick={() => onNavigate("/")}
          className="text-sm text-gray-500 hover:text-gray-300 transition-colors cursor-pointer"
        >
          Retour au site
        </button>
      </div>
    </div>
  );
}
