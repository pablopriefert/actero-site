import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, MessageSquare, Database, LineChart, Euro, Plus, Trash2, ArrowRight } from 'lucide-react';
import { FadeInUp } from './scroll-animations';

const AI_AGENTS = [
    {
        id: 'support',
        name: 'Agent Support N1',
        icon: MessageSquare,
        color: 'text-emerald-400',
        bg: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        desc: 'Résout 80% des tickets SAV (remboursements, suivi de commande) 24/7.',
        humanSalary: 2500,
        aiCost: 299
    },
    {
        id: 'sales',
        name: 'Agent Panier VIP',
        icon: Euro,
        color: 'text-blue-400',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/20',
        desc: 'Appelle ou SMS automatiquement les paniers abandonnés > 500€.',
        humanSalary: 3500,
        aiCost: 399
    },
    {
        id: 'data',
        name: 'Agent Data Analyst',
        icon: LineChart,
        color: 'text-purple-400',
        bg: 'bg-purple-500/10',
        border: 'border-purple-500/20',
        desc: 'Analyse vos KPIs Shopify/Stripe et vous alerte des anomalies sur Slack.',
        humanSalary: 4500,
        aiCost: 499
    },
    {
        id: 'crm',
        name: 'Agent Sync CRM',
        icon: Database,
        color: 'text-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/20',
        desc: 'Nettoie et segmente votre Hubspot/Klaviyo en temps réel.',
        humanSalary: 2000,
        aiCost: 199
    }
];

