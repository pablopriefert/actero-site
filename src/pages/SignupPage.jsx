import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, ArrowRight, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { SEO } from "../components/SEO";

const PLANS = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Decouvrir Actero sans engagement.",
    features: [
      "50 tickets traites / mois",
      "1 workflow actif (SAV ou panier)",
      "Integration Shopify native",
      "Dashboard ROI basique",
      "Historique 7 jours",
      "1 utilisateur",
      "Base de connaissances (10 entrees)",
      "Support documentation",
    ],
    cta: "Creer mon compte gratuit",
    highlighted: false,
    trial: false,
  },
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: 99,
    annualPrice: 79,
    description: "Automatiser les premieres taches.",
    features: [
      "1 000 tickets traites / mois",
      "3 workflows actifs",
      "Shopify + 2 integrations",
      "5 agents IA specialises (Order, Return, Product...)",
      "Editeur ton de marque (sliders)",
      "Garde-fous & regles metier",
      "Dashboard ROI complet",
      "Historique 3 mois",
      "Base de connaissances (100 entrees)",
      "2 membres d'equipe",
      "Support email 48h",
    ],
    cta: "Essai gratuit 7 jours",
    highlighted: false,
    trial: true,
    overage: "0,10 EUR/ticket supplementaire",
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 399,
    annualPrice: 319,
    description: "Automatisation complete + agent vocal.",
    features: [
      "5 000 tickets traites / mois",
      "Workflows illimites",
      "Toutes les integrations disponibles",
      "Agent vocal telephone (200 min incluses)",
      "Agent WhatsApp Business",
      "Simulateur de conversation",
      "Regles metier avancees (conditionnel)",
      "Seuils d'escalade configurables",
      "Historique illimite",
      "Base de connaissances illimitee",
      "5 membres d'equipe",
      "API + webhooks configurables",
      "Support prioritaire 24h",
    ],
    cta: "Essai gratuit 7 jours",
    highlighted: true,
    badge: "Recommande",
    trial: true,
    overage: "0,10 EUR/ticket supplementaire",
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: null,
    annualPrice: null,
    description: "Sur mesure pour les grands comptes.",
    features: [
      "Tickets illimites",
      "Workflows illimites",
      "Multi-boutiques (jusqu'a 10 stores)",
      "Agent vocal avance (voix custom)",
      "White-label disponible",
      "API avancee + integrations custom",
      "SLA 99,9% garanti",
      "Membres illimites",
      "Account manager dedie",
      "Onboarding white-glove",
      "Rapport sur mesure",
      "Formation equipe incluse",
    ],
    cta: "Contacter l'equipe",
    highlighted: false,
    trial: false,
  },
];

