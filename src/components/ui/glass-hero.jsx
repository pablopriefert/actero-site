import React, { useState, useEffect } from 'react';
import { ArrowRight, Shield, Clock, TrendingUp, ShoppingCart, Home, UserCheck, ChevronRight } from 'lucide-react';
import { FadeInUp, ScaleIn } from './scroll-animations';
import { ButtonColorful } from './button-colorful';
import { MagneticButton } from './magnetic-button';

const VERTICALS = [
    {
        id: 'ecommerce',
        badge: 'E-commerce',
        badgeIcon: <ShoppingCart className="w-3.5 h-3.5" />,
        badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        headline: (
            <>
                <span className="block">Automatisez votre SAV.</span>
                <span className="block">Récupérez chaque vente perdue.</span>
            </>
        ),
        subtitle: "Support client IA, relance des paniers abandonnés et dashboard ROI en temps réel — pour les marques Shopify qui veulent scaler sans multiplier les coûts.",
        metrics: [
            { icon: <TrendingUp className="w-5 h-5 text-emerald-400" />, value: "+15%", label: "de revenus récupérés" },
            { icon: <Clock className="w-5 h-5 text-cyan-400" />, value: "80%", label: "tickets résolus par IA" },
            { icon: <Shield className="w-5 h-5 text-amber-400" />, value: "7 jours", label: "pour être opérationnel" },
        ],
    },
    {
        id: 'immobilier',
        badge: 'Immobilier',
        badgeIcon: <Home className="w-3.5 h-3.5" />,
        badgeColor: 'text-violet-400 bg-violet-500/10 border-violet-500/20',
        headline: (
            <>
                <span className="block">Qualifiez vos leads.</span>
                <span className="block">Répondez en 2 minutes.</span>
            </>
        ),
        subtitle: "Qualification automatique des leads portails, réponse instantanée aux demandes de visite et matching acquéreur/bien — pour les agences immobilières qui veulent convertir plus sans recruter.",
        metrics: [
            { icon: <UserCheck className="w-5 h-5 text-violet-400" />, value: "3x", label: "plus de leads qualifiés" },
            { icon: <Clock className="w-5 h-5 text-cyan-400" />, value: "< 2 min", label: "temps de réponse" },
            { icon: <Shield className="w-5 h-5 text-amber-400" />, value: "0 code", label: "on gère tout pour vous" },
        ],
    },
];

