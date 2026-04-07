import React, { useState, useEffect } from "react";
import {
  Search, BookOpen, Zap, ShoppingBag, Plug, Shield, BarChart3,
  ArrowRight, ArrowLeft, Mail, ChevronDown, ChevronUp,
  Building2, Headphones, RefreshCw, FileText, UserCheck,
  CheckCircle2, Clock, AlertTriangle, Sparkles, Settings,
} from "lucide-react";
import { Navbar } from "../components/layout/Navbar";
import { Footer } from "../components/layout/Footer";
import { SEO } from "../components/SEO";
import { motion, AnimatePresence } from "framer-motion";

// ═══════════════════════════════════════
// GUIDE ARTICLES — Full content pages
// ═══════════════════════════════════════
const GUIDES = [
  {
    id: 'comment-fonctionne-actero',
    category: 'getting-started',
    title: 'Comment fonctionne Actero',
    summary: 'Comprendre le fonctionnement global de la plateforme et de vos agents IA.',
    icon: Zap,
    readTime: '5 min',
    sections: [
      {
        title: 'Actero en bref',
        content: "Actero est une plateforme d'automatisation IA dediee aux e-commercants Shopify et aux agences immobilieres. Notre approche est 100% done-for-you : vous n'avez aucune configuration technique a faire. Notre equipe audite votre activite, deploie des agents IA sur mesure, et les optimise en continu.",
      },
      {
        title: 'Comment ca marche concretement',
        content: "Etape 1 : Vous reservez un audit gratuit de 15 minutes. Nous analysons vos processus actuels (support client, paniers abandonnes, gestion des leads).\n\nEtape 2 : Nous deploions vos agents IA en 7 jours. Chaque agent est configure avec vos donnees, votre ton de marque et vos regles metier.\n\nEtape 3 : Les agents travaillent 24h/24. Vous suivez les resultats en temps reel dans votre dashboard : tickets resolus, paniers recuperes, temps economise, ROI genere.",
      },
      {
        title: 'Les agents IA disponibles',
        content: "Pour le e-commerce Shopify :\n\n- Agent SAV : repond automatiquement aux demandes clients (suivi commande, retours, remboursements). 80% des tickets resolus sans intervention humaine.\n\n- Agent Relance Paniers : detecte les paniers abandonnes et envoie des sequences de relance personnalisees par email. Jusqu'a +15% de taux de recuperation.\n\n- Agent Monitoring : surveille vos KPIs en continu et vous alerte en cas d'anomalie (pic de tickets, baisse de conversion).\n\nPour l'immobilier :\n\n- Agent Prise de RDV : qualifie les prospects et planifie les visites automatiquement.\n\n- Agent Collecte Documents : gere la collecte et la relance des documents necessaires.\n\n- Agent Relance Prospects : detecte les prospects inactifs et envoie des relances progressives.",
      },
      {
        title: 'Ce qui vous differencie des outils self-service',
        content: "Contrairement a Make, Zapier ou des chatbots generiques, Actero est un service gere. Vous ne configurez rien. Nous auditons, deployons, maintenons et optimisons vos automatisations. Vous avez un account manager dedie qui suit vos resultats chaque semaine. Si un workflow casse, on le repare avant que vous le remarquiez.",
      },
    ],
  },
  {
    id: 'deploiement-7-jours',
    category: 'getting-started',
    title: 'Le deploiement en 7 jours',
    summary: 'Etape par etape, ce qui se passe entre votre paiement et la mise en production.',
    icon: Clock,
    readTime: '4 min',
    sections: [
      {
        title: 'Jour 1-2 : Audit et decouverte',
        content: "Des que votre paiement est confirme, vous recevez un email d'invitation pour acceder a votre dashboard Actero. En parallele, notre equipe commence l'audit de votre activite : volume de tickets, taux d'abandon panier, outils utilises (Gorgias, Zendesk, Klaviyo), et vos regles metier specifiques.",
      },
      {
        title: 'Jour 3-5 : Configuration des agents',
        content: "Notre equipe configure vos agents IA :\n\n- Connexion a votre boutique Shopify (OAuth en 1 clic depuis votre dashboard)\n- Configuration du ton de marque et des regles de reponse\n- Mise en place des garde-fous (ce que l'agent ne doit jamais faire)\n- Deploiement des workflows d'automatisation (relance paniers, resolution tickets)\n- Tests internes avec des scenarios reels",
      },
      {
        title: 'Jour 6-7 : Tests et go-live',
        content: "Nous executons un script de test automatique qui simule des tickets et verifie que tout fonctionne : reponses de l'agent, webhooks Shopify, envoi d'emails. Vous pouvez tester vous-meme via le Simulateur de conversation dans votre dashboard. Une fois valide, on active les agents en production.",
      },
      {
        title: 'Apres le go-live',
        content: "Votre account manager suit vos metriques chaque semaine. Si un nouveau type de demande emerge, on ajuste les prompts. Si un produit a un pic de retours, on vous alerte. Le systeme s'ameliore en continu grace aux feedbacks que vous laissez (pouce haut/bas) sur chaque reponse de l'agent.",
      },
    ],
  },
  {
    id: 'connecter-shopify',
    category: 'integrations',
    title: 'Connecter votre boutique Shopify',
    summary: 'Guide pas-a-pas pour installer l\'app Actero sur votre Shopify.',
    icon: ShoppingBag,
    readTime: '3 min',
    sections: [
      {
        title: 'Prerequis',
        content: "- Un compte Actero actif (apres paiement)\n- Un compte Shopify (Basic, Shopify, Advanced ou Plus)\n- Droits administrateur sur votre boutique Shopify",
      },
      {
        title: 'Installation en 3 etapes',
        content: "1. Connectez-vous a votre dashboard Actero (actero.fr/login)\n\n2. Allez dans l'onglet Integrations dans la barre laterale\n\n3. Cliquez Connecter sur la carte Shopify. Un modal vous demande votre domaine Shopify (ex: ma-boutique.myshopify.com). Entrez-le et cliquez Connecter.\n\n4. Vous etes redirige vers Shopify pour autoriser l'acces. Cliquez Installer l'application.\n\n5. C'est fait ! Shopify apparait avec un badge vert Connecte dans votre dashboard.",
      },
      {
        title: 'Que fait l\'app Actero sur Shopify ?',
        content: "L'app accede en lecture a vos commandes, clients, produits, paniers et livraisons. Elle ne modifie jamais vos donnees Shopify. Les permissions exactes :\n\n- read_orders : lire les commandes pour le suivi\n- read_customers : identifier les clients recurrents\n- read_products : connaitre votre catalogue\n- read_fulfillments : suivre les livraisons\n- read_checkouts : detecter les paniers abandonnes",
      },
      {
        title: 'En cas de probleme',
        content: "Si l'installation echoue, verifiez que vous etes bien administrateur de votre boutique Shopify. Si le probleme persiste, lancez un Diagnostic systeme depuis votre dashboard (Vue d'ensemble) pour identifier le probleme. Vous pouvez aussi nous contacter a contact@actero.fr.",
      },
    ],
  },
  {
    id: 'connecter-integrations',
    category: 'integrations',
    title: 'Connecter vos outils (Slack, Gorgias, etc.)',
    summary: 'Comment connecter Slack, Gorgias, Zendesk et vos autres outils via OAuth.',
    icon: Plug,
    readTime: '3 min',
    sections: [
      {
        title: 'Integrations disponibles',
        content: "Actero se connecte a vos outils via OAuth (connexion securisee en 1 clic) :\n\n- Shopify : synchronisation commandes, clients, produits\n- Slack : alertes et notifications en temps reel\n- Gorgias : helpdesk e-commerce, tickets SAV\n- Zendesk : helpdesk, tickets, chat\n- Google Sheets : export de donnees\n- Gmail : envoi et reception d'emails\n\nA venir : Klaviyo, Freshdesk, Trustpilot, Calendly.",
      },
      {
        title: 'Comment connecter un outil',
        content: "1. Allez dans Integrations depuis votre dashboard\n2. Cliquez Connecter sur l'outil souhaite\n3. Pour Slack : vous etes redirige vers Slack pour autoriser l'acces\n4. Pour Gorgias/Zendesk : entrez votre sous-domaine puis autorisez\n5. Le badge passe en vert Connecte\n\nChaque integration peut etre testee (bouton Tester) et deconnectee a tout moment.",
      },
      {
        title: 'Que faire si une integration est en erreur',
        content: "Si une integration affiche un badge rouge Erreur :\n\n1. Cliquez Tester pour verifier la connexion\n2. Si le test echoue, cliquez Reconnecter pour relancer le flow OAuth\n3. Si le probleme persiste, deconnectez puis reconnectez l'integration\n4. Verifiez que votre compte sur l'outil tiers est toujours actif\n\nLe Diagnostic systeme (Vue d'ensemble) verifie automatiquement toutes vos integrations.",
      },
    ],
  },
  {
    id: 'configurer-agent-ia',
    category: 'agent-ia',
    title: 'Configurer votre agent IA',
    summary: 'Personnaliser le ton, la langue, les regles et le comportement de votre agent.',
    icon: Sparkles,
    readTime: '5 min',
    sections: [
      {
        title: 'Acceder a la configuration',
        content: "Dans votre dashboard, allez dans l'onglet Agent IA (section IA & Automatisation). Vous y trouverez tous les reglages de votre agent, sans code.",
      },
      {
        title: 'Ton de marque',
        content: "4 presets disponibles :\n\n- Professionnel et Chaleureux : ton equilibre, ideal pour la plupart des marques\n- Casual et Amical : tutoiement, emojis, proche du client\n- Formel et Premium : vouvoiement strict, vocabulaire soigne\n- Technique et Precis : reponses concises, orientees solution\n\nVous pouvez aussi ecrire votre propre description de ton dans le champ libre.",
      },
      {
        title: 'Politique de retour et produits exclus',
        content: "Renseignez votre politique de retour en texte libre : delais, conditions, exceptions. L'agent utilisera ces informations pour repondre aux demandes de retour et de remboursement.\n\nVous pouvez aussi lister les produits avec des regles speciales (ex: les coffrets cadeaux ne sont pas remboursables).",
      },
      {
        title: 'Garde-fous',
        content: "Dans l'onglet Garde-fous, definissez ce que l'agent ne doit JAMAIS faire :\n\n- Ne jamais proposer de remboursement sans escalade humaine\n- Ne jamais mentionner la concurrence\n- Toujours demander le numero de commande avant de traiter un retour\n\nChaque regle peut etre activee/desactivee individuellement. L'agent verifie ces regles avant chaque reponse.",
      },
      {
        title: 'Seuils d\'escalade',
        content: "Configurez quand l'agent doit passer la main a un humain :\n\n- Montant de commande : escalader si > X euros\n- Client fidele : escalader si le client a passe > X commandes\n- Confiance IA : escalader si la confiance est inferieure a X%\n- Ton agressif : escalader automatiquement les messages agressifs\n- Mots-cles : escalader si le message contient des mots specifiques (avocat, juridique, plainte)",
      },
    ],
  },
  {
    id: 'comprendre-dashboard',
    category: 'dashboard',
    title: 'Comprendre votre dashboard',
    summary: 'Tour complet de votre dashboard : metriques, activite, ROI et diagnostics.',
    icon: BarChart3,
    readTime: '6 min',
    sections: [
      {
        title: 'Vue d\'ensemble',
        content: "C'est votre page d'accueil. Elle affiche :\n\n- Checklist d'onboarding : les etapes restantes pour configurer votre espace\n- Diagnostic systeme : verifiez la sante de vos connexions en 1 clic\n- Metriques cles : temps economise, ROI genere, tickets resolus, actions IA\n- Graphiques : activite sur 14 jours et evolution du ROI\n- Activite recente : les 6 derniers evenements en temps reel (LIVE)",
      },
      {
        title: 'Metriques expliquees',
        content: "- Temps economise : nombre d'heures que vos agents IA ont economise. Calcul : tickets traites x temps moyen par ticket (configurable dans Mon Profil).\n\n- ROI genere : valeur monetaire du temps economise. Calcul : heures economisees x votre cout horaire.\n\n- Tickets resolus : nombre de demandes clients traitees automatiquement par l'IA.\n\n- Actions IA : nombre total d'actions automatisees (reponses, emails, relances, alertes).",
      },
      {
        title: 'Activite en direct',
        content: "L'onglet Activite affiche un flux temps reel de toutes les actions de vos agents. Chaque evenement est categorise (ticket resolu, panier relance, lead qualifie) avec un horodatage. Vous pouvez filtrer par type (tickets, paniers, escalades).\n\nLe point vert pulse indique que la connexion temps reel est active.",
      },
      {
        title: 'Escalades',
        content: "Quand l'IA ne peut pas resoudre un ticket (confiance trop basse, ton agressif, garde-fou declenche), le ticket est escalade. Vous voyez un badge rouge dans la barre laterale avec le nombre de tickets en attente.\n\nDans l'onglet Escalades, vous pouvez repondre au client directement. Option : cocher Ajouter a ma base de connaissances pour que l'IA apprenne de votre reponse.",
      },
      {
        title: 'Simulateur de conversation',
        content: "Le Simulateur vous permet de tester votre agent avant la mise en production. Tapez un faux message client et voyez exactement ce que l'agent repondrait, en utilisant votre configuration actuelle (ton, garde-fous, base de connaissances).\n\nAucun ticket reel n'est cree — c'est un mode sandbox.",
      },
    ],
  },
  {
    id: 'gerer-abonnement',
    category: 'billing',
    title: 'Gerer votre abonnement et vos factures',
    summary: 'Changer de plan, telecharger des factures, mettre a jour votre carte bancaire.',
    icon: Shield,
    readTime: '2 min',
    sections: [
      {
        title: 'Acceder au portail de facturation',
        content: "1. Allez dans Mon Profil (section Compte dans la barre laterale)\n2. Section Abonnement\n3. Cliquez le bouton vert Gerer mon abonnement\n4. Vous etes redirige vers le portail Stripe securise\n\nDepuis le portail Stripe, vous pouvez :\n- Voir et telecharger toutes vos factures\n- Mettre a jour votre carte bancaire\n- Modifier votre abonnement\n- Annuler votre abonnement (prend effet en fin de periode)",
      },
      {
        title: 'Facturation',
        content: "Actero facture mensuellement via Stripe. Les paiements sont securises (PCI DSS niveau 1). Vous recevez automatiquement une facture par email a chaque echeance.\n\nMention obligatoire sur nos factures : TVA non applicable, art. 293 B du CGI (regime micro-entrepreneur).",
      },
    ],
  },
  {
    id: 'base-de-connaissances',
    category: 'agent-ia',
    title: 'Enrichir la base de connaissances de l\'agent',
    summary: 'Ajouter des FAQ, politiques et informations produit pour ameliorer les reponses.',
    icon: BookOpen,
    readTime: '4 min',
    sections: [
      {
        title: 'Comment ca marche',
        content: "La base de connaissances est le cerveau de votre agent IA. Plus elle est complete, plus l'agent repond precisement. Vous pouvez y ajouter :\n\n- FAQ : questions/reponses frequentes\n- Politiques : livraison, retour, remboursement\n- Produits : caracteristiques, tailles, prix\n- Ton et style : instructions de communication\n- Infos temporaires : promotions en cours, fermetures exceptionnelles",
      },
      {
        title: 'Detection automatique des lacunes',
        content: "Actero detecte automatiquement les sujets auxquels l'agent n'a pas su repondre. En haut de la page Base de connaissances, un bandeau ambre apparait avec les sujets frequemment escalades (ex: '3x — Probleme taille produit').\n\nCliquez Couvrir pour creer une entree FAQ sur ce sujet. L'agent saura y repondre la prochaine fois.",
      },
      {
        title: 'Reponses memorisees',
        content: "Quand vous repondez a un ticket escalade, vous pouvez cocher Ajouter a ma base de connaissances. La question et votre reponse sont automatiquement ajoutees a la FAQ. L'agent reutilisera cette reponse pour les futures demandes similaires.\n\nPlus vous validez de reponses, plus l'agent s'ameliore sur vos cas specifiques.",
      },
    ],
  },
];

