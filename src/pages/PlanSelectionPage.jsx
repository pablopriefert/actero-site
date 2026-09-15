import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Check, Gift, Loader2, Rocket, Sparkles, ShieldCheck, CreditCard, RefreshCw } from "lucide-react";
import { Logo } from "../components/layout/Logo";
import { PLANS, PLAN_ORDER } from "../lib/plans";
import { resolveUpgrade } from "../lib/billing-router";
import { SelecteurFormule } from "../components/billing/SelecteurFormule";
import { affichagePrix, lireFormuleChoisie } from "../lib/affichage-formules";
import { PERIODE_API } from "../../api/lib/formules.js";
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
  // CE QUE LA PAGE A LE DROIT DE PROMETTRE
  //
  // Elle annonçait « 30 jours gratuits » dès qu'un paramètre `campagne` ou
  // `referral_code` existait dans l'URL — n'importe quelle valeur. Donc
  // `?campagne=NIMPORTEQUOI` promettait un mois, et le serveur en accordait
  // sept. Le cas n'est pas qu'une URL bricolée : un vieux code d'une publicité
  // arrêtée, retiré de CAMPAIGN_TRIAL_CODES, produit exactement la même
  // promesse non tenue — et c'est la première chose que le marchand vérifie.
  //
  // Deux sources de vérité, aucune n'est l'URL brute :
  //
  //   `offre=mois`  posé par NOUS (AuthCallbackPage, verify-code.js) APRÈS que
  //                 le serveur a accordé le mois. Il ne porte aucun code et ne
  //                 sort jamais de notre propre redirection.
  //   les drapeaux  `campaign_first_month_free` / `referral_first_month_free`
  //                 sur la ligne `clients`, écrits côté serveur. C'est ce que
  //                 `joursEssaiPour()` lira au moment de facturer.
  //
  // Le marqueur sert d'affichage immédiat, les drapeaux confirment. Un
  // marchand venu par la pub voit donc son mois tout de suite, et personne ne
  // se voit promettre ce qu'il n'aura pas.
  const marqueurServeur = urlParams.get("offre") === "mois";
  const [droitAuMois, setDroitAuMois] = useState(marqueurServeur);
  const [parParrainage, setParParrainage] = useState(false);
  // La formule choisie sur /tarifs (ou dans le lien d'un closer) suit le
  // visiteur jusqu'ici. Avant, la page codait « monthly » en dur : choisir
  // l'annuel sur /tarifs menait à un paiement mensuel.
  const [periode, setPeriode] = useState(() => lireFormuleChoisie(urlParams).periode);
  // Une boutique Shopify s'abonne chez Shopify (App Store 1.2.1), qui ne
  // connaît pas le trimestriel : on ne le lui propose pas.
  const [boutiqueShopify, setBoutiqueShopify] = useState(false);

  useEffect(() => {
    let vivant = true;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.id) return;
        const { data: connexion } = await supabase
          .from("client_shopify_connections")
          .select("shop_domain")
          .limit(1)
          .maybeSingle();
        if (vivant && connexion?.shop_domain) setBoutiqueShopify(true);
        // Pas de filtre `where` : la RLS ne renvoie déjà que les lignes que
        // cet utilisateur a le droit de voir — la sienne (clients_select) ou
        // celles de ses équipes (clients_select_member). À ce moment du
        // parcours il n'en a qu'une.
        const { data } = await supabase
          .from("clients")
          .select("campaign_first_month_free, referral_first_month_free")
          .limit(1)
          .maybeSingle();
        if (!vivant || !data) return;
        if (data.referral_first_month_free) setParParrainage(true);
        if (data.campaign_first_month_free || data.referral_first_month_free) setDroitAuMois(true);
      } catch {
        // Le marqueur d'URL reste la source d'affichage : une lecture ratée ne
        // doit pas retirer au marchand un mois que le serveur lui a accordé.
      }
    })();
    return () => { vivant = false; };
  }, []);

  const isReferred = parParrainage;
  const promoCode = urlParams.get("promo") || null;
  const isStartupPromo = !!promoCode && promoCode.toUpperCase().startsWith("ACTERO-STARTUP-");

  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);

  const moisOffert = droitAuMois;
  // Shopify et le code Startup (−50 % pendant 6 mois, au mois) restent au mensuel.
  const periodeEffective = boutiqueShopify || isStartupPromo ? "mensuel" : periode;

  // Une date, pas une durée. « 30 jours » se discute, « le 10 octobre » se
  // vérifie sur un calendrier — c'est la formulation qui rassure vraiment
  // quelqu'un qui hésite à donner sa carte.
  // `Date.now()` est impur en rendu (react-hooks/purity) : on le fige au
  // montage, et le calcul reste réactif au verdict du serveur.
  const [maintenant] = useState(() => Date.now());
  const dateFacturation = useMemo(() => {
    // Recalculée quand le verdict serveur arrive : figée au premier rendu, elle
    // annonçait une date à sept jours à un marchand qui en avait trente.
    const jours = moisOffert ? 30 : 7;
    return new Date(maintenant + jours * 86400000).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
    });
  }, [moisOffert, maintenant]);

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
        token: session.access_token, clientId, targetPlan: planId, billingPeriod: PERIODE_API[periodeEffective],
      });
      if (routed.channel === "shopify") { window.location.assign(routed.url); return; }
      if (routed.channel === "error") { setError(routed.message); setLoading(null); return; }

      const res = await fetch("/api/billing/upgrade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          client_id: clientId,
          target_plan: planId,
          billing_period: PERIODE_API[periodeEffective],
          promo_code: promoCode || undefined,
        }),
      });

      const data = await res.json();
      // Contrat de api/billing/upgrade.js (Task 5 bis) : chaque 200 porte un
      // `statut`, chaque erreur un code (`error`) et une phrase (`message`).
      if (data.statut === "checkout") {
        window.location.assign(data.checkout_url);
      } else if (data.statut === "paiement_a_valider" || (data.error === "paiement_refuse" && data.facture_url)) {
        // La différence se valide, ou se règle avec une autre carte, sur la
        // facture Stripe : le plan s'applique une fois payée.
        window.location.assign(data.facture_url);
      } else if (data.statut === "change_applique" || data.statut === "paiement_en_cours") {
        // Le webhook accorde le plan une fois Stripe confirmé.
        onNavigate("/client/overview");
      } else {
        // Jamais le code brut (`abonnement_en_cours`…) : la phrase prévue pour le marchand.
        setError(data.message || "Paiement indisponible. Contactez le support.");
        setLoading(null);
      }
    } catch (_err) {
      setError("Erreur réseau. Réessayez.");
      setLoading(null);
    }
  };

  const titre = isStartupPromo
    ? "Bienvenue dans Actero for Startups"
    : moisOffert && periodeEffective === "mensuel"
      ? "Votre premier mois est offert"
      : "Choisissez votre plan";

  const sousTitre = isStartupPromo
    ? "Votre code Startup est actif : -50 % pendant six mois, sur Starter ou Pro."
    : periodeEffective === "trimestriel"
      ? "Au trimestre, le premier mois est à -50 %. Le premier trimestre se paie à l’inscription."
      : periodeEffective === "annuel"
        ? "À l’année, 12 mois pour le prix de 11, à -10 %."
        : moisOffert
          ? "Choisissez la formule qui vous ressemble. Vous ne serez pas débité avant le " + dateFacturation + ", et vous pouvez annuler en un clic."
          : "Commencez avec le plan Free, ou choisissez la formule qui vous convient. Sans engagement.";

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

        {!boutiqueShopify && !isStartupPromo && (
          <div className="flex justify-center px-6 pt-10">
            <SelecteurFormule periode={periode} onChange={setPeriode} />
          </div>
        )}

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
              let suffixe = null;
              let detail = null;
              if (plan.price.monthly === null) {
                prix = "Sur devis";
              } else if (plan.price.monthly === 0) {
                prix = "Gratuit";
              } else if (hasDiscount) {
                prix = `${discountedPrice}€`;
                suffixe = "/mois";
              } else {
                const affichage = affichagePrix(planId, periodeEffective);
                prix = affichage.principal;
                suffixe = affichage.suffixe;
                detail = affichage.detail;
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
                ctaLabel = periodeEffective === "trimestriel"
                  ? "Payer le premier trimestre"
                  : periodeEffective === "annuel"
                    ? "Payer l’année"
                    : (moisOffert ? "30 jours gratuits" : "Choisir ce plan");
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
                        {suffixe && <span className="text-ink-4 text-sm">{suffixe}</span>}
                      </div>
                      {detail && (
                        <div className="text-[11px] text-ink-4 mt-1.5">{detail}</div>
                      )}
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
              [CreditCard, periodeEffective === "trimestriel"
                ? "Premier trimestre payé à l’inscription"
                : periodeEffective === "annuel"
                  ? "Année payée d’avance : 12 mois pour le prix de 11"
                  : moisOffert ? "Aucun débit avant le " + dateFacturation : "Payé à l’inscription, sans engagement"],
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
    </>
  );
};
