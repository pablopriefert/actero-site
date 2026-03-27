import { useState, useEffect } from "react";
import { CheckCircle, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "../lib/supabase";

const benefits = [
  "Automatisation du support client",
  "Récupération des ventes perdues",
  "Workflows IA personnalisés",
  "Dashboard de suivi en temps réel",
  "Onboarding dédié sous 24h",
];

function formatClientName(slug) {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StartPage({ clientSlug }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clientData, setClientData] = useState(null);

  useEffect(() => {
    supabase
      .from('funnel_clients')
      .select('company_name, setup_price, monthly_price, client_type')
      .eq('slug', clientSlug)
      .maybeSingle()
      .then(({ data }) => { if (data) setClientData(data); });
  }, [clientSlug]);

  const clientName = clientData?.company_name || formatClientName(clientSlug);
  const setupPrice = clientData?.setup_price ?? 800;
  const monthlyPrice = clientData?.monthly_price ?? 800;

  const handleCheckout = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client: clientSlug }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Une erreur est survenue.");
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm text-gray-400 mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Offre personnalisée
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">
            Démarrer avec Actero
          </h1>
          <p className="text-lg text-gray-400">
            Cette offre a été préparée pour{" "}
            <span className="text-white font-semibold">{clientName}</span>
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-8 shadow-2xl">
          {/* Pricing */}
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-5xl font-bold text-white">{monthlyPrice}€</span>
            <span className="text-gray-500 text-lg">/mois</span>
          </div>
          {setupPrice > 0 && (
            <p className="text-sm text-gray-500 mb-8">
              + {setupPrice}€ de frais de setup (facturés une seule fois)
            </p>
          )}
          {setupPrice === 0 && <div className="mb-8" />}

          {/* Divider */}
          <div className="border-t border-white/10 my-6" />

          {/* Benefits */}
          <ul className="space-y-4 mb-8">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                <span className="text-gray-300">{benefit}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full bg-white text-black py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Redirection...
              </>
            ) : (
              <>
                Démarrer avec Actero
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>

          {error && (
            <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-8">
          Paiement sécurisé par Stripe · Annulable à tout moment
        </p>
      </div>
    </div>
  );
}
