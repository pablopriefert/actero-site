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
    // Uses SECURITY DEFINER RPC instead of `.from('funnel_clients').select(...)`
    // because the underlying table's RLS no longer allows anon reads (it used
    // to leak emails + Stripe IDs). The RPC returns only non-sensitive fields.
    supabase
      .rpc('get_funnel_client_public', { p_slug: clientSlug })
      .then(({ data }) => {
        const row = Array.isArray(data) ? data[0] : data
        if (row) setClientData(row)
      });
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
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-gray-200 bg-gray-50 text-sm text-[#716D5C] mb-6">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Offre personnalisée
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-[#262626] tracking-tight mb-4">
            Démarrer avec Actero
          </h1>
          <p className="text-lg text-[#716D5C]">
            Cette offre a été préparée pour{" "}
            <span className="text-[#262626] font-semibold">{clientName}</span>
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#F9F7F1] border border-gray-200 rounded-2xl p-8 shadow-2xl">
          {/* Pricing */}
          <div className="flex items-baseline gap-3 mb-2">
            <span className="text-5xl font-bold text-[#262626]">{monthlyPrice}€</span>
            <span className="text-[#716D5C] text-lg">/mois</span>
          </div>
          {setupPrice > 0 && (
            <p className="text-sm text-[#716D5C] mb-8">
              + {setupPrice}€ de frais de setup (facturés une seule fois)
            </p>
          )}
          {setupPrice === 0 && <div className="mb-8" />}

          {/* Divider */}
          <div className="border-t border-gray-200 my-6" />

          {/* Benefits */}
          <ul className="space-y-4 mb-8">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                <span className="text-[#716D5C]">{benefit}</span>
              </li>
            ))}
          </ul>

          {/* CTA */}
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="w-full bg-white text-[#262626] py-4 rounded-xl font-bold text-lg hover:bg-gray-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
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
        <p className="text-center text-xs text-[#716D5C] mt-8">
          Paiement sécurisé par Stripe · Annulable à tout moment
        </p>
      </div>
    </div>
  );
}
