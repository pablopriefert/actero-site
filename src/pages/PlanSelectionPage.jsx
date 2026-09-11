import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Gift, Loader2, Rocket, Sparkles, ShieldCheck, CreditCard, RefreshCw } from "lucide-react";
import { Logo } from "../components/layout/Logo";
import { PLANS, PLAN_ORDER, getPlanHighlights } from "../lib/plans";
import { resolveUpgrade } from "../lib/billing-router";
import { PaymentModal } from "../components/billing/PaymentModal";
import { hasStripeElements } from "../lib/stripe-client";
import { resolveOrCreateClientId } from "../lib/resolve-client";
import { SEO } from "../components/SEO";
import { supabase } from "../lib/supabase";

/**
 * Ce que chaque plan contient — DÉRIVÉ de src/lib/plans.js, jamais écrit à la main.
 *
 * LA LISTE ÉCRITE À LA MAIN QUI VIVAIT ICI ANNONÇAIT UNE PROMESSE MORTE.
 *
 * Elle affichait « Multi-boutique » sur Enterprise. Or `multi_shop` vaut false
 * sur les quatre plans : la fonctionnalité n'a jamais été construite, et la
 * promesse avait été retirée de la page tarifs en septembre pour cette raison.
 * Elle a survécu ici — sur la page que voit un marchand juste après s'être
 * inscrit par une publicité, c'est-à-dire au pire endroit possible.
 *
 * Le registre des promesses ne l'a pas vue parce qu'il ne relit que
 * `PricingPage.jsx`. Une garde ne protège que ce qu'elle regarde.
 *
 * Dériver la liste des limites et des drapeaux réels coûte quelques lignes et
 * rend ce mensonge impossible : ce qui s'affiche est exactement ce que le
 * serveur applique.
 */

const SUPPORT = {
  docs: "Documentation",
  email_48h: "Support email 48 h",
  priority_24h: "Support prioritaire 24 h",
  account_manager: "Account manager dédié",
};

// Ordre d'affichage : le plus vendeur d'abord, parce que les listes sont
// tronquées et qu'il faut que ce soit la fin qui saute, pas le début.
const FONCTIONS = [
  ["specialized_agents", "Agents IA spécialisés"],
  ["email_agent", "Agent email natif"],
  ["portal_enabled", "Portail client en marque blanche"],
  ["pdf_report", "Rapport PDF mensuel"],
  ["white_label", "White-label du widget"],
  ["api_webhooks", "API REST & webhooks"],
  ["simulator", "Simulateur de conversation"],
  ["guardrails", "Règles & limites"],
];

// Assez large pour que Pro montre ses vrais arguments — agent email, portail
// client, rapport PDF — au lieu de les cacher derrière « + 4 autres ». Les
// cartes s'étirent à la plus haute, ce qui remplit la page au passage.
const MAX_LIGNES = 8;

const nombre = (v) => Number(v).toLocaleString("fr-FR");

/**
 * « Illimité » se dit `Infinity` dans plans.js — pas `null`.
 *
 * Piège rencontré en écrivant cette page : un relevé des limites fait via
 * `JSON.stringify` affichait `null` partout, parce que JSON ne sait pas
 * représenter l'infini. J'ai écrit des tests `=== null` sur cette base, et la
 * carte Pro a annoncé « Infinity workflows » et « Historique Infinity jours ».
 *
 * On accepte donc les quatre formes qui ont voulu dire « pas de limite » au fil
 * du temps, plutôt que de parier sur une seule.
 */
const estIllimite = (v) => v === null || v === undefined || v === Infinity || v < 0;

/** Tout ce que ce plan contient, en clair. */
function contenu(planId) {
  const plan = PLANS[planId];
  const l = plan.limits;
  const items = [];

  // Les trois chiffres qui décident, puis ce qu'on vend, puis le reste. Cet
  // ordre compte : la liste est tronquée, et ce qui saute doit être
  // l'accessoire. Pro cachait ses trois meilleurs arguments derrière un
  // « + 4 autres » parce que cinq limites passaient devant.
  items.push(estIllimite(l.tickets_per_month) ? "Tickets illimités" : `${nombre(l.tickets_per_month)} tickets/mois`);
  items.push(estIllimite(l.workflows_active) ? "Workflows illimités" : `${l.workflows_active} workflow${l.workflows_active > 1 ? "s" : ""}`);
  items.push(estIllimite(l.integrations) ? "Intégrations illimitées" : `${l.integrations} intégration${l.integrations > 1 ? "s" : ""}`);

  for (const [cle, libelle] of FONCTIONS) {
    const v = plan.features[cle];
    if (v === true || v === "full" || v === "custom") items.push(libelle);
  }

  items.push(estIllimite(l.history_days) ? "Historique illimité" : `Historique ${l.history_days} jours`);
  items.push(estIllimite(l.team_members) ? "Membres d'équipe illimités" : `${l.team_members} membre${l.team_members > 1 ? "s" : ""} d'équipe`);
  items.push(SUPPORT[plan.support] || "Support");
  return items;
}

