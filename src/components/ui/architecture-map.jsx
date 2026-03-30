import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Server, Database, MessageSquare, ShoppingCart, Mail, ArrowRight, Activity, Zap } from 'lucide-react';
import { FadeInUp } from './scroll-animations';

// Scenarios defining the data flow
const scenarios = [
    {
        id: 'refund',
        name: 'Remboursement Autonome',
        description: 'L\'IA analyse le ticket Zendesk, vérifie la politique Shopify, traite sur Stripe et tag le CRM.',
        flow: ['zendesk', 'actero', 'shopify', 'stripe', 'actero', 'crm']
    },
    {
        id: 'cart',
        name: 'Relance Panier VIP',
        description: 'Détection d\'un panier abandonné >500€. L\'IA génère un e-mail hyper-personnalisé via Klaviyo.',
        flow: ['shopify', 'actero', 'crm', 'actero', 'klaviyo']
    },
    {
        id: 'review',
        name: 'Gestion des Avis Négatifs',
        description: 'Un avis 1 étoile est posté. L\'IA crée un ticket urgent et prépare un brouillon d\'excuse + code promo.',
        flow: ['shopify', 'actero', 'zendesk', 'klaviyo']
    }
];

// Node configurations
const nodes = {
    actero: { id: 'actero', label: 'Actero AI Engine', icon: Server, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', pos: 'col-start-2 row-start-2' },
    shopify: { id: 'shopify', label: 'Shopify / Boutique', icon: ShoppingCart, color: 'text-[#95BF47]', bg: 'bg-[#95BF47]/10', border: 'border-[#95BF47]/20', pos: 'col-start-1 row-start-1' },
    stripe: { id: 'stripe', label: 'Stripe / Paiement', icon: Activity, color: 'text-[#635BFF]', bg: 'bg-[#635BFF]/10', border: 'border-[#635BFF]/20', pos: 'col-start-3 row-start-1' },
    zendesk: { id: 'zendesk', label: 'Zendesk / Support', icon: MessageSquare, color: 'text-[#17494D]', bg: 'bg-[#17494D]/30', border: 'border-[#17494D]/40', pos: 'col-start-1 row-start-3' },
    klaviyo: { id: 'klaviyo', label: 'Klaviyo / E-mail', icon: Mail, color: 'text-white', bg: 'bg-white/10', border: 'border-white/20', pos: 'col-start-3 row-start-3' },
    crm: { id: 'crm', label: 'HubSpot / CRM', icon: Database, color: 'text-[#FF7A59]', bg: 'bg-[#FF7A59]/10', border: 'border-[#FF7A59]/20', pos: 'col-start-2 row-start-1 mt-[-60px]' }
};

export const ArchitectureMap = () => {
    const [activeScenario, setActiveScenario] = useState(scenarios[0]);
    const [activeNodeIndex, setActiveNodeIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);

    // Play scenario animation sequence
    useEffect(() => {
        let interval;
        if (isPlaying) {
            interval = setInterval(() => {
                setActiveNodeIndex((prev) => {
                    if (prev >= activeScenario.flow.length - 1) {
                        setIsPlaying(false);
                        return prev;
                    }
                    return prev + 1;
                });
            }, 1000); // 1 sec per step
        }
        return () => clearInterval(interval);
    }, [isPlaying, activeScenario]);

    const playScenario = (scenario) => {
        setActiveScenario(scenario);
        setActiveNodeIndex(0);
        setIsPlaying(true);
    };

    return (
        <section className="py-24 relative overflow-hidden bg-[#0A0E1A] z-10 w-full border-t border-white/5">
            <div className="max-w-6xl mx-auto px-6 relative z-10">
                <FadeInUp className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-sm font-bold text-blue-400 mb-6">
                        <Zap className="w-4 h-4" /> Temps Réel
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
                        L'intelligence centralisée de vos flux
                    </h2>
                    <p className="text-lg text-gray-400 font-medium max-w-2xl mx-auto">
                        Actero connecte vos outils isolés. Sélectionnez un scénario pour visualiser comment les données transitent et sont traitées par l'IA en une fraction de seconde.
                    </p>
                </FadeInUp>

                <div className="flex flex-col lg:flex-row gap-12 items-center">

                    {/* Interactive Controls */}
                    <FadeInUp delay={0.1} className="w-full lg:w-1/3 flex flex-col gap-4">
                        <h3 className="text-xl font-bold text-white mb-2">Scénarios d'Exemple</h3>
                        {scenarios.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => playScenario(s)}
                                className={`text-left p-5 rounded-2xl border transition-all duration-300 ${activeScenario.id === s.id
                                        ? 'bg-blue-500/10 border-blue-500/30'
                                        : 'bg-[#0E1424] border-white/5 hover:border-white/10 hover:bg-white/5'
                                    }`}
                            >
                                <div className="flex justify-between items-center mb-2">
                                    <span className={`font-bold ${activeScenario.id === s.id ? 'text-blue-400' : 'text-white'}`}>
                                        {s.name}
                                    </span>
                                    {activeScenario.id === s.id && isPlaying && (
                                        <span className="flex h-3 w-3 relative">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm font-medium text-gray-400 leading-relaxed">
                                    {s.description}
                                </p>
                            </button>
                        ))}
                    </FadeInUp>

                    {/* Node Visualizer Grid */}
                    <FadeInUp delay={0.2} className="w-full lg:w-2/3">
                        <div className="bg-[#0E1424] rounded-[32px] border border-white/5 p-8 md:p-16 relative overflow-hidden flex items-center justify-center min-h-[500px]">
                            {/* Grid layout for nodes */}
                            <div className="grid grid-cols-3 grid-rows-3 gap-8 md:gap-16 relative z-10 w-full max-w-lg mx-auto">

                                {Object.values(nodes).map((node) => {
                                    const Icon = node.icon;
                                    const isActiveInFlow = activeScenario.flow[activeNodeIndex] === node.id;
                                    const isProcessed = activeScenario.flow.slice(0, activeNodeIndex).includes(node.id);

                                    return (
                                        <div
                                            key={node.id}
                                            className={`${node.pos} flex flex-col items-center justify-center gap-3 transition-all duration-500 ${isActiveInFlow ? 'scale-110' : 'scale-100 opacity-80'}`}
                                        >
                                            <div className={`relative flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl border ${node.bg} ${node.border} transition-shadow duration-300 ${isActiveInFlow ? `shadow-[0_0_30px_rgba(255,255,255,0.1)]` : ''}`}>
                                                {isActiveInFlow && (
                                                    <motion.div
                                                        layoutId="activeGlow"
                                                        className="absolute inset-0 bg-white/20 rounded-2xl blur-md"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                    />
                                                )}
                                                <Icon className={`w-8 h-8 md:w-10 md:h-10 relative z-10 ${node.color}`} />
                                            </div>
                                            <span className={`text-xs font-bold text-center ${isActiveInFlow || isProcessed ? 'text-white' : 'text-gray-500'}`}>
                                                {node.label}
                                            </span>
                                        </div>
                                    );
                                })}

                                {/* Active Flow Indicator Text */}
                                <div className="absolute inset-x-0 bottom-[-40px] text-center">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={activeNodeIndex}
                                            initial={{ y: 10, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            exit={{ y: -10, opacity: 0 }}
                                            className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full text-xs font-bold text-gray-300"
                                        >
                                            <Activity className="w-3 h-3 text-blue-400" />
                                            Envoi vers : {nodes[activeScenario.flow[activeNodeIndex]]?.label}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Background decoration */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none"></div>
                        </div>
                    </FadeInUp>
                </div>
            </div>
        </section>
    );
};