const CATEGORIES = [
  { id: 'getting-started', icon: Zap, title: 'Premiers pas', desc: 'Comprendre et demarrer avec Actero' },
  { id: 'integrations', icon: Plug, title: 'Integrations', desc: 'Connecter vos outils' },
  { id: 'agent-ia', icon: Sparkles, title: 'Agent IA', desc: 'Configurer et optimiser votre agent' },
  { id: 'dashboard', icon: BarChart3, title: 'Dashboard', desc: 'Comprendre vos metriques' },
  { id: 'billing', icon: Shield, title: 'Facturation', desc: 'Abonnement et factures' },
];

// ═══════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════
export const SupportGuidePage = ({ onNavigate }) => {
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const [search, setSearch] = useState('');
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const openGuide = (guide) => {
    setSelectedGuide(guide);
    window.scrollTo(0, 0);
  };

  const goBack = () => {
    setSelectedGuide(null);
    window.scrollTo(0, 0);
  };

  // Filter guides by search
  const filteredGuides = search.trim().length >= 2
    ? GUIDES.filter(g =>
        `${g.title} ${g.summary} ${g.sections.map(s => s.title + ' ' + s.content).join(' ')}`
          .toLowerCase().includes(search.toLowerCase())
      )
    : selectedCategory
      ? GUIDES.filter(g => g.category === selectedCategory)
      : GUIDES;

  // ── GUIDE DETAIL VIEW ──
  if (selectedGuide) {
    const guide = selectedGuide;
    const Icon = guide.icon;
    return (
      <>
        <SEO
          title={`${guide.title} — Centre d'aide Actero`}
          description={guide.summary}
          canonical="/support"
        />
        <div className="relative min-h-screen bg-white font-sans text-[#262626]">
          <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate("/audit")} />
          <main className="pt-28 md:pt-36 pb-24 px-6">
            <div className="max-w-3xl mx-auto">
              {/* Back button */}
              <button
                onClick={goBack}
                className="flex items-center gap-2 text-sm font-medium text-[#716D5C] hover:text-[#003725] transition-colors mb-8"
              >
                <ArrowLeft className="w-4 h-4" /> Retour au centre d'aide
              </button>

              {/* Header */}
              <div className="mb-12">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#003725]/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[#003725]" />
                  </div>
                  <span className="text-xs font-semibold text-[#716D5C] uppercase tracking-wider">
                    {CATEGORIES.find(c => c.id === guide.category)?.title}
                  </span>
                </div>
                <h1
                  className="text-3xl md:text-4xl font-normal text-[#262626] mb-4 leading-[1.15]"
                  style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
                >
                  {guide.title}
                </h1>
                <p className="text-[#716D5C] text-lg leading-relaxed">{guide.summary}</p>
                <div className="flex items-center gap-2 mt-4 text-xs text-[#716D5C]">
                  <Clock className="w-3.5 h-3.5" />
                  Lecture : {guide.readTime}
                </div>
              </div>

              {/* Sections */}
              <div className="space-y-10">
                {guide.sections.map((section, i) => (
                  <section key={i}>
                    <h2 className="text-xl font-bold text-[#262626] mb-4">
                      {section.title}
                    </h2>
                    <div className="text-[#716D5C] leading-relaxed text-[15px] whitespace-pre-line">
                      {section.content}
                    </div>
                    {i < guide.sections.length - 1 && (
                      <div className="mt-10 h-px bg-gray-200" />
                    )}
                  </section>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-16 p-8 bg-[#F9F7F1] rounded-2xl border border-gray-200 text-center">
                <p className="text-[#262626] font-bold mb-2">Besoin d'aide supplementaire ?</p>
                <p className="text-sm text-[#716D5C] mb-4">Notre equipe repond en moins de 24h.</p>
                <a href="mailto:contact@actero.fr" className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0F5F35] text-white rounded-full text-sm font-semibold hover:bg-[#003725] transition-colors">
                  <Mail className="w-4 h-4" /> Contacter le support
                </a>
              </div>
            </div>
          </main>
          <Footer onNavigate={onNavigate} />
        </div>
      </>
    );
  }

  // ── HOME VIEW ──
  return (
    <>
      <SEO
        title="Centre d'aide — Actero"
        description="Guides, tutoriels et documentation pour utiliser Actero. Integrations, dashboard, agents IA, facturation."
        canonical="/support"
      />
      <div className="relative min-h-screen bg-white font-sans text-[#262626]">
        <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate("/audit")} />

        <main className="pt-28 md:pt-36 pb-24 px-6">
          <div className="max-w-4xl mx-auto">

            {/* Hero */}
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F9F7F1] border border-gray-200 text-[#716D5C] text-xs font-bold uppercase tracking-widest mb-6">
                <BookOpen className="w-3.5 h-3.5" />
                Centre d'aide
              </div>
              <h1
                className="text-4xl md:text-5xl lg:text-6xl font-normal text-[#262626] mb-6 leading-[1.1]"
                style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
              >
                Comment pouvons-nous vous aider ?
              </h1>

              {/* Search */}
              <div className="relative max-w-xl mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#716D5C]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setSelectedCategory(null); }}
                  placeholder="Rechercher un guide, une question..."
                  className="w-full pl-12 pr-4 py-4 bg-[#F9F7F1] border border-gray-200 rounded-2xl text-[15px] text-[#262626] placeholder-gray-400 outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>
            </div>

            {/* Categories */}
            {!search.trim() && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-12">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const isActive = selectedCategory === cat.id;
                  const count = GUIDES.filter(g => g.category === cat.id).length;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(isActive ? null : cat.id)}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        isActive
                          ? 'bg-[#003725] text-white border-[#003725]'
                          : 'bg-white border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <Icon className={`w-5 h-5 mb-2 ${isActive ? 'text-white/80' : 'text-[#003725]'}`} />
                      <h3 className="font-bold text-xs mb-0.5">{cat.title}</h3>
                      <p className={`text-[10px] ${isActive ? 'text-white/60' : 'text-[#716D5C]'}`}>
                        {count} guide{count > 1 ? 's' : ''}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Guides list */}
            <div className="space-y-3">
              {filteredGuides.length === 0 ? (
                <div className="text-center py-16 text-[#716D5C]">
                  <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p>Aucun guide trouve pour "{search}"</p>
                </div>
              ) : (
                filteredGuides.map(guide => {
                  const Icon = guide.icon;
                  const catLabel = CATEGORIES.find(c => c.id === guide.category)?.title;
                  return (
                    <button
                      key={guide.id}
                      onClick={() => openGuide(guide)}
                      className="w-full flex items-center gap-5 p-5 bg-white border border-gray-200 rounded-2xl text-left hover:border-gray-300 hover:shadow-sm transition-all group"
                    >
                      <div className="w-11 h-11 rounded-xl bg-[#F9F7F1] flex items-center justify-center shrink-0 group-hover:bg-[#003725]/10 transition-colors">
                        <Icon className="w-5 h-5 text-[#003725]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-[15px] text-[#262626]">{guide.title}</h3>
                          <span className="text-[10px] text-[#716D5C] bg-[#F9F7F1] px-2 py-0.5 rounded-full shrink-0">{catLabel}</span>
                        </div>
                        <p className="text-sm text-[#716D5C] truncate">{guide.summary}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-[#716D5C]">{guide.readTime}</span>
                        <ArrowRight className="w-4 h-4 text-[#716D5C] group-hover:text-[#003725] transition-colors" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Contact CTA */}
            <div className="mt-20 text-center p-10 bg-[#F9F7F1] rounded-3xl border border-gray-200">
              <h2 className="text-2xl font-bold text-[#262626] mb-3" style={{ fontFamily: 'var(--font-display)' }}>
                Vous n'avez pas trouve votre reponse ?
              </h2>
              <p className="text-[#716D5C] mb-6">Notre equipe repond en moins de 24h.</p>
              <div className="flex flex-wrap justify-center gap-4">
                <a
                  href="mailto:contact@actero.fr"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#0F5F35] text-white rounded-full font-semibold hover:bg-[#003725] transition-colors"
                >
                  <Mail className="w-4 h-4" /> contact@actero.fr
                </a>
                <button
                  onClick={() => onNavigate('/audit')}
                  className="inline-flex items-center gap-2 px-6 py-3 text-[#003725] font-semibold underline underline-offset-4 decoration-[#003725]/40 hover:decoration-[#003725] transition-colors"
                >
                  Reserver un audit gratuit <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </main>

        <Footer onNavigate={onNavigate} />
      </div>
    </>
  );
};