/**
 * Ce que ce plan ajoute au précédent.
 *
 * Le calcul par différence évite de répéter quatre fois les mêmes lignes, et
 * surtout il se met à jour tout seul quand une limite bouge dans plans.js.
 */
function apports(planId, precedentId) {
  const avant = new Set(precedentId ? contenu(precedentId) : []);
  const tout = contenu(planId).filter((x) => !avant.has(x));
  return { visibles: tout.slice(0, MAX_LIGNES), reste: Math.max(0, tout.length - MAX_LIGNES) };
}

export const PlanSelectionPage = ({ onNavigate }) => {
  // URL params — multiple promo mechanics :
  //   ?referral_code=XXX  → client-to-client referral (30 days free)
  //   ?promo=ACTERO-STARTUP-XXX  → Actero for Startups (-50% pendant 6 mois)
  const urlParams = useMemo(
    () => new URLSearchParams(window.location.search),
    [],
  );
  const isReferred = !!urlParams.get("referral_code");
  // Arrivée par une publicité : le marchand vient POUR le mois offert, c'est
  // l'argument qu'on a payé pour lui montrer. La page doit le lui redire ici,
  // au moment du choix — sinon il se demande s'il l'a bien.
  // `offre=mois` est posé par AuthCallbackPage APRÈS que le serveur a accordé
  // le mois : c'est un marqueur d'affichage, pas un code. Il remplace la
  // réinjection du code dans l'URL, qui renouvelait le cookie à chaque
  // chargement et offrait le mois à tous les comptes créés ensuite.
  const isCampagne = !!(urlParams.get("campagne") || urlParams.get("campaign_code")
    || urlParams.get("offre"));
  const promoCode = urlParams.get("promo") || null;
  const isStartupPromo = !!promoCode && promoCode.toUpperCase().startsWith("ACTERO-STARTUP-");

  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [payModal, setPayModal] = useState(null);

  const moisOffert = isReferred || isCampagne;

  // Une date, pas une durée. « 30 jours » se discute, « le 10 octobre » se
  // vérifie sur un calendrier — c'est la formulation qui rassure vraiment
  // quelqu'un qui hésite à donner sa carte.
  const [dateFacturation] = useState(() => {
    const jours = moisOffert ? 30 : 7;
    return new Date(Date.now() + jours * 86400000).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
    });
  });

  // Apply Startup discount (-50% first 6 months) for display
  const applyStartupDiscount = (monthlyPrice) => {
    if (!isStartupPromo || monthlyPrice == null || monthlyPrice === 0) return null;
    return Math.round(monthlyPrice * 0.5 * 100) / 100;
  };

  const handleSelect = async (planId) => {
    if (loading) return;
    setError(null);

    if (planId === "enterprise") {
      window.location.assign("mailto:contact@actero.fr?subject=Actero Enterprise");
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

      // Resolve the client_id — auto-creates the client on first visit
      // (startup onboarding / fresh direct signup).
      let clientId;
      try {
        clientId = await resolveOrCreateClientId(supabase, session);
      } catch {
        setError("Impossible de créer votre compte. Contactez le support.");
        setLoading(null);
        return;
      }

      // Shopify-installed merchants must be billed via Shopify Billing (App
      // Store policy 1.2); direct signups fall through to Stripe below.
      const routed = await resolveUpgrade({
        token: session.access_token, clientId, targetPlan: planId, billingPeriod: "monthly",
      });
      if (routed.channel === "shopify") { window.location.assign(routed.url); return; }
      if (routed.channel === "error") { setError(routed.message); setLoading(null); return; }

      // On-site payment (Stripe Payment Element) when the publishable key is
      // set — otherwise fall through to the hosted Checkout redirect below.
      if (hasStripeElements()) {
        setPayModal({ planId, clientId, token: session.access_token });
        setLoading(null);
        return;
      }

      const res = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          target_plan: planId,
          billing_period: "monthly",
          promo_code: promoCode || undefined,
        }),
      });

      const data = await res.json();
      if (data.checkout_url) {
        window.location.assign(data.checkout_url);
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
    } catch (_err) {
      setError("Erreur réseau. Réessayez.");
      setLoading(null);
    }
  };

  const titre = isStartupPromo
    ? "Bienvenue dans Actero for Startups"
    : moisOffert
      ? "Votre premier mois est offert"
      : "Choisissez votre plan";

  const sousTitre = isStartupPromo
    ? "Votre code Startup est actif : -50 % pendant six mois, sur Starter ou Pro."
    : moisOffert
      ? "Choisissez la formule qui vous ressemble. Vous ne serez pas débité avant le " + dateFacturation + ", et vous pouvez annuler en un clic."
      : "Commencez gratuitement, ou essayez une formule payante pendant sept jours.";

  return (
    <>
      <SEO
        title="Choisir votre plan — Actero"
        description="Sélectionnez le plan Actero adapté à votre boutique."
      />
      <div className="min-h-screen bg-surface font-sans flex flex-col">
        {/* ---------- En-tête ---------- */}
        <header className="px-6 pt-8">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-surface border border-border-cream flex items-center justify-center">
                <Logo className="w-5 h-5 text-ink" />
              </div>
              <span className="text-ink text-[15px] tracking-tight">Actero</span>
            </div>
            <span className="text-ink-4 text-[12px] hidden sm:block">Dernière étape</span>
          </div>
        </header>

        {/* ---------- Titre ---------- */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="text-center px-6 pt-14 md:pt-20"
        >
          {moisOffert && !isStartupPromo && (
            <div className="inline-flex items-center gap-2 mb-6 pl-2 pr-4 py-1.5 bg-primary-tint rounded-full">
              <span className="w-6 h-6 rounded-full bg-cta flex items-center justify-center">
                <Gift className="w-3.5 h-3.5 text-white" />
              </span>
              <span className="text-[12.5px] font-semibold text-cta tracking-tight">
                {isReferred ? "Offre parrainage active" : "Offre de bienvenue active"}
              </span>
            </div>
          )}

          {isStartupPromo && (
            <div className="inline-flex flex-col items-center gap-2 mb-6">
              <div className="inline-flex items-center gap-2 pl-2 pr-4 py-1.5 bg-primary-tint rounded-full">
                <span className="w-6 h-6 rounded-full bg-cta flex items-center justify-center">
                  <Rocket className="w-3.5 h-3.5 text-white" />
                </span>
                <span className="text-[12.5px] font-semibold text-cta tracking-tight">
                  Code startup actif · -50 % pendant 6 mois
                </span>
              </div>
              <span className="text-[11px] text-ink-4 font-mono">{promoCode}</span>
            </div>
          )}

          <h1 className="text-ink text-[34px] md:text-[46px] leading-[1.08] tracking-[-0.03em] max-w-3xl mx-auto">
            {titre}
          </h1>
          <p className="text-ink-3 text-[15px] md:text-base mt-5 max-w-xl mx-auto leading-relaxed">
            {sousTitre}
          </p>
        </motion.div>

        {/* ---------- Formules ---------- */}
        <div className="max-w-6xl w-full mx-auto px-6 pt-14 md:pt-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-stretch">
            {PLAN_ORDER.map((planId, index) => {
              const plan = PLANS[planId];
              const isPopular = plan.popular;
              const precedent = index > 0 ? PLAN_ORDER[index - 1] : null;
              const { visibles, reste } = apports(planId, precedent);

              // Pricing display — with startup discount if applicable
              const discountedPrice = applyStartupDiscount(plan.price.monthly);
              const hasDiscount = discountedPrice !== null && (planId === "starter" || planId === "pro");

              let prix;
              let periode = null;
              if (plan.price.monthly === null) {
                prix = "Sur devis";
              } else if (plan.price.monthly === 0) {
                prix = "Gratuit";
              } else {
                prix = `${hasDiscount ? discountedPrice : plan.price.monthly}€`;
                periode = "/mois";
              }

              let ctaLabel;
              let ctaStyle;
              if (planId === "free") {
                ctaLabel = "Continuer gratuitement";
                ctaStyle = "bg-surface text-ink border border-border-cream hover:bg-cream";
              } else if (planId === "enterprise") {
                ctaLabel = "Contacter l’équipe";
                ctaStyle = "bg-surface text-ink border border-border-cream hover:bg-cream";
              } else if (isStartupPromo) {
                ctaLabel = "Activer mon plan -50 %";
                ctaStyle = "bg-cta text-white hover:bg-cta-hover";
              } else {
                ctaLabel = (isReferred || isCampagne) ? "30 jours gratuits" : "Essai gratuit 7 jours";
                ctaStyle = "bg-cta text-white hover:bg-cta-hover";
              }

              return (
                <motion.div
                  key={planId}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.06 * index }}
                  className={`relative flex flex-col rounded-[20px] bg-surface transition-shadow ${
                    isPopular
                      ? "border-2 border-cta shadow-[0_12px_40px_-12px_rgba(19,128,74,0.35)] lg:-mt-3 lg:mb-3"
                      : "border border-border-cream shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_28px_-14px_rgba(0,0,0,0.18)]"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute -top-[11px] left-1/2 -translate-x-1/2 bg-cta text-white text-[10px] font-bold uppercase tracking-[0.14em] px-3 py-1 rounded-full whitespace-nowrap">
                      Le plus choisi
                    </div>
                  )}

                  <div className="p-6 pb-5">
                    {/* Hauteur fixe : sans elle, le sous-titre d'Enterprise passe
                        sur deux lignes et son prix descend seul d'un cran. */}
                    <div className="min-h-[62px]">
                      <h2 className="text-ink text-[19px] tracking-tight leading-tight">{plan.name}</h2>
                      <p className="text-ink-4 text-[12.5px] mt-1 leading-snug">{plan.tagline}</p>
                    </div>

                    <div className="mt-4 min-h-[58px]">
                      {hasDiscount && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-ink-4 text-sm line-through">{plan.price.monthly}€</span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider bg-primary-tint text-cta px-1.5 py-0.5 rounded">
                            <Sparkles className="w-2.5 h-2.5" /> -50 %
                          </span>
                        </div>
                      )}
                      <div className="flex items-baseline gap-1">
                        <span className="text-ink text-[32px] tracking-[-0.03em] leading-none">{prix}</span>
                        {periode && <span className="text-ink-4 text-sm">{periode}</span>}
                      </div>
                      {hasDiscount && (
                        <div className="text-[11px] text-cta font-medium mt-1.5">
                          pendant 6 mois, puis {plan.price.monthly}€/mois
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => handleSelect(planId)}
                      disabled={loading === planId || !!loading}
                      className={`mt-5 w-full py-3 rounded-full text-[13.5px] font-semibold transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed ${ctaStyle}`}
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
                  </div>

                  <div className="border-t border-border-cream px-6 py-5 flex-1">
                    <p className="text-ink-4 text-[11px] font-semibold uppercase tracking-[0.1em] mb-3.5">
                      {precedent ? `Tout ${PLANS[precedent].name}, plus` : "Inclus"}
                    </p>
                    <ul className="space-y-2.5">
                      {visibles.map((item, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-ink-2 leading-snug">
                          <Check className="w-[15px] h-[15px] text-cta mt-[3px] flex-shrink-0" strokeWidth={2.5} />
                          <span>{item}</span>
                        </li>
                      ))}
                      {reste > 0 && (
                        <li className="text-[12.5px] text-ink-4 pl-[25px]">+ {reste} autre{reste > 1 ? "s" : ""}</li>
                      )}
                    </ul>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {error && (
            <div className="max-w-xl mx-auto mt-8 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm text-center">
              {error}
            </div>
          )}
        </div>

        {/* ---------- Réassurance ---------- */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="max-w-3xl mx-auto px-6 pt-14 md:pt-16 w-full"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 sm:gap-8 text-center">
            {[
              [CreditCard, "Aucun débit avant le " + dateFacturation],
              [RefreshCw, "Changez ou annulez en un clic"],
              [ShieldCheck, "Paiement sécurisé par Stripe"],
            ].map(([Icone, texte], i) => (
              <div key={i} className="flex sm:flex-col items-center sm:gap-2.5 gap-3">
                <Icone className="w-[18px] h-[18px] text-cta flex-shrink-0" strokeWidth={1.8} />
                <span className="text-ink-3 text-[13px] leading-snug">{texte}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ---------- Pied ---------- */}
        <footer className="mt-auto pt-16 pb-10 px-6">
          <p className="text-center text-ink-4 text-[12.5px]">
            Une question sur les formules ?{" "}
            <a href="mailto:contact@actero.fr" className="text-cta hover:underline">Écrivez-nous</a>
            {" "}— on répond dans la journée.
          </p>
        </footer>
      </div>

      <PaymentModal
        open={!!payModal}
        onClose={() => setPayModal(null)}
        plan={payModal ? PLANS[payModal.planId] : null}
        billingPeriod="monthly"
        highlights={payModal ? getPlanHighlights(payModal.planId) : []}
        clientId={payModal?.clientId}
        token={payModal?.token}
        promoCode={promoCode}
        onSuccess={() => onNavigate("/client/overview?upgrade=success")}
      />
    </>
  );
};
