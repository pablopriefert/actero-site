import { useState, useEffect } from "react";
import { CheckCircle, Loader2, ArrowRight, AlertCircle } from "lucide-react";
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
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clientData, setClientData] = useState(null);
  const [notFound, setNotFound] = useState(false);

  // Fetch client data from Supabase
  useEffect(() => {
    async function fetchClient() {
      try {
        const { data, error: fetchError } = await supabase
          .from("funnel_clients")
          .select("*")
          .eq("slug", clientSlug)
          .single();

        if (fetchError || !data) {
          setNotFound(true);
        } else {
          setClientData(data);
        }
      } catch {
        setNotFound(true);
      } finally {
        setPageLoading(false);
      }
    }
    fetchClient();
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
        body: JSON.stringify({
          client: clientSlug,
          setup_price: setupPrice,
          monthly_price: monthlyPrice,
        }),
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

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Lien introuvable</h1>
          <p className="text-gray-500">Ce lien n'est pas valide ou a expiré.</p>
        </div>
      </div>
    );
  }

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
          <p className="text-sm text-gray-500 mb-8">
            + {setupPrice}€ de frais de setup (facturés une seule fois)
          </p>

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
