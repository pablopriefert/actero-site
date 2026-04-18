import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Minus,
  Plus,
  ChevronRight,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { SEO } from "../components/SEO";
import { trackEvent } from "../lib/analytics";
import { PLANS, PLAN_ORDER } from "../lib/plans";

/* ──────────────────────────────────────────────
   HELPERS — derive display data from PLANS
   ────────────────────────────────────────────── */

const fmt = (v) => (v === Infinity ? "Illimité" : v.toLocaleString("fr-FR"));

const SUPPORT_LABELS = {
  docs: "\u2014",
  email_48h: "Support email 48h",
  priority_24h: "Support prioritaire 24h",
  account_manager: "Account manager dédié",
};

const ROI_LABELS = {
  basic: "Dashboard ROI basique",
  full: "Dashboard ROI complet",
  custom: "Rapport sur mesure",
};

const HISTORY_LABELS = {
  7: "\u2014",
  90: "Historique 3 mois",
  Infinity: "Historique illimité",
};

const CTA_LINKS = {
  free: "/signup",
  starter: "/signup",
  pro: "/signup",
  enterprise: "mailto:contact@actero.fr",
};

const CARD_CLASSES = {
  free: "border-[#f0f0f0] bg-white",
  starter: "border-[#f0f0f0] bg-white",
  pro: "border-cta bg-white ring-2 ring-cta/20 shadow-lg",
  enterprise: "border-[#f0f0f0] bg-[#fafafa]",
};

function buildFeatures(plan) {
  const { limits, features, support } = plan;

  if (plan.id === "free") {
    return [
      "50 tickets / mois",
      "1 workflow actif",
      "Intégration Shopify",
      "Dashboard ROI basique",
      "Pas de carte bancaire",
    ];
  }

  if (plan.id === "enterprise") {
    return [
      "Tickets illimités",
      "Workflows illimités",
      `Multi-boutiques (${limits.team_members === Infinity ? "illimité" : limits.team_members} stores)`,
      ...(features.voice_agent ? ["Agent vocal avancé (voix custom)"] : []),
      ...(features.white_label ? ["White-label disponible"] : []),
      "API avancée + intégrations custom",
      "SLA 99,9% garanti",
      "Membres illimités",
      ROI_LABELS[features.roi_dashboard] || "Rapport sur mesure",
      SUPPORT_LABELS[support] || support,
      "Formation équipe incluse",
    ];
  }

  // Starter & Pro — build dynamically
  const lines = [];

  lines.push(`${fmt(limits.tickets_per_month)} tickets / mois`);
  lines.push(
    limits.workflows_active === Infinity
      ? "Workflows illimités"
      : `${limits.workflows_active} workflows actifs`
  );

  if (limits.integrations === Infinity) {
    lines.push("Toutes les intégrations");
  } else if (limits.integrations > 1) {
    lines.push(`Shopify + ${limits.integrations - 1} intégrations`);
  } else {
    lines.push("Intégration Shopify");
  }

  if (features.brand_editor) lines.push("Éditeur ton de marque");
  if (features.guardrails) lines.push("Règles & limites");
  if (features.specialized_agents) lines.push("Agents IA spécialisés");
  if (features.voice_agent && limits.voice_minutes > 0) {
    lines.push(`Agent vocal (${limits.voice_minutes} min incluses)`);
  }
  if (features.simulator) lines.push("Simulateur de conversation");
  if (features.api_webhooks) lines.push("API + webhooks");

  if (features.roi_dashboard) {
    lines.push(ROI_LABELS[features.roi_dashboard] || "Dashboard ROI");
  }

  const histLabel = HISTORY_LABELS[limits.history_days];
  if (histLabel && histLabel !== "\u2014") lines.push(histLabel);

  lines.push(
    limits.team_members === Infinity
      ? "Membres illimités"
      : `${limits.team_members} membres d'équipe`
  );

  lines.push(SUPPORT_LABELS[support] || support);

  return lines;
}

function buildOverage(plan) {
  if (plan.overage_per_ticket == null) return null;
  return `${plan.overage_per_ticket.toFixed(2).replace(".", ",")}\u20AC / ticket`;
}

