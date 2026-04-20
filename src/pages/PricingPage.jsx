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
  free: "border-black/[0.08] bg-white text-[#1A1A1A]",
  starter: "border-black/[0.08] bg-white text-[#1A1A1A]",
  pro: "border-cta bg-[#003725] text-white shadow-[0_20px_50px_-15px_rgba(0,55,37,0.35)] scale-[1.02]",
  enterprise: "border-black/[0.08] bg-white text-[#1A1A1A]",
};

function buildFeatures(plan) {
  const { limits, features, support } = plan;

  // ── FREE ──────────────────────────────────────────────────────────
  if (plan.id === "free") {
    return [
      "50 tickets / mois",
      "1 workflow actif",
      "Intégration Shopify",
      `Base de connaissances (${limits.knowledge_entries} entrées)`,
      "Règles métier & guardrails",
      "Dashboard ROI basique",
      "Historique 7 jours",
      "Support documentation",
      "Sans carte bancaire · À vie",
    ];
  }

  // ── ENTERPRISE ────────────────────────────────────────────────────
  if (plan.id === "enterprise") {
    return [
      "Tickets illimités",
      "Workflows illimités",
      "Toutes les intégrations",
      "Base de connaissances illimitée",
      "Multi-boutiques (plusieurs Shopify)",
      "White-label complet (suppression branding Actero)",
      "Agent vocal — minutes illimitées",
      "Voix custom agent vocal (clonage marque)",
      "Agents IA spécialisés",
      "Portail SAV avec custom domain + branding",
      "Agent Email natif Actero",
      "Rapport ROI sur mesure",
      "API avancée + intégrations custom",
      "Membres d'équipe illimités",
      "SLA 99,9% contractuel",
      "Account manager dédié",
      "Formation équipe incluse",
      "Onboarding white-glove",
    ];
  }

  // ── STARTER ───────────────────────────────────────────────────────
  if (plan.id === "starter") {
    return [
      `${fmt(limits.tickets_per_month)} tickets / mois`,
      `${limits.workflows_active} workflows actifs`,
      `Shopify + ${limits.integrations - 1} intégrations`,
      `Base de connaissances ${limits.knowledge_entries} entrées`,
      `${limits.team_members} membres d'équipe`,
      "Éditeur ton de marque",
      "Règles métier & guardrails",
      "Simulateur de conversation",
      "API REST + Webhooks",
      "Portail SAV self-service",
      "Dashboard ROI complet",
      "Historique 90 jours",
      "Support email 48h",
      "Essai 7 jours sans engagement",
    ];
  }

  // ── PRO ───────────────────────────────────────────────────────────
  if (plan.id === "pro") {
    return [
      `${fmt(limits.tickets_per_month)} tickets / mois`,
      "Workflows illimités",
      "Toutes les intégrations",
      "Base de connaissances illimitée",
      `${limits.team_members} membres d'équipe`,
      `Agent vocal ElevenLabs (${limits.voice_minutes} min/mois)`,
      "Numéro FR dédié pour l'agent vocal",
      "Agents IA spécialisés (WISMO, retour, produit, proactif)",
      "Agent Email natif Actero",
      "Éditeur ton de marque",
      "Simulateur de conversation",
      "API REST + Webhooks",
      "Portail SAV avec custom domain",
      "Branding portail personnalisé",
      "Rapport PDF mensuel auto-envoyé",
      "Dashboard ROI complet",
      "Historique illimité",
      "Support prioritaire 24h",
      "Essai 7 jours sans engagement",
    ];
  }

  // Fallback dynamic (safety)
  const lines = [];
  lines.push(`${fmt(limits.tickets_per_month)} tickets / mois`);
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
        title="Tarifs Actero — Agent IA pour Shopify à partir de 99€/mois"
        description="Des prix simples et transparents. Plan gratuit à 0€, Starter 99€/mois (1 000 tickets), Pro 399€/mois (5 000 tickets + agent vocal). Essai 7 jours sans carte bancaire."
        canonical="/tarifs"
        schemaData={{
          "@context": "https://schema.org",
          "@type": "Product",
          "name": "Actero — Agent IA pour service client Shopify",
          "description": "Plateforme SaaS française d'automatisation du support client e-commerce. Agents IA spécialisés pour Shopify (SAV, WISMO, retours, paniers abandonnés).",
          "brand": { "@type": "Brand", "name": "Actero" },
          "image": "https://actero.fr/og-image.png",
          "offers": {
            "@type": "AggregateOffer",
            "priceCurrency": "EUR",
            "lowPrice": "0",
            "highPrice": "399",
            "offerCount": "4",
            "offers": [
              {
                "@type": "Offer",
                "name": "Free",
                "price": "0",
                "priceCurrency": "EUR",
                "description": "50 tickets/mois, 1 workflow, intégration Shopify, sans carte bancaire",
                "url": "https://actero.fr/tarifs",
                "availability": "https://schema.org/InStock"
              },
              {
                "@type": "Offer",
                "name": "Starter",
                "price": "99",
                "priceCurrency": "EUR",
                "description": "1 000 tickets/mois, 3 workflows, 3 intégrations, éditeur ton de marque",
                "url": "https://actero.fr/tarifs",
                "availability": "https://schema.org/InStock",
                "priceSpecification": {
                  "@type": "UnitPriceSpecification",
                  "price": "99",
                  "priceCurrency": "EUR",
                  "billingIncrement": "1",
                  "unitCode": "MON"
                }
              },
              {
                "@type": "Offer",
                "name": "Pro",
                "price": "399",
                "priceCurrency": "EUR",
                "description": "5 000 tickets/mois, workflows illimités, toutes intégrations, agent vocal, API & webhooks",
                "url": "https://actero.fr/tarifs",
                "availability": "https://schema.org/InStock",
                "priceSpecification": {
                  "@type": "UnitPriceSpecification",
                  "price": "399",
                  "priceCurrency": "EUR",
                  "billingIncrement": "1",
                  "unitCode": "MON"
                }
              },
              {
                "@type": "Offer",
                "name": "Enterprise",
                "description": "Tickets illimités, multi-boutiques, white-label, SLA 99.9%, account manager dédié — sur devis",
                "url": "mailto:contact@actero.fr",
                "availability": "https://schema.org/InStock"
              }
            ]
          }
        }}
      />

      <div className="min-h-screen bg-white text-[#262626] font-sans selection:bg-[#003725]/10">
        <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate("/signup")} trackEvent={trackEvent} />

        <main className="pt-32 pb-24 px-6">
          <div className="max-w-7xl mx-auto">

            {/* ── Hero (variation A style) ── */}
            <div className="text-center mb-16">
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[11px] font-bold uppercase tracking-[0.2em] mb-3.5 text-cta"
              >
                Tarifs
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="font-normal leading-[1.05] text-[#1A1A1A] mb-6"
                style={{ fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)', fontSize: 'clamp(38px, 5.2vw, 64px)', letterSpacing: '-0.02em' }}
              >
                Un prix qui paie 40h<br className="hidden md:block" />
                <span className="italic text-[#716D5C]">de votre équipe.</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-[17px] text-[#5A5A5A] max-w-xl mx-auto mb-4 leading-[1.5]"
              >
                Le plan Starter à 99€ remplace environ 20 heures hebdo de support humain.
                Démarrez gratuitement, scalez quand vos tickets grimpent.
              </motion.p>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="inline-flex items-center gap-4 text-sm text-[#716D5C] font-medium mb-10"
              >
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-cta" /> Sans engagement</span>
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-cta" /> Annulable en 1 clic</span>
                <span className="flex items-center gap-1.5"><Check className="w-4 h-4 text-cta" /> Garantie 30 jours satisfait ou remboursé</span>
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
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <div className="flex items-center gap-1.5 bg-[#A8C490] text-[#003725] text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1 rounded-full">
                        <Sparkles className="w-2.5 h-2.5" />
                        Populaire
                      </div>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className={`text-xl font-bold mb-1 ${plan.highlighted ? 'text-white' : 'text-[#1A1A1A]'}`}>{plan.name}</h3>
                    <p className={`text-sm font-medium ${plan.highlighted ? 'text-[#F4F0E6]/60' : 'text-[#716D5C]'}`}>{plan.tagline}</p>
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                      {isAnnual && plan.monthlyPrice > 0 && (
                        <span className={`line-through text-2xl font-bold ${plan.highlighted ? 'text-[#F4F0E6]/35' : 'text-[#9ca3af]'}`}>
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
                          className={`text-4xl font-bold ${plan.highlighted ? 'text-white' : 'text-[#1A1A1A]'}`}
                        >
                          {getPrice(plan)}
                        </motion.span>
                      </AnimatePresence>
                      <span className={`text-sm font-medium ${plan.highlighted ? 'text-[#F4F0E6]/60' : 'text-[#716D5C]'}`}>
                        {getPeriod(plan)}
                      </span>
                    </div>
                    {getSubPrice(plan) && (
                      <p className={`text-xs mt-1 ${plan.highlighted ? 'text-[#F4F0E6]/60' : 'text-[#716D5C]'}`}>{getSubPrice(plan)}</p>
                    )}
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => handleCTA(plan)}
                    className={`w-full py-3.5 rounded-full font-bold text-sm transition-all flex items-center justify-center gap-2 mb-8 ${
                      plan.highlighted
                        ? "bg-[#A8C490] text-[#003725] hover:bg-white"
                        : "bg-[#F9F7F1] border border-gray-200 text-[#262626] hover:bg-gray-100"
                    }`}
                  >
                    {plan.cta} <ChevronRight className="w-4 h-4" />
                  </button>

                  {/* Divider */}
                  <div className={`border-t mb-6 ${plan.highlighted ? 'border-[#F4F0E6]/15' : 'border-gray-100'}`} />

                  {/* Features */}
                  <div className="space-y-3 flex-1">
                    {plan.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2.5">
                        <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlighted ? 'text-[#A8C490]' : 'text-cta'}`} />
                        <span className={`text-sm font-medium ${plan.highlighted ? 'text-[#F4F0E6]/90' : 'text-[#716D5C]'}`}>{feature}</span>
                      </div>
                    ))}
                  </div>

                  {/* Overage */}
                  {plan.overage && (
                    <p className={`mt-6 text-xs pt-4 border-t ${plan.highlighted ? 'text-[#F4F0E6]/60 border-[#F4F0E6]/15' : 'text-[#716D5C] border-gray-100'}`}>
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
                className="text-center font-normal text-[#1A1A1A] mb-12 leading-[1.05]"
                style={{ fontFamily: 'var(--font-display, "Instrument Serif", Georgia, serif)', fontSize: 'clamp(32px, 4.5vw, 48px)', letterSpacing: '-0.02em' }}
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