export const AITeamBuilder = ({ onNavigate }) => {
    const [team, setTeam] = useState([]);

    const addAgent = (agent) => {
        // Prevent adding the same agent multiple times for simplicity of demo
        if (!team.find(a => a.id === agent.id)) {
            setTeam([...team, agent]);
        }
    };

    const removeAgent = (agentId) => {
        setTeam(team.filter(a => a.id !== agentId));
    };

    const totalHumanCost = team.reduce((sum, agent) => sum + agent.humanSalary, 0);
    const totalAiCost = team.reduce((sum, agent) => sum + agent.aiCost, 0);
    const savings = totalHumanCost - totalAiCost;

    const formatCurrency = (val) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

    return (
        <section className="py-24 relative overflow-hidden bg-transparent border-t border-white/5 z-10 w-full" id="team-builder">
            <div className="max-w-6xl mx-auto px-6 relative z-10">
                <FadeInUp className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-sm font-bold text-emerald-400 mb-6">
                        <Bot className="w-4 h-4" /> Simulateur Interactif
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
                        Construisez votre équipe IA autonome
                    </h2>
                    <p className="text-lg text-gray-400 font-medium max-w-2xl mx-auto">
                        Cliquer pour recruter un agent virtuel. Comparez instantanément le coût d'une infrastructure automatisée par Actero face à des recrutements humains traditionnels.
                    </p>
                </FadeInUp>

                <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">

                    {/* Available Agents Pool */}
                    <FadeInUp delay={0.1} className="w-full lg:w-1/2">
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            Talents IA Disponibles <span className="text-sm font-normal text-gray-500">({AI_AGENTS.length - team.length})</span>
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {AI_AGENTS.map((agent) => {
                                const isSelected = team.some(a => a.id === agent.id);
                                const Icon = agent.icon;

                                return (
                                    <button
                                        key={agent.id}
                                        onClick={() => addAgent(agent)}
                                        disabled={isSelected}
                                        className={`p-5 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden group ${isSelected
                                                ? 'bg-white/5 border-white/5 opacity-50 cursor-not-allowed'
                                                : 'bg-[#0a0a0a] border-white/10 hover:border-white/20 hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${agent.bg} ${agent.border}`}>
                                                <Icon className={`w-5 h-5 ${agent.color}`} />
                                            </div>
                                            {!isSelected && (
                                                <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Plus className="w-4 h-4 text-white" />
                                                </div>
                                            )}
                                        </div>
                                        <h4 className="font-bold text-white mb-2">{agent.name}</h4>
                                        <p className="text-sm text-gray-400 leading-relaxed min-h-[40px] mb-4">
                                            {agent.desc}
                                        </p>
                                        <div className="text-xs font-bold text-gray-500 uppercase tracking-widest pt-4 border-t border-white/5">
                                            Équivalent: {formatCurrency(agent.humanSalary)}/mois
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </FadeInUp>

                    {/* Your Active Team & ROI Dashboard */}
                    <FadeInUp delay={0.2} className="w-full lg:w-1/2 sticky top-32">
                        <div className="bg-[#0a0a0a] rounded-[32px] border border-white/10 p-6 md:p-8 shadow-2xl relative overflow-hidden">
                            {/* Decorative background blur */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>

                            <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-6 relative z-10">
                                <div>
                                    <h3 className="text-2xl font-bold text-white">Votre Infrastructure</h3>
                                    <p className="text-sm text-gray-400">Agents déployés en continu</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-black text-white">{team.length}</div>
                                    <div className="text-xs text-gray-500 font-bold uppercase">Agents actifs</div>
                                </div>
                            </div>

                            {/* Active Agents List */}
                            <div className="min-h-[160px] mb-8 relative z-10">
                                {team.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-white/10 rounded-2xl bg-white/5">
                                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4">
                                            <Bot className="w-6 h-6 text-gray-500" />
                                        </div>
                                        <p className="text-gray-400 font-medium">Aucun agent sélectionné.<br />Cliquez sur un talent pour l'ajouter.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <AnimatePresence>
                                            {team.map((agent) => {
                                                const Icon = agent.icon;
                                                return (
                                                    <motion.div
                                                        key={`team-${agent.id}`}
                                                        initial={{ opacity: 0, x: 20 }}
                                                        animate={{ opacity: 1, x: 0 }}
                                                        exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${agent.bg} ${agent.border}`}>
                                                                <Icon className={`w-4 h-4 ${agent.color}`} />
                                                            </div>
                                                            <span className="font-semibold text-white text-sm">{agent.name}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => removeAgent(agent.id)}
                                                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                            title="Renvoyer l'agent"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </motion.div>
                                                )
                                            })}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>

                            {/* ROI Math Calculation */}
                            <div className="bg-black/50 rounded-2xl p-6 border border-white/5 relative z-10">
                                <div className="flex justify-between items-center mb-4 text-sm">
                                    <span className="text-gray-400">Coût Salarial (Humains)</span>
                                    <span className="font-medium text-red-400 opacity-60 line-through decoration-red-500/50">{formatCurrency(totalHumanCost)}</span>
                                </div>
                                <div className="flex justify-between items-center mb-6 text-sm">
                                    <span className="text-gray-400">Abonnement Actero E-commerce</span>
                                    <span className="font-bold text-white">{team.length > 0 ? "Sur-Mesure" : "0 €"}</span>
                                </div>
                                <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                                    <div>
                                        <div className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-1">Économies Nettes / mois</div>
                                        <motion.div
                                            key={savings}
                                            initial={{ scale: 0.9, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="text-3xl md:text-4xl font-black text-emerald-400"
                                            style={{ fontVariantNumeric: 'tabular-nums' }}
                                        >
                                            +{formatCurrency(savings)}
                                        </motion.div>
                                    </div>
                                </div>
                            </div>

                            {/* CTA */}
                            {team.length > 0 && (
                                <motion.button
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={() => onNavigate('/audit')}
                                    className="w-full mt-6 py-4 rounded-xl font-bold text-sm bg-white text-black hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 relative z-10"
                                >
                                    Déployer cette infrastructure <ArrowRight className="w-4 h-4" />
                                </motion.button>
                            )}
                        </div>
                    </FadeInUp>

                </div>
            </div>
        </section>
    );
};