/* Build the plans array from PLANS + PLAN_ORDER */
const plans = PLAN_ORDER.map((id) => {
  const p = PLANS[id];
  return {
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    monthlyPrice: p.price.monthly,
    annualPrice: p.price.annual,
    trial: !!p.trial,
    cta: p.cta,
    ctaLink: CTA_LINKS[p.id],
    highlighted: p.popular,
    cardClass: CARD_CLASSES[p.id],
    features: buildFeatures(p),
    overage: buildOverage(p),
  };
});

/* ──────────────────────────────────────────────
   COMPARISON TABLE — derived from PLANS where possible
   ────────────────────────────────────────────── */

function compVal(planIds, fn) {
  return planIds.map((id) => fn(PLANS[id]));
}

const comparisonCategories = [
  {
    name: "Volume & Workflows",
    rows: [
      {
        label: "Tickets / mois",
        values: compVal(PLAN_ORDER, (p) => fmt(p.limits.tickets_per_month)),
      },
      {
        label: "Workflows actifs",
        values: compVal(PLAN_ORDER, (p) => fmt(p.limits.workflows_active)),
      },
      {
        label: "Membres d'equipe",
        values: compVal(PLAN_ORDER, (p) => fmt(p.limits.team_members)),
      },
      {
        label: "Historique",
        values: compVal(PLAN_ORDER, (p) =>
          p.limits.history_days === 7
            ? "\u2014"
            : p.limits.history_days === 90
              ? "3 mois"
              : "Illimité"
        ),
      },
    ],
  },
  {
    name: "Intégrations",
    rows: [
      {
        label: "Shopify",
        values: compVal(PLAN_ORDER, (p) => p.limits.integrations >= 1),
      },
      {
        label: "Gorgias / Zendesk",
        values: compVal(PLAN_ORDER, (p) => p.limits.integrations > 1),
      },
      {
        label: "Slack / Resend",
        values: compVal(PLAN_ORDER, (p) => p.limits.integrations > 1),
      },
      {
        label: "API + Webhooks",
        values: compVal(PLAN_ORDER, (p) => p.features.api_webhooks),
      },
      {
        label: "Intégrations custom",
        values: compVal(PLAN_ORDER, (p) =>
          p.id === "enterprise"
        ),
      },
    ],
  },
  {
    name: "Agents IA",
    rows: [
      {
        label: "Agent email / chat",
        values: [true, true, true, true],
      },
      {
        label: "Agents spécialisés",
        values: compVal(PLAN_ORDER, (p) => p.features.specialized_agents),
      },
      {
        label: "Agent vocal",
        values: compVal(PLAN_ORDER, (p) => {
          if (!p.features.voice_agent) return false;
          if (p.limits.voice_minutes === Infinity) return "Custom";
          if (p.limits.voice_minutes > 0) return `${p.limits.voice_minutes} min`;
          return false;
        }),
      },
      {
        label: "Simulateur conversation",
        values: compVal(PLAN_ORDER, (p) => p.features.simulator),
      },
    ],
  },
  {
    name: "Personnalisation",
    rows: [
      {
        label: "Éditeur ton de marque",
        values: compVal(PLAN_ORDER, (p) => p.features.brand_editor),
      },
      {
        label: "Règles & limites",
        values: compVal(PLAN_ORDER, (p) => p.features.guardrails),
      },
      {
        label: "Règles métier avancées",
        values: compVal(PLAN_ORDER, (p) =>
          p.id === "pro" || p.id === "enterprise"
        ),
      },
      {
        label: "White-label",
        values: compVal(PLAN_ORDER, (p) => p.features.white_label),
      },
      {
        label: "Multi-boutiques",
        values: compVal(PLAN_ORDER, (p) => {
          if (!p.features.multi_shop) return false;
          return "10 stores";
        }),
      },
    ],
  },
  {
    name: "Support & Reporting",
    rows: [
      {
        label: "Dashboard ROI",
        values: compVal(PLAN_ORDER, (p) => {
          const v = p.features.roi_dashboard;
          if (v === "basic") return "Basique";
          if (v === "full") return "Complet";
          if (v === "custom") return "Sur mesure";
          return false;
        }),
      },
      {
        label: "Support",
        values: compVal(PLAN_ORDER, (p) => {
          const s = p.support;
          if (s === "docs") return "\u2014";
          if (s === "email_48h") return "Email 48h";
          if (s === "priority_24h") return "Prioritaire 24h";
          if (s === "account_manager") return "Account manager";
          return s;
        }),
      },
      {
        label: "SLA garanti",
        values: compVal(PLAN_ORDER, (p) =>
          p.id === "enterprise" ? "99,9%" : false
        ),
      },
      {
        label: "Formation équipe",
        values: compVal(PLAN_ORDER, (p) => p.id === "enterprise"),
      },
    ],
  },
];