export const GlassHero = ({ onNavigate }) => {
    const [activeVertical, setActiveVertical] = useState(0);
    const [isTransitioning, setIsTransitioning] = useState(false);

    // No auto-rotate — user controls the toggle manually

    const switchVertical = (idx) => {
        if (idx === activeVertical) return;
        setIsTransitioning(true);
        setTimeout(() => {
            setActiveVertical(idx);
            setIsTransitioning(false);
        }, 300);
    };

    const v = VERTICALS[activeVertical];

    return (
        <div className="relative min-h-[90vh] flex flex-col items-center justify-center pt-28 pb-20 px-6 overflow-hidden">

            {/* Background — Aurora */}
            <div className="absolute inset-0 z-0 bg-[#030303] overflow-hidden">
                <div
                    className="absolute top-[8%] left-[-10%] w-[120%] h-[35%] pointer-events-none opacity-50 transition-all duration-1000"
                    style={{
                        background: activeVertical === 0
                            ? 'linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.1) 25%, rgba(6,182,212,0.16) 50%, rgba(6,182,212,0.1) 75%, transparent 100%)'
                            : 'linear-gradient(90deg, transparent 0%, rgba(139,92,246,0.1) 25%, rgba(139,92,246,0.16) 50%, rgba(139,92,246,0.1) 75%, transparent 100%)',
                        borderRadius: '50%',
                        filter: 'blur(60px)',
                        animation: 'aurora-drift-1 12s ease-in-out infinite alternate',
                    }}
                />
                <div
                    className="absolute top-[18%] left-[-5%] w-[110%] h-[20%] pointer-events-none opacity-40 transition-all duration-1000"
                    style={{
                        background: activeVertical === 0
                            ? 'linear-gradient(90deg, transparent 5%, rgba(6,182,212,0.12) 30%, rgba(6,182,212,0.18) 50%, rgba(6,182,212,0.1) 70%, transparent 95%)'
                            : 'linear-gradient(90deg, transparent 5%, rgba(139,92,246,0.12) 30%, rgba(139,92,246,0.18) 50%, rgba(139,92,246,0.1) 70%, transparent 95%)',
                        borderRadius: '50%',
                        filter: 'blur(50px)',
                        animation: 'aurora-drift-2 15s ease-in-out infinite alternate',
                    }}
                />
                <div
                    className="absolute top-[30%] left-[5%] w-[90%] h-[15%] pointer-events-none opacity-30 transition-all duration-1000"
                    style={{
                        background: activeVertical === 0
                            ? 'linear-gradient(90deg, transparent 10%, rgba(6,182,212,0.14) 35%, rgba(6,182,212,0.1) 65%, transparent 100%)'
                            : 'linear-gradient(90deg, transparent 10%, rgba(139,92,246,0.14) 35%, rgba(139,92,246,0.1) 65%, transparent 100%)',
                        borderRadius: '50%',
                        filter: 'blur(45px)',
                        animation: 'aurora-drift-3 18s ease-in-out infinite alternate',
                    }}
                />
                <div className="absolute top-[-5%] left-1/2 -translate-x-1/2 w-[80%] h-[40%] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(6,182,212,0.06)_0%,transparent_70%)] pointer-events-none" />
                <div className="absolute inset-x-0 bottom-0 h-96 bg-gradient-to-t from-[#030303] to-transparent pointer-events-none" />
                <style>{`
                    @keyframes aurora-drift-1 {
                        0%   { transform: rotate(-3deg) translateX(-3%) translateY(0); }
                        100% { transform: rotate(-1deg) translateX(3%) translateY(-8px); }
                    }
                    @keyframes aurora-drift-2 {
                        0%   { transform: rotate(2deg) translateX(2%) translateY(0); }
                        100% { transform: rotate(0deg) translateX(-2%) translateY(10px); }
                    }
                    @keyframes aurora-drift-3 {
                        0%   { transform: rotate(-1deg) translateX(0) translateY(0); }
                        100% { transform: rotate(1deg) translateX(4%) translateY(-5px); }
                    }
                `}</style>
            </div>

            <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center">

                {/* Vertical Switcher */}
                <FadeInUp className="mb-8">
                    <div className="inline-flex items-center gap-1 bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-full p-1">
                        {VERTICALS.map((vert, idx) => (
                            <button
                                key={vert.id}
                                onClick={() => switchVertical(idx)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-300 ${
                                    activeVertical === idx
                                        ? `${vert.badgeColor} border shadow-lg`
                                        : 'text-gray-500 hover:text-gray-300'
                                }`}
                            >
                                {vert.badgeIcon}
                                {vert.badge}
                            </button>
                        ))}
                    </div>
                </FadeInUp>

                {/* Headline */}
                <FadeInUp delay={0.1} className="text-center max-w-4xl mb-8">
                    <h1 className={`text-4xl md:text-6xl lg:text-[4.5rem] font-bold tracking-tight text-white leading-[1.1] md:leading-[1.08] transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                        {v.headline}
                        <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                            Résultats mesurables. ROI en temps réel.
                        </span>
                    </h1>
                </FadeInUp>

                {/* Subtitle */}
                <FadeInUp delay={0.15} className="text-center max-w-2xl mb-10">
                    <p className={`text-lg md:text-xl text-gray-400 font-medium leading-relaxed transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                        {v.subtitle}
                    </p>
                </FadeInUp>

                {/* CTA Buttons */}
                <FadeInUp delay={0.2} className="flex flex-col sm:flex-row items-center gap-4 mb-16">
                    <ButtonColorful
                        onClick={() => onNavigate('/audit')}
                    >
                        Réserver un audit gratuit
                    </ButtonColorful>
                    <MagneticButton
                        onClick={() => {
                            const el = document.getElementById('comment-ca-marche');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="text-sm font-semibold text-gray-400 hover:text-white transition-colors flex items-center gap-2 px-6 py-3"
                    >
                        Voir comment ça marche <ArrowRight className="w-4 h-4" />
                    </MagneticButton>
                </FadeInUp>

                {/* Proof Metrics Bar */}
                <ScaleIn delay={0.3} className="w-full max-w-3xl">
                    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl px-6 py-5 md:px-10 md:py-6">
                        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0 transition-opacity duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
                            {v.metrics.map((item, i) => (
                                <div
                                    key={i}
                                    className={`flex items-center gap-4 ${i < 2 ? 'md:border-r md:border-white/[0.06]' : ''} ${i > 0 ? 'md:pl-8' : ''}`}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center flex-shrink-0">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-lg leading-tight">{item.value}</p>
                                        <p className="text-gray-500 text-sm font-medium">{item.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </ScaleIn>
            </div>
        </div>
    );
};
