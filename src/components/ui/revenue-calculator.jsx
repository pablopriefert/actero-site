import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Calculator, AlertTriangle, TrendingUp, Euro } from 'lucide-react';
import { FadeInUp } from './scroll-animations';

export const RevenueCalculator = () => {
    const [monthlyRevenue, setMonthlyRevenue] = useState(50000);
    const [dailyTickets, setDailyTickets] = useState(50);

    // Derived values (pure computation, no side effects)
    const { lostRevenue, recoverableRevenue } = useMemo(() => {
        // Assume 15 min per ticket = 0.25h
        // Average human cost per hour = 25€ (including charges)
        const dailyCostSupport = dailyTickets * 0.25 * 25;
        const monthlyCostSupport = dailyCostSupport * 30;

        // E-commerce conversion loss due to abandoned carts not called/followed up
        // Assume 5% of monthly revenue is lost without advanced automation
        const missedConversionOpportunity = monthlyRevenue * 0.05;

        // Total calculated leak
        const totalLeak = monthlyCostSupport + missedConversionOpportunity;

        // Actero AI recovers roughly 70% of support costs and 80% of missed conversions
        const recovered = (monthlyCostSupport * 0.7) + (missedConversionOpportunity * 0.8);

        return { lostRevenue: totalLeak, recoverableRevenue: recovered };
    }, [monthlyRevenue, dailyTickets]);

    // Format numbers
    const formatCurrency = (val) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

    return (
        <section className="py-24 relative overflow-hidden bg-transparent border-t border-white/5 z-10 w-full">
            {/* Background glowing effects */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl h-96 bg-red-500/5 rounded-full blur-[120px] pointer-events-none"></div>

            <div className="max-w-5xl mx-auto px-6 relative z-10">
                <FadeInUp className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-sm font-bold text-red-400 mb-6">
                        <AlertTriangle className="w-4 h-4" /> Fuite de Marges
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
                        Combien vous coûte l'absence d'IA ?
                    </h2>
                    <p className="text-lg text-gray-400 font-medium max-w-2xl mx-auto">
                        Ajustez les curseurs pour voir l'impact financier invisible de vos goulots d'étranglement actuels (support humain, relances manquées).
                    </p>
                </FadeInUp>

                <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center">

                    {/* Controls */}
                    <FadeInUp delay={0.1}>
                        <div className="bg-[#0E1424] border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity"></div>

                            {/* Slider 1: Revenue */}
                            <div className="mb-10 relative z-10">
                                <div className="flex justify-between items-end mb-4">
                                    <label className="text-sm font-bold text-gray-300 uppercase tracking-widest">
                                        CA Mensuel Estimé
                                    </label>
                                    <span className="text-2xl font-black text-white">{formatCurrency(monthlyRevenue)}</span>
                                </div>
                                <input
                                    type="range"
                                    min="10000"
                                    max="1000000"
                                    step="5000"
                                    value={monthlyRevenue}
                                    onChange={(e) => setMonthlyRevenue(Number(e.target.value))}
                                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white hover:accent-emerald-400 transition-colors"
                                />
                                <div className="flex justify-between text-xs text-gray-500 font-medium mt-2">
                                    <span>10k€</span>
                                    <span>1M€+</span>
                                </div>
                            </div>

                            {/* Slider 2: Tickets */}
                            <div className="relative z-10">
                                <div className="flex justify-between items-end mb-4">
                                    <label className="text-sm font-bold text-gray-300 uppercase tracking-widest">
                                        Tickets SAV / Jour
                                    </label>
                                    <span className="text-2xl font-black text-white">{dailyTickets} <span className="text-base text-gray-500 font-medium">tickets</span></span>
                                </div>
                                <input
                                    type="range"
                                    min="5"
                                    max="1000"
                                    step="5"
                                    value={dailyTickets}
                                    onChange={(e) => setDailyTickets(Number(e.target.value))}
                                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-white hover:accent-emerald-400 transition-colors"
                                />
                                <div className="flex justify-between text-xs text-gray-500 font-medium mt-2">
                                    <span>5</span>
                                    <span>1000+</span>
                                </div>
                            </div>
                        </div>
                    </FadeInUp>

                    {/* Results Display */}
                    <FadeInUp delay={0.2}>
                        <div className="flex flex-col gap-6">
                            {/* Lost Revenue Card */}
                            <div className="bg-red-500/5 border border-red-500/20 rounded-3xl p-8 relative overflow-hidden">
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                                        <Euro className="w-4 h-4 text-red-500" />
                                    </div>
                                    <h3 className="text-sm font-bold text-red-400 uppercase tracking-widest">
                                        Perte Estimée par Mois
                                    </h3>
                                </div>
                                <div className="mt-4">
                                    <motion.div
                                        key={lostRevenue}
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="text-5xl lg:text-6xl font-black text-white tracking-tighter"
                                        style={{ fontVariantNumeric: 'tabular-nums' }}
                                    >
                                        -{formatCurrency(lostRevenue)}
                                    </motion.div>
                                    <p className="text-gray-400 mt-2 text-sm font-medium">
                                        Coût humain du support + conversions manquées
                                    </p>
                                </div>
                            </div>

                            {/* Recoverable Card */}
                            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-3xl p-8 relative overflow-hidden shadow-[0_0_40px_rgba(16,185,129,0.1)]">
                                <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/20 rounded-full blur-3xl"></div>
                                <div className="flex items-center gap-3 mb-2 relative z-10">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                                    </div>
                                    <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-widest">
                                        Récupérable avec Actero
                                    </h3>
                                </div>
                                <div className="mt-4 relative z-10">
                                    <motion.div
                                        key={recoverableRevenue}
                                        initial={{ scale: 0.9, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        className="text-5xl lg:text-6xl font-black text-emerald-400 tracking-tighter flex items-center gap-2"
                                        style={{ fontVariantNumeric: 'tabular-nums' }}
                                    >
                                        +{formatCurrency(recoverableRevenue)}
                                    </motion.div>
                                    <p className="text-emerald-500/80 mt-2 text-sm font-medium">
                                        Objectif: Retour sur investissement dès le 1er mois.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </FadeInUp>
                </div>
            </div>
        </section>
    );
};