/* ──────────────────────────────────────────────
   FAQ — static (not derivable from plans.js)
   ────────────────────────────────────────────── */

const faqs = [
  {
    q: "Puis-je changer de plan à tout moment ?",
    a: "Oui, vous pouvez upgrader ou downgrader à tout moment depuis votre dashboard. Le changement prend effet immédiatement et le prorata est calculé automatiquement sur votre prochain cycle de facturation.",
  },
  {
    q: "Que se passe-t-il si je dépasse mon quota de tickets ?",
    a: `Au-delà de votre quota mensuel, chaque ticket supplémentaire est facturé à l'usage : ${PLANS.starter.overage_per_ticket.toFixed(2).replace(".", ",")}\u20AC/ticket sur le plan Starter, ${PLANS.pro.overage_per_ticket.toFixed(2).replace(".", ",")}\u20AC/ticket sur le plan Pro. Vous recevez une alerte à 80% et 100% de votre quota pour anticiper. Aucune coupure de service.`,
  },
  {
    q: "L'essai gratuit est-il sans engagement ?",
    a: "Oui, l'essai de 7 jours est 100% gratuit et sans engagement. Aucune carte bancaire requise pour le plan Free. Pour Starter et Pro, vous pouvez annuler à tout moment pendant l'essai sans être débité.",
  },
  {
    q: "Comment fonctionne l'agent vocal ?",
    a: `L'agent vocal utilise ElevenLabs pour une voix naturelle en français. Vous obtenez un numéro FR dédié. Le plan Pro inclut ${PLANS.pro.limits.voice_minutes} minutes/mois. Au-delà, les minutes supplémentaires sont facturées à l'usage. Le plan Enterprise permet une voix custom à votre marque.`,
  },
  {
    q: "Quelles intégrations sont disponibles ?",
    a: "Actero se connecte nativement à Shopify, WooCommerce, Webflow, Gorgias, Zendesk, Stripe, Slack, Resend, Axonaut, Pennylane, iPaidThat et bien d'autres. Le plan Pro ajoute l'accès API et webhooks. Le plan Enterprise permet des intégrations custom sur mesure.",
  },
  {
    q: "Proposez-vous un discount annuel ?",
    a: `Oui, la facturation annuelle vous fait économiser 20% par rapport au tarif mensuel. Par exemple, le plan Pro passe de ${PLANS.pro.price.monthly}\u20AC/mois à ${PLANS.pro.price.annual}\u20AC/mois (facturé annuellement).`,
  },
];

/* ──────────────────────────────────────────────
   COMPONENTS
   ────────────────────────────────────────────── */

const CellValue = ({ value }) => {
  if (value === true) return <Check className="w-5 h-5 text-cta mx-auto" />;
  if (value === false) return <Minus className="w-4 h-4 text-gray-300 mx-auto" />;
  return <span className="text-sm font-medium text-[#262626]">{value}</span>;
};

