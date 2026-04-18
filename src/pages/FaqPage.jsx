import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  HelpCircle,
  Clock,
  ShieldCheck,
  Zap,
  ArrowRight,
  Search,
} from "lucide-react";
import { Logo } from "../components/layout/Logo";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { SEO } from "../components/SEO";
import { ButtonColorful } from "../components/ui/button-colorful";
import { trackEvent } from "../lib/analytics";

export const FaqPage = ({ onNavigate }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const [openFaq, setOpenFaq] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    {
      title: "Général",
      questions: [
        {
          q: "Qu'est-ce qu'Actero exactement ?",
          a: "Actero est une plateforme SaaS française d'automatisation du service client e-commerce. Nos agents IA résolvent automatiquement les questions récurrentes (suivi de commande, retours, changements d'adresse, disponibilité produit) sur les canaux email, chat et téléphone — en moyenne 60% du volume de tickets SAV d'une boutique Shopify. Les cas complexes sont automatiquement escaladés à votre équipe humaine avec tout le contexte nécessaire.",
        },
        {
          q: "En quoi Actero est-il différent de Gorgias, Zendesk ou Tidio ?",
          a: "Trois différences majeures : (1) Actero est développé et hébergé en France, conforme RGPD sans transfert de données hors UE ; (2) l'IA est spécifiquement entraînée pour le e-commerce francophone et le catalogue Shopify (pas besoin d'ingénierie de prompt) ; (3) l'installation prend moins de 15 minutes sans configuration technique — vous connectez Shopify en OAuth et l'agent commence à répondre immédiatement. Gorgias reste un excellent helpdesk pour équipes humaines, Actero remplace le travail humain sur la part automatisable.",
        },
        {
          q: "Pour qui est fait Actero ?",
          a: "Pour les marchands Shopify francophones traitant entre 200 et 5 000 tickets support par mois, typiquement entre 30 000€ et 500 000€ de CA mensuel. Les boutiques en-dessous ont souvent un volume insuffisant pour justifier l'automatisation ; au-dessus, nous proposons un plan Enterprise avec multi-boutiques et white-label.",
        },
        {
          q: "Quels canaux de support Actero automatise-t-il ?",
          a: "Trois canaux : email (réponses automatiques aux tickets entrants), chat (widget intégré sur votre site Shopify ou via Gorgias/Zendesk/Tidio), et téléphone (agent vocal ElevenLabs avec numéro FR dédié sur le plan Pro). Tous les canaux partagent le même contexte produit et l'historique client.",
        },
      ],
    },
    {
      title: "Fonctionnement & installation",
      questions: [
        {
          q: "Combien de temps prend l'installation ?",
          a: "Moins de 15 minutes pour une configuration standard. Vous connectez Shopify en OAuth (1 clic), Actero lit automatiquement votre catalogue produits, vos politiques de retour et vos pages légales. L'agent commence à répondre à vos emails / chats / appels dans l'heure qui suit la connexion. Aucune modification de thème Shopify, aucun code à déployer.",
        },
        {
          q: "L'agent IA a-t-il accès aux commandes de mes clients ?",
          a: "Oui, via l'API Shopify Admin en lecture seule. L'agent peut consulter le numéro de suivi, le statut de livraison, l'adresse, le montant, et l'historique des commandes pour répondre aux questions WISMO (Where Is My Order) sans intervention humaine. Les actions d'écriture (refund, changement d'adresse, annulation) sont toujours soumises à validation via vos règles métier.",
        },
        {
          q: "Puis-je personnaliser le ton de mon agent IA ?",
          a: "Oui, à partir du plan Starter. L'éditeur de ton de marque vous permet de définir le niveau de formalité (tu/vous), l'utilisation d'émojis, la longueur des réponses, et des phrases signature. Actero analyse aussi automatiquement vos 50 derniers échanges support pour apprendre votre ton existant.",
        },
        {
          q: "Comment fonctionne l'escalade vers un humain ?",
          a: "L'agent escalade automatiquement vers votre équipe dans 4 cas : (1) score de confiance inférieur à 60%, (2) ton client agressif ou insatisfaction détectée, (3) demande hors périmètre (question légale, commerciale avancée), (4) règles métier personnalisées que vous définissez (ex : commandes supérieures à 500€, clients VIP). L'humain reçoit le ticket avec tout le contexte — historique, commande, tentative de réponse IA.",
        },
        {
          q: "Actero peut-il remplacer entièrement mon équipe SAV ?",
          a: "Non, et ce n'est pas notre recommandation. Actero automatise typiquement 50 à 70% des tickets (WISMO, retours simples, disponibilité produit, FAQ produit). Votre équipe humaine gère les 30 à 50% restants — cas complexes, réclamations, relations clients VIP. L'objectif : libérer votre équipe pour la valeur ajoutée, pas la remplacer.",
        },
      ],
    },
    {
      title: "Intégrations",
      questions: [
        {
          q: "Quelles intégrations sont disponibles ?",
          a: "E-commerce : Shopify (natif, OAuth), WooCommerce, Webflow. Helpdesk : Gorgias, Zendesk, Tidio, Crisp. Email : Gmail, Outlook, Resend, SMTP custom. Transport : Shippo, Sendcloud, Chronopost, Colissimo (via Shopify). Compta : Stripe, Axonaut, Pennylane, iPaidThat. Communication : Slack (notifications), Amplitude (analytics). API REST + webhooks disponibles à partir du plan Pro pour connecter vos outils custom.",
        },
        {
          q: "Puis-je garder Gorgias ou Zendesk en plus d'Actero ?",
          a: "Oui, et c'est même le setup recommandé pour les équipes ayant déjà un helpdesk. Actero se connecte à Gorgias/Zendesk en bidirectionnel : les tickets entrants passent d'abord par Actero pour tentative d'auto-résolution, puis ceux non résolus sont créés dans votre helpdesk avec le contexte complet. Vos agents humains travaillent dans leur outil habituel.",
        },
        {
          q: "Que se passe-t-il si Actero tombe en panne ?",
          a: "En cas d'indisponibilité, Actero passe en mode fallback : les tickets entrants sont automatiquement redirigés vers votre équipe humaine (ou votre helpdesk existant) sans perte. Nous nous engageons sur une disponibilité de 99.5% sur les plans Starter/Pro et 99.9% contractuellement garantie sur le plan Enterprise.",
        },
      ],
    },
    {
      title: "Sécurité & RGPD",
      questions: [
        {
          q: "Mes données clients sont-elles en sécurité ?",
          a: "Oui. Chiffrement AES-256 au repos, TLS 1.3 en transit, hébergement exclusif en Union Européenne (aucun transfert hors UE). Les connexions Shopify utilisent OAuth 2.0 avec jetons révocables à tout moment. Audits de sécurité annuels. Nous ne stockons jamais les mots de passe et l'accès admin est protégé par authentification à deux facteurs.",
        },
        {
          q: "Actero est-il conforme RGPD ?",
          a: "Oui. Nous sommes sous-traitant au sens du RGPD (Article 28). Nous fournissons un DPA (Data Processing Agreement) signable sur simple demande, tenons un registre des traitements, et permettons l'exercice des droits RGPD (accès, rectification, suppression) via une API dédiée. Les données de conversation sont automatiquement purgées après la durée de rétention que vous définissez (minimum 7 jours, maximum illimité).",
        },
        {
          q: "Actero utilise-t-il mes données pour entraîner ses modèles IA ?",
          a: "Non. Nous nous sommes explicitement opt-out du Text and Data Mining (TDM) conformément à l'Article 4 de la Directive EU 2019/790. Vos conversations clients ne sont jamais utilisées pour entraîner ou fine-tuner nos modèles, ni ceux de nos fournisseurs (OpenAI, Anthropic, ElevenLabs sont tous configurés en mode 'no training data').",
        },
        {
          q: "Actero modifie-t-il le code de mon site Shopify ?",
          a: "Non. Nous opérons exclusivement via l'API Shopify Admin en back-end. Votre thème, vos apps existantes et le code frontal de votre boutique restent intacts. Aucune latence ajoutée au temps de chargement. Si vous activez le widget chat Actero, il est chargé en async via CDN sans impact sur le LCP.",
        },
      ],
    },
    {
      title: "Tarifs & engagement",
      questions: [
        {
          q: "Y a-t-il un engagement de durée ?",
          a: "Non sur les plans Free, Starter et Pro. Vous pouvez résilier à tout moment depuis votre dashboard avec effet à la fin du cycle de facturation en cours. Le plan Enterprise peut inclure un engagement annuel négocié selon la complexité du déploiement, la multi-boutique et les intégrations custom.",
        },
        {
          q: "Comment fonctionne l'essai gratuit ?",
          a: "Le plan Free est gratuit à vie sans carte bancaire (50 tickets/mois, 1 workflow, intégration Shopify). Les plans Starter et Pro proposent 7 jours d'essai gratuit avec accès à toutes les fonctionnalités. Carte bancaire requise pour l'essai Starter/Pro mais aucun débit pendant les 7 jours — annulation en 1 clic sans justification.",
        },
        {
          q: "Que se passe-t-il si je dépasse mon quota de tickets ?",
          a: "Aucune coupure de service. Les tickets au-delà du quota sont facturés à l'usage : 0.15€/ticket sur le plan Starter, 0.08€/ticket sur le plan Pro. Vous recevez des alertes automatiques à 80% et 100% de votre quota pour anticiper l'upgrade. Sur le plan Free, le dépassement suspend uniquement l'automatisation — les tickets continuent d'arriver mais ne sont pas traités par l'IA.",
        },
        {
          q: "Comment est calculé le ROI d'Actero ?",
          a: "Nous calculons le temps économisé par ticket auto-résolu (basé sur votre temps de traitement moyen déclaré ou détecté dans Shopify), multiplié par le coût horaire que vous avez défini. Ajout : la valeur des paniers abandonnés récupérés par les relances IA et les ventes générées par l'agent support (upsell produit). Tout est visible en temps réel dans le dashboard ROI.",
        },
        {
          q: "Proposez-vous un discount annuel ?",
          a: "Oui, 20% de réduction sur la facturation annuelle. Le plan Starter passe de 99€ à 79€/mois (facturé 948€/an), le plan Pro de 399€ à 319€/mois (facturé 3 828€/an). Le plan Enterprise est négocié au cas par cas avec remises supplémentaires sur engagement pluriannuel.",
        },
      ],
    },
  ];

  const filteredCategories = searchQuery
    ? categories.map(cat => ({
        ...cat,
        questions: cat.questions.filter(q =>
          q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.a.toLowerCase().includes(searchQuery.toLowerCase())
        )
      })).filter(cat => cat.questions.length > 0)
    : categories;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": categories.flatMap(cat =>
      cat.questions.map(faq => ({
        "@type": "Question",
        "name": faq.q,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.a
        }
      }))
    )
  };

  return (
    <>
      <SEO
        title="FAQ Actero — Questions frequentes sur nos agents IA"
        description="Reponses a vos questions sur les agents IA Actero : fonctionnement, integration Shopify, tarifs, delais de deploiement, support."
        canonical="/faq"
        schemaData={faqSchema}
      />
    <div className="min-h-screen bg-white text-[#262626] font-sans selection:bg-[#003725]/10">
      <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate("/audit")} trackEvent={trackEvent} />

      <main className="pt-32 pb-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 text-[#262626]" style={{ fontFamily: "var(--font-display)" }}>
              Centre d'aide.
            </h1>
            <p className="text-xl text-[#716D5C] max-w-2xl mx-auto mb-10">
              Tout ce que vous devez savoir sur Actero et l'avenir de l'automatisation.
            </p>

            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#716D5C]" />
              <input
                type="text"
                placeholder="Rechercher une question..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F9F7F1] border border-gray-200 rounded-2xl py-4 pl-12 pr-4 text-[#262626] focus:ring-2 focus:ring-cta/30 outline-none transition-all font-medium"
              />
            </div>
          </div>

          <div className="space-y-12">
            {filteredCategories.map((category, catIdx) => (
              <div key={catIdx}>
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#716D5C] mb-6 ml-2">
                  {category.title}
                </h2>
                <div className="space-y-3">
                  {category.questions.map((faq, i) => {
                    const uniqueId = `${catIdx}-${i}`;
                    return (
                      <div
                        key={i}
                        className="bg-[#F9F7F1] border border-gray-200 rounded-2xl overflow-hidden group hover:border-gray-300 transition-colors"
                      >
                        <button
                          onClick={() => setOpenFaq(openFaq === uniqueId ? null : uniqueId)}
                          className="w-full flex items-center justify-between p-6 text-left"
                        >
                          <span className="font-bold text-lg text-[#262626]">{faq.q}</span>
                          <div className={`transition-transform duration-300 ${openFaq === uniqueId ? 'rotate-45' : ''}`}>
                            <Plus className="w-5 h-5 text-[#716D5C]" />
                          </div>
                        </button>
                        <AnimatePresence>
                          {openFaq === uniqueId && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="px-6 pb-6 overflow-hidden"
                            >
                              <p className="text-[#716D5C] leading-relaxed font-medium">
                                {faq.a}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredCategories.length === 0 && (
              <div className="text-center py-20 bg-[#F9F7F1] rounded-3xl border border-gray-200 border-dashed">
                <HelpCircle className="w-12 h-12 text-[#716D5C] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#262626]">Aucun résultat trouvé</h3>
                <p className="text-[#716D5C] mt-2">Essayez d'autres mots-clés ou contactez-nous.</p>
              </div>
            )}
          </div>

          <div className="mt-24 p-10 bg-[#F9F7F1] border border-gray-200 rounded-3xl text-center">
            <h3 className="text-2xl font-bold mb-4 text-[#262626]" style={{ fontFamily: "var(--font-display)" }}>Besoin d'une réponse immédiate ?</h3>
            <p className="text-[#716D5C] mb-8 max-w-md mx-auto">
              Notre équipe d'ingénieurs est disponible pour discuter de votre architecture spécifique.
            </p>
            <ButtonColorful onClick={() => onNavigate("/audit")}>
              Lancer un scan gratuit <ArrowRight className="ml-2 w-4 h-4" />
            </ButtonColorful>
          </div>
        </div>
      </main>

      <Footer onNavigate={onNavigate} />
    </div>
    </>
  );
};
