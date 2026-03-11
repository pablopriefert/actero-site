import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    LayoutDashboard,
    MessageSquare,
    ShoppingCart,
    Zap,
    ArrowRight,
    TrendingUp,
    Users,
    Clock,
    Activity,
    CheckCircle2,
    Lock
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { ArchitectureMap } from './architecture-map';
import { BeforeAfterSlider } from './before-after-slider';

// Faux data for the Recharts graph
const data = [
    { name: 'Lun', marge: 4000, tickets: 240 },
    { name: 'Mar', marge: 3000, tickets: 139 },
    { name: 'Mer', marge: 2000, tickets: 980 },
    { name: 'Jeu', marge: 2780, tickets: 390 },
    { name: 'Ven', marge: 1890, tickets: 480 },
    { name: 'Sam', marge: 2390, tickets: 380 },
    { name: 'Dim', marge: 3490, tickets: 430 },
];

// Custom Tooltip for Recharts — declared outside render to avoid re-creation
const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-[#111] border border-white/10 p-3 rounded-xl shadow-xl">
                <p className="text-gray-400 text-xs mb-1">{label}</p>
                <p className="text-emerald-400 font-bold text-sm">
                    Marge sauvée : {payload[0].value}€
                </p>
            </div>
        );
    }
    return null;
};

