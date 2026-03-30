import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Search,
    MessageSquare,
    Share2,
    Copy,
    Check,
    Zap,
    Database,
    ArrowRight,
    Filter
} from 'lucide-react';
import { FadeInUp, StaggerContainer, StaggerItem } from './scroll-animations';

// Fake Data for the Prompts Library
const LIBRARY_DATA = [
    {
        id: 1,
        title: "Prompt Générateur de Fiche Produit SEO",
        category: "Marketing",
        icon: Search,
        difficulty: "Débutant",
        platform: "ChatGPT / Claude",
        content: `Agis en tant qu'expert SEO E-commerce et Copywriter.
Rédige une fiche produit convaincante pour : [NOM DU PRODUIT].

Cible : [CIBLE].
Bénéfice principal : [BÉNÉFICE].

Structure exigée :
1. Titre H1 optimisé SEO (inclure le mot clé principal).
2. Paragraphe d'accroche émotionnel (2-3 phrases).
3. Liste à puces des 3 bénéfices majeurs.
4. Caractéristiques techniques (Format tableau).
5. FAQ de 3 questions.

Ton ton doit être : [TON (ex: premium, rassurant, dynamique)].`,
        tags: ["SEO", "Copywriting"]
    },
    {
        id: 2,
        title: "Prompt Réponse Avis Client Négatif",
        category: "Support",
        icon: MessageSquare,
        difficulty: "Intermédiaire",
        platform: "Zendesk AI / ChatGPT",
        content: `Tu es le responsable de la relation client de la marque [NOM DE LA MARQUE].
Rédige une réponse professionnelle, empathique et orientée solution pour cet avis négatif :

Avis du client : "[COLLER L'AVIS ICI]"
Motif profond de l'insatisfaction : [EX: RETARD DE LIVRAISON, PRODUIT DÉFECTUEUX]

Règles :
- Remercie le client pour son retour de manière authentique.
- Ne te justifie pas de manière agressive.
- Propose une solution immédiate ou invite-le à contacter le canal approprié via l'email : [EMAIL SUPPORT].
- Reste court (max 4 phrases).`,
        tags: ["SAV", "Trustpilot"]
    },
    {
        id: 3,
        title: "Workflow : Notification Slack Panier Abandonné VIP",
        category: "Automatisation",
        icon: Zap,
        difficulty: "Avancé",
        platform: "Make.com",
        content: `Ce n'est pas un prompt texte, mais la structure logique d'un flow Make.com/n8n :

1. Déclencheur (Trigger) : Shopify "Checkout Abandoned".
2. Filtre (Router) : Total du panier > 500€.
3. Action 1 : Hubspot "Search CRM Contact" (Récupérer le numéro de tel).
4. Action 2 : OpenAI "Générer un script d'appel personnalisé" (Utilisant le prénom et les articles du panier).
5. Action 3 : Slack "Send Message" au channel #sales-vip avec :
   - Lien du panier
   - Numéro du client
   - Script d'appel généré
6. (Optionnel) Action 4 : Twilio/Bland.ai (Appel et message vocal automatique si l'équipe est de nuit).`,
        tags: ["Shopify", "Slack", "VIP"]
    },
    {
        id: 4,
        title: "Prompt Analyse Data Cohorte (Export Stripe/Shopify)",
        category: "Data",
        icon: Database,
        difficulty: "Expert",
        platform: "ChatGPT Advanced Data Analysis",
        content: `Voici un fichier CSV contenant nos commandes des 6 derniers mois (Colonnes : Date, Customer ID, Order Value, Source).

1. Nettoie les données (supprime les valeurs aberrantes et les commandes annulées).
2. Construis une analyse de cohorte mensuelle montrant le taux de rétention à M+1, M+2 et M+3.
3. Identifie quelle "Source" (Meta, Google, Direct) génère la meilleure LTV (Customer Lifetime Value) sur 3 mois.
4. Génère 3 recommandations actionnables pour augmenter le réachat sur le mois M+2.`,
        tags: ["Analyse", "LTV", "CSV"]
    },
    {
        id: 5,
        title: "Workflow : Savoir Magique (Analyse de Sentiment Ticket)",
        category: "Automatisation",
        icon: MessageSquare,
        difficulty: "Avancé",
        platform: "Make.com + OpenAI",
        content: `1. Déclencheur : Nouveau ticket Zendesk / Gorgias.
2. Action OpenAI : Analyser le texte du ticket.
   - Prompt OpenAI : "Analyse le sentiment de cet email client et retourne uniquement l'étiquette : [URGENT/COLÈRE], [DEMANDE INFO], [RETOUR], ou [AUTRE]. Email : {Ticket.Body}"
3. Routeur Make :
   - Si [URGENT/COLÈRE] : Tag le ticket en "Priorité Haute" + Envoie notif Slack au manager.
   - Si [RETOUR] : Génère un lien de retour via l'API du prestataire logistique (ex: Sendcloud) et répond au client de manière autonome.`,
        tags: ["IA", "Zendesk", "Tri"]
    },
    {
        id: 6,
        title: "Prompt Générateur d'Angles Créas (Ads)",
        category: "Marketing",
        icon: Share2,
        difficulty: "Intermédiaire",
        platform: "Claude 3.5 Sonnet",
        content: `Tu es un Media Buyer Senior spécialisé en E-commerce Direct-to-Consumer (DTC).
Je vends [NOM DU PRODUIT] qui résout le problème suivant : [PROBLÈME].

Génère 5 "Angles marketing" (Hooks) totalement différents pour des publicités Meta/Tiktok.
Pour chaque angle, donne :
1. L'accroche visuelle (Les 3 premières secondes de la vidéo).
2. Le Hook textuel (Ce que dit la voix off ou le texte à l'écran).
3. La cible psychologique visée par cet angle.

Sors des sentiers battus (humour, douleur extrême, bénéfice inattendu, éducatif/fondateur).`,
        tags: ["Meta Ads", "TikTok", "Creative"]
    }
];

