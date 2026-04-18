import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Gift, Loader2, Rocket, Sparkles } from "lucide-react";
import { Logo } from "../components/layout/Logo";
import { PLANS, PLAN_ORDER } from "../lib/plans";
import { SEO } from "../components/SEO";
import { supabase } from "../lib/supabase";

const PLAN_HIGHLIGHTS = {
  free: ["50 tickets/mois", "1 workflow", "1 intégration"],
  starter: ["1 000 tickets/mois", "3 workflows", "Éditeur de ton de marque"],
  pro: ["5 000 tickets/mois", "Workflows illimités", "Agent vocal 200 min"],
  enterprise: ["Volume illimité", "Multi-boutique", "Account manager dédié"],
};

export const PlanSelectionPage = ({ onNavigate }) => {
  // URL params — multiple promo mechanics :
  //   ?referral_code=XXX  → client-to-client referral (30 days free)
  //   ?promo=ACTERO-STARTUP-XXX  → Actero for Startups (-50% pendant 6 mois)
  const urlParams = useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const isReferred = !!urlParams.get("referral_code");
  const promoCode = urlParams.get("promo") || null;
  const isStartupPromo = !!promoCode && promoCode.toUpperCase().startsWith("ACTERO-STARTUP-");

  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  // Apply Startup discount (-50% first 6 months) for display
  const applyStartupDiscount = (monthlyPrice) => {
    if (!isStartupPromo || monthlyPrice == null || monthlyPrice === 0) return null;
    return Math.round(monthlyPrice * 0.5 * 100) / 100;
  };

  const handleSelect = async (planId) => {
    if (loading) return;
    setError(null);

    if (planId === "enterprise") {
      window.location.href = "mailto:contact@actero.fr?subject=Actero Enterprise";
      return;
    }

    if (planId === "free") {
      // Free plan → go straight to dashboard
      onNavigate("/client/overview");
      return;
    }

    // Starter / Pro → Stripe Checkout
    setLoading(planId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Session expirée. Reconnectez-vous.");
        setLoading(null);
        return;
      }

      // Get client id for this user — or auto-create if first visit (startup flow)
      let { data: link } = await supabase
        .from("client_users")
        .select("client_id")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!link?.client_id) {
        // Also check legacy owner_user_id
        const { data: ownedClient } = await supabase
          .from("clients")
          .select("id")
          .eq("owner_user_id", session.user.id)
          .maybeSingle();

        if (ownedClient?.id) {
          link = { client_id: ownedClient.id };
        } else {
          // Auto-create client + link for new users (startup onboarding)
          const userName = session.user.user_metadata?.full_name
            || session.user.user_metadata?.name
            || session.user.email?.split("@")[0]
            || "Ma boutique";
          const { data: newClient, error: createErr } = await supabase
            .from("clients")
            .insert({
              brand_name: userName,
              contact_email: session.user.email,
              owner_user_id: session.user.id,
              plan: "free",
            })
            .select("id")
            .single();

          if (createErr || !newClient) {
            setError("Impossible de créer votre compte. Contactez le support.");
            setLoading(null);
            return;
          }

          // Create client_users link
          await supabase.from("client_users").insert({
            client_id: newClient.id,
            user_id: session.user.id,
            role: "owner",
            email: session.user.email,
          });

          // Create default client_settings row
          await supabase.from("client_settings").insert({
            client_id: newClient.id,
          });

          link = { client_id: newClient.id };
        }
      }

      const res = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          client_id: link.client_id,
          target_plan: planId,
          billing_period: "monthly",
          promo_code: promoCode || undefined,
        }),
      });

      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      } else if (data.error === "Stripe not configured") {
        setError("Paiement indisponible. Contactez le support.");
        setLoading(null);
      } else if (data.error) {
        setError(data.error);
        setLoading(null);
      } else {
        // Fallback: redirect to dashboard
        onNavigate("/client/overview");
      }
    } catch (err) {
      setError("Erreur réseau. Réessayez.");
      setLoading(null);
    }
  };

  return (
    <>
      <SEO
        title="Choisir votre plan — Actero"
        description="Sélectionnez le plan Actero adapté à votre boutique."
      />
      <div className="min-h-screen bg-[#F9F7F1] font-sans">
        {/* Logo */}
        <div className="flex justify-center pt-10 pb-4">
          <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center shadow-sm">
            <Logo className="w-7 h-7 text-[#262626]" />
          </div>
        </div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center px-4 mb-10"
        >
          <h1 className="text-[#262626] text-2xl md:text-3xl font-bold tracking-tight">
            {isStartupPromo
              ? "Bienvenue dans Actero for Startups"
              : "Choisissez votre plan"}
          </h1>
          <p className="text-[#716D5C] text-sm mt-2 max-w-md mx-auto">
            {isStartupPromo
              ? "Votre code Startup est actif — -50% pendant 6 mois, sur Starter ou Pro."
              : isReferred
                ? "Grâce à votre parrain, bénéficiez de 30 jours gratuits sur n'importe quel plan payant."
                : "Commencez gratuitement ou démarrez un essai de 7 jours sur nos plans payants."}
          </p>
          {isStartupPromo && (
            <div className="inline-flex flex-col items-center gap-2 mt-5">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cta to-[#003725] rounded-full shadow-sm">
                <Rocket className="w-4 h-4 text-white" />
                <span className="text-xs font-bold text-white tracking-wide uppercase">Code startup actif · -50% / 6 mois</span>
              </div>
              <span className="text-[11px] text-[#9ca3af] font-mono">{promoCode}</span>
            </div>
          )}
          {isReferred && !isStartupPromo && (
            <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full">
              <Gift className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700">Votre premier mois est offert</span>
            </div>
          )}
        </motion.div>

        {/* Plan cards */}
        <div className="max-w-5xl mx-auto px-4 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {PLAN_ORDER.map((planId, index) => {
              const plan = PLANS[planId];
              const isPopular = plan.popular;
              const highlights = PLAN_HIGHLIGHTS[planId] || [];

              // Pricing display — with startup discount if applicable
              const discountedPrice = applyStartupDiscount(plan.price.monthly);
              const hasDiscount = discountedPrice !== null && (planId === "starter" || planId === "pro");

              let priceLabel;
              if (plan.price.monthly === null) {
                priceLabel = "Sur devis";
              } else if (plan.price.monthly === 0) {
                priceLabel = "Gratuit";
              } else if (hasDiscount) {
                priceLabel = `${discountedPrice}\u20AC/mois`;
              } else {
                priceLabel = `${plan.price.monthly}\u20AC/mois`;
              }

              let ctaLabel;
              let ctaStyle;
              if (planId === "free") {
                ctaLabel = "Continuer gratuitement";
                ctaStyle = "bg-[#F9F7F1] text-[#262626] border border-gray-200 hover:bg-gray-100";
              } else if (planId === "enterprise") {
                ctaLabel = "Contacter l\u2019\u00E9quipe";
                ctaStyle = "bg-[#F9F7F1] text-[#262626] border border-gray-200 hover:bg-gray-100";
              } else if (isStartupPromo) {
                ctaLabel = "Activer mon plan -50%";
                ctaStyle = "bg-cta text-white hover:bg-[#003725]";
              } else {
                ctaLabel = isReferred ? "30 jours gratuits" : "Essai gratuit 7 jours";
                ctaStyle = isPopular
                  ? "bg-cta text-white hover:bg-[#003725]"
                  : "bg-cta text-white hover:bg-[#003725]";
              }

              return (
                <motion.div
                  key={planId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 * index }}
                  className={`relative bg-white rounded-2xl p-6 shadow-sm border ${
                    isPopular ? "border-cta ring-2 ring-cta/20" : "border-gray-200"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cta text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                      Populaire
                    </div>
                  )}

                  <div className="mb-4">
                    <h3 className="text-[#262626] text-lg font-bold">{plan.name}</h3>
                    <p className="text-[#716D5C] text-xs mt-0.5">{plan.tagline}</p>
                  </div>

                  <div className="mb-5">
                    {hasDiscount && (
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-gray-400 text-base line-through">{plan.price.monthly}€/mois</span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-cta/10 text-cta px-1.5 py-0.5 rounded">
                          <Sparkles className="w-2.5 h-2.5" /> -50%
                        </span>
                      </div>
                    )}
                    <span className="text-[#262626] text-2xl font-bold">{priceLabel}</span>
                    {hasDiscount && (
                      <div className="text-[11px] text-cta font-semibold mt-1">pendant 6 mois, puis {plan.price.monthly}€/mois</div>
                    )}
                  </div>

                  <ul className="space-y-2.5 mb-6">
                    {highlights.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#262626]">
                        <Check className="w-4 h-4 text-cta mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelect(planId)}
                    disabled={loading === planId || !!loading}
                    className={`w-full py-3 rounded-full text-sm font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${ctaStyle}`}
                  >
                    {loading === planId ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Redirection…
                      </>
                    ) : (
                      ctaLabel
                    )}
                  </button>
                </motion.div>
              );
            })}
          </div>

          {error && (
            <div className="max-w-xl mx-auto mt-6 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm text-center">
              {error}
            </div>
          )}
        </div>
      </div>
    </>
  );
};