export const DemoDashboardPage = ({ onNavigate }) => {
    const [recentLogs, setRecentLogs] = useState([
        { id: 1, text: "L'Agent Support a remboursé la commande #4928 (Motif: Retard Colissimo).", time: "à l'instant", type: "support" },
        { id: 2, text: "Panier VIP abandonné détecté. Call vocal IA effectué vers +33612...", time: "il y a 4 min", type: "sales" },
        { id: 3, text: "Avis 1-étoile détecté sur Trustpilot. Brouillon de réponse généré dans Zendesk.", time: "il y a 12 min", type: "alert" }
    ]);

    // Simulate real-time logs arriving
    useEffect(() => {
        const interval = setInterval(() => {
            const newLogs = [
                { id: Date.now(), text: "Nouveau lead LinkedIn extrait et ajouté à HubSpot (CEO @ Startup).", time: "à l'instant", type: "sales" },
                { id: Date.now() + 1, text: "Facture Stripe #INV-89 générée et envoyée au comptable.", time: "à l'instant", type: "data" },
                { id: Date.now() + 2, text: "3 tickets 'Où est ma commande' résolus automatiquement.", time: "à l'instant", type: "support" }
            ];
            const randomLog = newLogs[Math.floor(Math.random() * newLogs.length)];

            setRecentLogs(prev => {
                const updated = [randomLog, ...prev];
                return updated.slice(0, 4); // Keep only latest 4 logs
            });
        }, 8000); // New log every 8 seconds

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="min-h-screen bg-[#030303] text-white selection:bg-emerald-500/30">
            {/* Header Banner - Explaining this is a demo */}
            <div className="bg-emerald-500/10 border-b border-emerald-500/20 py-3 px-6 text-center relative z-50">
                <p className="text-emerald-400 text-sm font-bold flex items-center justify-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Environnement de Démonstration (Vue Client Actero)
                </p>
            </div>

            <div className="flex h-[calc(100vh-45px)] overflow-hidden">

                {/* Sidebar (Fake Menu) */}
                <div className="w-64 bg-[#0a0a0a] border-r border-white/5 p-6 hidden md:flex flex-col flex-shrink-0">
                    <div className="flex items-center gap-3 mb-12">
                        <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
                            <div className="w-3 h-3 bg-black rounded-sm rotate-45"></div>
                        </div>
                        <span className="font-bold text-xl tracking-tight">Actero OS</span>
                    </div>

                    <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3 px-4 py-3 bg-white/5 text-white rounded-xl font-medium cursor-pointer">
                            <LayoutDashboard className="w-4 h-4" /> Vue d'ensemble
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-300 transition-colors cursor-not-allowed group">
                            <MessageSquare className="w-4 h-4" />
                            Agents Support <Lock className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100" />
                        </div>
                        <div className="flex items-center gap-3 px-4 py-3 text-gray-500 hover:text-gray-300 transition-colors cursor-not-allowed group">
                            <ShoppingCart className="w-4 h-4" />
                            Automatisations Vente <Lock className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100" />
                        </div>
                    </div>

                    <div className="mt-auto border-t border-white/5 pt-6">
                        <div className="flex items-center gap-3 px-4">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-blue-500 flex items-center justify-center text-xs font-bold">
                                JD
                            </div>
                            <div>
                                <p className="text-sm font-bold">John Doe</p>
                                <p className="text-xs text-gray-500">CEO @ Demo Store</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Dashboard Content */}
                <div className="flex-1 overflow-y-auto bg-[#030303] relative">

                    {/* Background glow */}
                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>

                    <div className="p-6 md:p-12 max-w-7xl mx-auto relative z-10">

                        {/* Header */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                            <div>
                                <h1 className="text-3xl font-bold tracking-tight mb-2">Bonjour, John</h1>
                                <p className="text-gray-400">Voici l'impact de votre infrastructure IA sur les 7 derniers jours.</p>
                            </div>
                            <button onClick={() => onNavigate('/audit')} className="inline-flex items-center gap-2 bg-emerald-500 text-black px-6 py-3 rounded-xl font-bold hover:bg-emerald-400 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                                Passer à l'action en vrai <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Top KPI Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                                        <TrendingUp className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full">+12%</span>
                                </div>
                                <h3 className="text-3xl font-black mb-1">12 450 €</h3>
                                <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Marge nette récupérée</p>
                            </motion.div>

                            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                                        <Users className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-bold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-full">+45h</span>
                                </div>
                                <h3 className="text-3xl font-black mb-1">142h</h3>
                                <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Temps humain économisé</p>
                            </motion.div>

                            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 shadow-sm">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                                        <CheckCircle2 className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full">Auto</span>
                                </div>
                                <h3 className="text-3xl font-black mb-1">84%</h3>
                                <p className="text-sm font-medium text-gray-500 uppercase tracking-widest">Taux de résolution SAV</p>
                            </motion.div>
                        </div>

                        {/* Chart & Logs Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                            {/* Recharts Graph */}
                            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="lg:col-span-2 bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 h-[400px] flex flex-col">
                                <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
                                    <Activity className="w-4 h-4 text-emerald-400" /> Croissance générée par l'IA
                                </h3>
                                <div className="flex-1 w-full relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                            <defs>
                                                <linearGradient id="colorMarge" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                                            <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                                            <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}€`} />
                                            <Tooltip content={<CustomTooltip />} />
                                            <Area type="monotone" dataKey="marge" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorMarge)" />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </motion.div>

                            {/* Live Logs Feed */}
                            <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }} className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 h-[400px] flex flex-col overflow-hidden">
                                <h3 className="text-lg font-bold mb-6 flex items-center justify-between">
                                    <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-amber-400" /> Flux en direct</span>
                                    <span className="flex h-2 w-2 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                </h3>

                                <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                                    {recentLogs.map((log) => (
                                        <motion.div
                                            key={log.id}
                                            initial={{ x: 20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            className="p-4 rounded-xl bg-white/5 border border-white/5 flex gap-3 relative"
                                        >
                                            {/* Colored indicator based on type */}
                                            <div className={`w-1 h-full absolute left-0 top-0 rounded-l-xl ${log.type === 'support' ? 'bg-purple-500' :
                                                log.type === 'sales' ? 'bg-blue-500' :
                                                    log.type === 'alert' ? 'bg-amber-500' : 'bg-emerald-500'
                                                }`}></div>

                                            <div className="flex-1 pl-2">
                                                <p className="text-[13px] text-gray-300 leading-snug mb-1">{log.text}</p>
                                                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest flex items-center gap-1">
                                                    <Clock className="w-3 h-3" /> {log.time}
                                                </p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </motion.div>

                        </div>

                    </div>
                </div>
            </div>

            {/* Architecture Map Section */}
            <ArchitectureMap />

            {/* Before/After Slider Section */}
            <BeforeAfterSlider />

            {/* Bottom CTA */}
            <section className="py-24 text-center bg-[#030303] border-t border-white/5">
                <div className="max-w-2xl mx-auto px-6">
                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-6">
                        Prêt à transformer votre stack ?
                    </h2>
                    <p className="text-gray-400 text-lg font-medium mb-8">
                        Ce simulateur n'est qu'un aperçu. Réservez un audit gratuit pour voir ce que l'IA peut faire sur votre propre infrastructure.
                    </p>
                    <button
                        onClick={() => onNavigate('/audit')}
                        className="inline-flex items-center gap-2 bg-emerald-500 text-black px-8 py-4 rounded-xl font-bold hover:bg-emerald-400 transition-colors shadow-[0_0_30px_rgba(16,185,129,0.3)] text-lg"
                    >
                        Demander mon audit gratuit <ArrowRight className="w-5 h-5" />
                    </button>
                </div>
            </section>
        </div>
    );
};