export const SignupPage = ({ onNavigate }) => {
  const [selectedPlan, setSelectedPlan] = useState("starter");
  const [isAnnual, setIsAnnual] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [brandName, setBrandName] = useState("");
  const [shopifyUrl, setShopifyUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get("plan");
    if (planParam && ["free", "starter", "pro", "enterprise"].includes(planParam)) {
      setSelectedPlan(planParam);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (selectedPlan === "enterprise") {
      window.open("https://calendly.com/actero/demo", "_blank");
      return;
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Veuillez entrer un email valide.");
      return;
    }
    if (!password || password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (!brandName.trim()) {
      setError("Le nom de la boutique est requis.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          brand_name: brandName.trim(),
          shopify_url: shopifyUrl.trim() || undefined,
          plan: selectedPlan,
          billing: isAnnual ? "annual" : "monthly",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Une erreur est survenue.");
        setLoading(false);
        return;
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      if (data.message) {
        setSuccessMessage(data.message);
      }

      if (data.redirect) {
        setTimeout(() => {
          onNavigate(data.redirect);
        }, data.message ? 2000 : 0);
      }
    } catch {
      setError("Erreur réseau. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  const activePlan = PLANS.find((p) => p.id === selectedPlan);

  const getCta = () => {
    if (selectedPlan === "free") return "Créer mon compte gratuit";
    if (selectedPlan === "enterprise") return "Demander une démo";
    return "Commencer mon essai gratuit de 7 jours";
  };

  return (
    <>
      <SEO
        title="Inscription — Actero"
        description="Créez votre compte Actero et automatisez votre e-commerce avec l'IA."
      />
      <div className="min-h-screen bg-[#fafafa]">
        <Navbar onNavigate={onNavigate} />

        <main className="pt-32 pb-24 px-4">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <h1 className="text-3xl md:text-4xl font-bold text-[#1a1a1a] mb-3">
                Créez votre compte Actero
              </h1>
              <p className="text-[#71717a] text-lg max-w-xl mx-auto">
                Automatisez votre e-commerce avec l'IA. Commencez gratuitement ou essayez un plan payant pendant 7 jours.
              </p>
            </motion.div>

            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-3 mb-10">
              <span className={`text-sm font-medium ${!isAnnual ? "text-[#1a1a1a]" : "text-[#71717a]"}`}>
                Mensuel
              </span>
              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  isAnnual ? "bg-[#0F5F35]" : "bg-[#d4d4d8]"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    isAnnual ? "translate-x-6" : ""
                  }`}
                />
              </button>
              <span className={`text-sm font-medium ${isAnnual ? "text-[#1a1a1a]" : "text-[#71717a]"}`}>
                Annuel
              </span>
              {isAnnual && (
                <span className="text-xs font-semibold text-[#0F5F35] bg-[#0F5F35]/10 px-2 py-0.5 rounded-full">
                  -20%
                </span>
              )}
            </div>

            {/* Plan cards — each with CTA button */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
              {PLANS.map((plan, idx) => {
                const isSelected = selectedPlan === plan.id;
                const price = isAnnual ? plan.annualPrice : plan.monthlyPrice;

                const handleCardCta = (e) => {
                  e.stopPropagation();
                  setSelectedPlan(plan.id);
                  if (plan.id === "enterprise") {
                    window.open("https://calendly.com/actero/demo", "_blank");
                  } else {
                    // Scroll to form
                    document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                };

                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    onClick={() => setSelectedPlan(plan.id)}
                    className={`relative text-left rounded-2xl border-2 transition-all flex flex-col cursor-pointer ${
                      isSelected
                        ? "border-[#0F5F35] shadow-lg bg-white"
                        : plan.highlighted
                        ? "border-[#0F5F35]/30 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                        : "border-[#f0f0f0] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                    } hover:shadow-md`}
                  >
                    {plan.badge && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#0F5F35] text-white text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1 z-10">
                        <Sparkles className="w-3 h-3" />
                        {plan.badge}
                      </span>
                    )}

                    <div className="p-6 flex-1 flex flex-col">
                      <h3 className="text-xl font-bold text-[#1a1a1a] mb-1">{plan.name}</h3>
                      <p className="text-[#71717a] text-[13px] mb-4">{plan.description}</p>

                      <div className="mb-5">
                        {price !== null ? (
                          <>
                            <div className="flex items-baseline gap-1">
                              <span className="text-4xl font-bold text-[#1a1a1a]">{price}€</span>
                              <span className="text-[#71717a] text-sm">/mois</span>
                            </div>
                            {isAnnual && plan.monthlyPrice > 0 && (
                              <p className="text-[11px] text-[#9ca3af] mt-0.5">
                                soit {price * 12}€/an au lieu de {plan.monthlyPrice * 12}€
                              </p>
                            )}
                          </>
                        ) : (
                          <span className="text-3xl font-bold text-[#1a1a1a]">Sur devis</span>
                        )}
                        {plan.trial && (
                          <p className="text-[12px] text-[#0F5F35] font-semibold mt-1.5">7 jours d'essai gratuit</p>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="border-t border-[#f0f0f0] mb-4" />

                      <p className="text-[11px] font-bold text-[#9ca3af] uppercase tracking-wider mb-3">Ce qui est inclus :</p>

                      <ul className="space-y-2.5 flex-1">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-[13px] text-[#1a1a1a] leading-snug">
                            <Check className="w-4 h-4 text-[#0F5F35] mt-0.5 shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>

                      {plan.overage && (
                        <p className="text-[11px] text-[#9ca3af] mt-3 pt-3 border-t border-[#f0f0f0]">
                          Depassement : {plan.overage}
                        </p>
                      )}
                    </div>

                    {/* CTA button at bottom of card */}
                    <div className="px-6 pb-6">
                      <button
                        onClick={handleCardCta}
                        className={`w-full py-3 rounded-full text-[13px] font-semibold transition-colors flex items-center justify-center gap-2 ${
                          plan.highlighted || isSelected
                            ? "bg-[#0F5F35] text-white hover:bg-[#003725]"
                            : plan.id === "enterprise"
                            ? "bg-white text-[#1a1a1a] border border-[#f0f0f0] hover:bg-[#fafafa]"
                            : "bg-[#0F5F35]/10 text-[#0F5F35] hover:bg-[#0F5F35]/20"
                        }`}
                      >
                        {plan.cta}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>

                    {isSelected && (
                      <div className="absolute top-4 right-4 w-5 h-5 bg-[#0F5F35] rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Signup form */}
            <motion.div
              id="signup-form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="max-w-lg mx-auto"
            >
              <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-8">
                <h2 className="text-xl font-bold text-[#1a1a1a] mb-1">
                  {selectedPlan === "enterprise"
                    ? "Demander une démo"
                    : `Inscription — ${activePlan?.name}`}
                </h2>
                {activePlan?.trial && (
                  <p className="text-sm text-[#71717a] mb-6">
                    <ShieldCheck className="w-4 h-4 inline mr-1 text-[#0F5F35]" />
                    7 jours gratuits, sans engagement. Carte bancaire requise.
                  </p>
                )}
                {!activePlan?.trial && selectedPlan !== "enterprise" && (
                  <p className="text-sm text-[#71717a] mb-6">Aucune carte bancaire requise.</p>
                )}
                {selectedPlan === "enterprise" && (
                  <p className="text-sm text-[#71717a] mb-6">
                    Notre équipe vous recontacte sous 24h.
                  </p>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
                    {error}
                  </div>
                )}

                {successMessage && (
                  <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-4 py-3 mb-5">
                    {successMessage}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">Email</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@votreboutique.com"
                      className="w-full px-4 py-2.5 border border-[#e4e4e7] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20 focus:border-[#0F5F35] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">
                      Mot de passe
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 8 caractères"
                      className="w-full px-4 py-2.5 border border-[#e4e4e7] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20 focus:border-[#0F5F35] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">
                      Nom de la boutique
                    </label>
                    <input
                      type="text"
                      required
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      placeholder="Ma Boutique"
                      className="w-full px-4 py-2.5 border border-[#e4e4e7] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20 focus:border-[#0F5F35] transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1a1a1a] mb-1.5">
                      URL Shopify{" "}
                      <span className="text-[#71717a] font-normal">(optionnel)</span>
                    </label>
                    <input
                      type="text"
                      value={shopifyUrl}
                      onChange={(e) => setShopifyUrl(e.target.value)}
                      placeholder="ma-boutique.myshopify.com"
                      className="w-full px-4 py-2.5 border border-[#e4e4e7] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#0F5F35]/20 focus:border-[#0F5F35] transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 bg-[#0F5F35] hover:bg-[#0a4a2a] text-white font-semibold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        {getCta()}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>

                <p className="text-xs text-[#71717a] text-center mt-5">
                  En créant un compte, vous acceptez nos{" "}
                  <button
                    onClick={() => onNavigate("/utilisation")}
                    className="underline underline-offset-2 hover:text-[#1a1a1a]"
                  >
                    conditions d'utilisation
                  </button>{" "}
                  et notre{" "}
                  <button
                    onClick={() => onNavigate("/confidentialite")}
                    className="underline underline-offset-2 hover:text-[#1a1a1a]"
                  >
                    politique de confidentialité
                  </button>
                  .
                </p>

                <div className="text-center mt-4">
                  <p className="text-sm text-[#71717a]">
                    Déjà un compte ?{" "}
                    <button
                      onClick={() => onNavigate("/login")}
                      className="text-[#0F5F35] font-semibold hover:underline"
                    >
                      Se connecter
                    </button>
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </main>

        <Footer onNavigate={onNavigate} />
      </div>
    </>
  );
};