const ComparisonTable = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-24 max-w-6xl mx-auto">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-center gap-2 text-lg font-bold text-[#262626] mb-8 hover:text-cta transition-colors"
      >
        Comparatif détaillé
        <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="overflow-x-auto rounded-2xl border border-gray-200">
              <table className="w-full min-w-[700px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left p-4 text-sm font-bold text-[#262626] w-[220px] sticky left-0 bg-white z-10" />
                    {plans.map((plan) => (
                      <th
                        key={plan.id}
                        className={`p-4 text-center text-sm font-bold text-[#262626] ${
                          plan.highlighted ? "bg-cta/5" : ""
                        }`}
                      >
                        {plan.name}
                        {plan.highlighted && (
                          <span className="ml-2 text-[10px] bg-cta text-white px-2 py-0.5 rounded-full font-bold uppercase">
                            Populaire
                          </span>
                        )}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonCategories.map((cat) => (
                    <React.Fragment key={cat.name}>
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 pt-6 pb-2 text-xs font-bold text-[#716D5C] uppercase tracking-wider"
                        >
                          {cat.name}
                        </td>
                      </tr>
                      {cat.rows.map((row, idx) => (
                        <tr
                          key={row.label}
                          className={idx % 2 === 0 ? "bg-white" : "bg-[#fafafa]"}
                        >
                          <td className="p-4 text-sm font-medium text-[#262626] sticky left-0 bg-inherit z-10">
                            {row.label}
                          </td>
                          {row.values.map((val, i) => (
                            <td
                              key={i}
                              className={`p-4 text-center ${
                                plans[i].highlighted ? "bg-cta/5" : ""
                              }`}
                            >
                              <CellValue value={val} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ──────────────────────────────────────────────
   PAGE
   ────────────────────────────────────────────── */

export const PricingPage = ({ onNavigate }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [isAnnual, setIsAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState(null);

  const getPrice = (plan) => {
    if (plan.monthlyPrice === null) return "Sur devis";
    if (plan.monthlyPrice === 0) return "0\u20AC";
    return isAnnual ? `${plan.annualPrice}\u20AC` : `${plan.monthlyPrice}\u20AC`;
  };

  const getPeriod = (plan) => {
    if (plan.monthlyPrice === null) return "";
    if (plan.monthlyPrice === 0) return "";
    return "/mois";
  };

  const getSubPrice = (plan) => {
    if (plan.monthlyPrice === null || plan.monthlyPrice === 0) return null;
    if (isAnnual) return `soit ${plan.annualPrice * 12}\u20AC facturé annuellement`;
    return `ou ${plan.annualPrice}\u20AC/mois en annuel`;
  };

  const handleCTA = (plan) => {
    trackEvent("Pricing_CTA_Clicked", { plan: plan.id, billing: isAnnual ? "annual" : "monthly" });
    if (plan.ctaLink.startsWith("mailto:")) {
      window.location.href = plan.ctaLink;
    } else {
      onNavigate(plan.ctaLink);
    }
  };

  return (
    <>
      <SEO
        title="Tarifs Actero — Plans SaaS pour automatiser votre support e-commerce"
        description="Des prix simples et transparents. Commencez gratuitement, upgradez quand vous grandissez. Essai gratuit 7 jours."
        canonical="/pricing"
      />

      <div className="min-h-screen bg-white text-[#262626] font-sans selection:bg-[#003725]/10">
        <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate("/signup")} trackEvent={trackEvent} />

        <main className="pt-32 pb-24 px-6">
          <div className="max-w-7xl mx-auto">

            {/* ── Hero compact ── */}
            <div className="text-center mb-16">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-4xl md:text-6xl font-bold tracking-tight mb-6"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Des prix simples, <span className="text-cta">transparents.</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-xl text-[#716D5C] max-w-2xl mx-auto mb-10"
              >
                Commencez gratuitement, upgradez quand vous grandissez.
              </motion.p>

              {/* ── Toggle Mensuel / Annuel ── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-3 bg-[#F9F7F1] border border-gray-200 rounded-full px-2 py-1.5"
              >
                <button
                  onClick={() => setIsAnnual(false)}
                  className={`px-5 py-2 rounded-full text-sm font-bold transition-all ${
                    !isAnnual
                      ? "bg-white text-[#262626] shadow-sm"
                      : "text-[#716D5C] hover:text-[#262626]"
                  }`}
                >
                  Mensuel
                </button>
                <button
                  onClick={() => setIsAnnual(true)}
                  className={`px-5 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${
                    isAnnual
                      ? "bg-white text-[#262626] shadow-sm"
                      : "text-[#716D5C] hover:text-[#262626]"
                  }`}
                >
                  Annuel
                  <span className="text-[10px] font-bold bg-cta text-white px-2 py-0.5 rounded-full">
                    -20%
                  </span>
                </button>
              </motion.div>
            </div>

            {/* ── 4 Plan Cards ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {plans.map((plan, i) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * i + 0.3 }}
                  className={`relative flex flex-col p-8 rounded-3xl border transition-all duration-300 hover:scale-[1.02] ${plan.cardClass}`}
                >
                  {plan.highlighted && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                      <div className="flex items-center gap-1.5 bg-cta text-white text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-cta/25">
                        <Sparkles className="w-3 h-3" />
                        Populaire
                      </div>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-xl font-bold text-[#262626] mb-1">{plan.name}</h3>
                    <p className="text-sm text-[#716D5C] font-medium">{plan.tagline}</p>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                      {isAnnual && plan.monthlyPrice > 0 && (
                        <span className="line-through text-[#9ca3af] text-2xl font-bold">
                          {plan.monthlyPrice}€
                        </span>
                      )}
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={`${plan.id}-${isAnnual}`}
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          transition={{ duration: 0.2 }}
                          className="text-4xl font-bold text-[#262626]"
                        >
                          {getPrice(plan)}
                        </motion.span>
                      </AnimatePresence>
                      <span className="text-[#716D5C] text-sm font-medium">
                        {getPeriod(plan)}
                      </span>
                    </div>
                    {getSubPrice(plan) && (
                      <p className="text-xs text-[#716D5C] mt-1">{getSubPrice(plan)}</p>
                    )}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => handleCTA(plan)}
                    className={`w-full py-3.5 rounded-full font-bold text-sm transition-all flex items-center justify-center gap-2 mb-8 ${
                      plan.highlighted
                        ? "bg-cta text-white hover:bg-[#003725]"
                        : "bg-[#F9F7F1] border border-gray-200 text-[#262626] hover:bg-gray-100"
                    }`}
                  >
                    {plan.cta} <ChevronRight className="w-4 h-4" />
                  </button>

                  {/* Divider */}
                  <div className="border-t border-gray-100 mb-6" />

                  {/* Features */}
                  <div className="space-y-3 flex-1">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <Check className="w-4 h-4 text-cta shrink-0 mt-0.5" />
                        <span className="text-sm text-[#716D5C] font-medium">{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Overage */}
                  {plan.overage && (
                    <p className="mt-6 text-xs text-[#716D5C] pt-4 border-t border-gray-100">
                      Overage : {plan.overage}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>

            {/* ── Comparison Table ── */}
            <ComparisonTable />

            {/* ── FAQ ── */}
            <div className="mt-24 max-w-3xl mx-auto">
              <h2
                className="text-3xl font-bold text-center text-[#262626] mb-12"
                style={{ fontFamily: "var(--font-display)" }}
              >
                Questions fréquentes
              </h2>
              <div className="space-y-3">
                {faqs.map((faq, i) => (
                  <div
                    key={i}
                    className="bg-[#F9F7F1] border border-gray-200 rounded-2xl overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}
                      className="w-full flex items-center justify-between p-6 text-left"
                    >
                      <span className="font-bold text-[#262626]">{faq.q}</span>
                      <Plus
                        className={`w-5 h-5 text-[#716D5C] transition-transform duration-300 shrink-0 ml-4 ${
                          openFaq === i ? "rotate-45" : ""
                        }`}
                      />
                    </button>
                    <AnimatePresence>
                      {openFaq === i && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="px-6 pb-6 overflow-hidden"
                        >
                          <p className="text-[#716D5C] text-sm leading-relaxed">{faq.a}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            </div>

            {/* ── CTA Bottom ── */}
            <div className="mt-24 text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="bg-[#003725] rounded-3xl p-12 md:p-16"
              >
                <h2
                  className="text-3xl md:text-4xl font-bold text-white mb-4"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Prêt à automatiser votre support ?
                </h2>
                <p className="text-white/70 text-lg mb-8 max-w-xl mx-auto">
                  Rejoignez les marques qui économisent des dizaines d'heures par semaine grâce à Actero.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <button
                    onClick={() => {
                      trackEvent("Pricing_Bottom_CTA_Clicked");
                      onNavigate("/signup");
                    }}
                    className="inline-flex items-center justify-center h-12 px-8 rounded-full bg-white text-[#003725] font-bold text-[15px] hover:bg-[#F9F7F1] transition-colors gap-2"
                  >
                    Essai gratuit 7 jours <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      trackEvent("Pricing_Bottom_Secondary_CTA_Clicked");
                      window.location.href = "mailto:contact@actero.fr";
                    }}
                    className="inline-flex items-center justify-center h-12 px-8 rounded-full border border-white/30 text-white font-bold text-[15px] hover:bg-white/10 transition-colors gap-2"
                  >
                    Contacter l'équipe
                  </button>
                </div>
              </motion.div>
            </div>

          </div>
        </main>

        <Footer onNavigate={onNavigate} />
      </div>
    </>
  );
};