const CATEGORIES = ["Tous", "Marketing", "Support", "Data", "Automatisation"];

export const PromptLibraryPage = ({ onNavigate }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState("Tous");
    const [copiedId, setCopiedId] = useState(null);

    // Filter Logic
    const filteredData = LIBRARY_DATA.filter(item => {
        const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
        const matchesCat = activeCategory === "Tous" || item.category === activeCategory;
        return matchesSearch && matchesCat;
    });

    const handleCopy = (id, content) => {
        navigator.clipboard.writeText(content);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    return (
        <div className="min-h-screen bg-[#0A0E1A] pt-32 pb-24 selection:bg-emerald-500/30">
            {/* Background Effects */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-0 right-1/4 w-[800px] h-[800px] bg-emerald-500/5 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[120px]"></div>
            </div>

            <div className="max-w-7xl mx-auto px-6 relative z-10">

                {/* Header Row */}
                <FadeInUp className="text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-8 mb-16">
                    <div>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-bold text-gray-300 mb-6 mx-auto md:mx-0">
                            <Database className="w-4 h-4" /> Open Source E-commerce
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-4">
                            Prompt <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-emerald-600">Library</span>.
                        </h1>
                        <p className="text-lg text-gray-400 font-medium max-w-xl">
                            La collection définitive de prompts IA et d'architectures d'automatisation pour scaler votre E-commerce. Copier, Coller, Exécuter.
                        </p>
                    </div>

                    {/* CTA to get a custom setup */}
                    <div className="bg-[#0E1424] border border-white/10 p-6 rounded-3xl w-full md:w-auto text-left shadow-2xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <h3 className="text-white font-bold text-lg mb-2 relative z-10">Trop complexe à déployer ?</h3>
                        <p className="text-gray-400 text-sm mb-4 max-w-xs relative z-10">Nos ingénieurs déploient ces systèmes directement dans votre stack existante.</p>
                        <button
                            onClick={() => onNavigate('/audit')}
                            className="text-sm font-bold bg-white text-black px-5 py-2.5 rounded-xl hover:bg-gray-200 transition-colors w-full flex items-center justify-center gap-2 relative z-10"
                        >
                            Auditer mon site <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </FadeInUp>

                {/* Filters Row */}
                <FadeInUp delay={0.1} className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">

                    {/* Category Pills */}
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`px-4 py-2 rounded-xl text-sm font-bold transition-all duration-300 ${activeCategory === cat
                                        ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]'
                                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Search Bar */}
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Rechercher (ex: SEO, Zendesk)"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-[#0E1424] border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-gray-600"
                        />
                    </div>
                </FadeInUp>

                {/* Grid of Prompts */}
                {filteredData.length === 0 ? (
                    <div className="text-center py-24 bg-white/5 border border-dashed border-white/10 rounded-3xl">
                        <Filter className="w-8 h-8 text-gray-600 mx-auto mb-4" />
                        <h3 className="text-white font-bold mb-2">Aucun résultat trouvé</h3>
                        <p className="text-gray-500 text-sm">Essayez de modifier vos filtres de recherche.</p>
                        <button
                            onClick={() => { setSearchQuery(""); setActiveCategory("Tous"); }}
                            className="text-emerald-400 text-sm font-bold mt-4 hover:underline"
                        >
                            Réinitialiser les filtres
                        </button>
                    </div>
                ) : (
                    <StaggerContainer className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <AnimatePresence>
                            {filteredData.map((item) => {
                                const Icon = item.icon;
                                const isCopied = copiedId === item.id;

                                return (
                                    <StaggerItem key={item.id}>
                                        <motion.div
                                            layout
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            className="bg-[#0E1424] border border-white/10 rounded-[24px] p-6 h-full flex flex-col group hover:border-emerald-500/30 transition-colors"
                                        >
                                            <div className="flex justify-between items-start mb-6">
                                                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 group-hover:text-emerald-400 transition-colors">
                                                    <Icon className="w-6 h-6" />
                                                </div>
                                                <div className="flex gap-2">
                                                    <span className="px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                                                        {item.difficulty}
                                                    </span>
                                                </div>
                                            </div>

                                            <h3 className="text-xl font-bold text-white mb-2 leading-tight">
                                                {item.title}
                                            </h3>

                                            <p className="text-xs font-medium text-gray-500 mb-6 flex items-center gap-1">
                                                Outil : <span className="text-gray-300">{item.platform}</span>
                                            </p>

                                            {/* Code Block Snippet */}
                                            <div className="bg-[#111] rounded-xl p-4 border border-white/5 mb-6 relative overflow-hidden group/code cursor-text flex-1">
                                                <pre className="text-sm text-gray-400 whitespace-pre-wrap font-mono leading-relaxed h-[120px] overflow-hidden relative">
                                                    {item.content}
                                                    {/* Fade effect at bottom */}
                                                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#111] to-transparent"></div>
                                                </pre>
                                            </div>

                                            <div className="flex items-center justify-between mt-auto">
                                                <div className="flex gap-2">
                                                    {item.tags.slice(0, 2).map(tag => (
                                                        <span key={tag} className="text-[11px] font-bold text-emerald-500/70 bg-emerald-500/10 px-2 py-1 rounded">
                                                            #{tag}
                                                        </span>
                                                    ))}
                                                </div>

                                                <button
                                                    onClick={() => handleCopy(item.id, item.content)}
                                                    className={`p-2.5 rounded-xl transition-all duration-300 flex items-center justify-center shadow-lg ${isCopied ? 'bg-emerald-500 text-black' : 'bg-white text-black hover:bg-gray-200'
                                                        }`}
                                                    title="Copier le Prompt"
                                                >
                                                    {isCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </motion.div>
                                    </StaggerItem>
                                )
                            })}
                        </AnimatePresence>
                    </StaggerContainer>
                )}
            </div>
        </div>
    );
};
