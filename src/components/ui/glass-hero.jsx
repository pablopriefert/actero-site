import React from 'react';
import { ArrowRight, Shield, Clock, TrendingUp, UserPlus } from 'lucide-react';
import { FadeInUp, ScaleIn } from './scroll-animations';
import { ButtonColorful } from './button-colorful';
import { MagneticButton } from './magnetic-button';

export const GlassHero = ({ onNavigate, vertical = 'ecommerce', onVerticalChange }) => {

    const heroContent = {
        ecommerce: {
            badge: { icon: '/shopify-partners.svg', label: 'Partenaire Shopify officiel' },
            headline: (
                <>
                    <span className="block">Transformez votre SAV</span>
                    <span className="block">en machine de croissance.</span>
                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                        Récupérez chaque euro perdu.
                    </span>
                </>
            ),
            subtitle: "Actero automatise le support client et relance vos paniers abandonnés pour les marques Shopify qui veulent scaler sans multiplier les coûts. Résultats mesurables dès le premier mois.",
            metrics: [
                { icon: <TrendingUp className="w-5 h-5 text-emerald-400" />, value: "+15%", label: "de revenus récupérés en moyenne" },
                { icon: <Clock className="w-5 h-5 text-cyan-400" />, value: "7 jours", label: "pour être opérationnel" },
                { icon: <Shield className="w-5 h-5 text-amber-400" />, value: "0 code", label: "on gère tout pour vous" },
            ],
        },
        immobilier: {
            badge: { icon: null, label: 'Spécialiste IA pour agences immobilières' },
            headline: (
                <>
                    <span className="block">Automatisez votre agence.</span>
                    <span className="block">Récupérez chaque prospect.</span>
                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-purple-400">
                        3 agents IA à votre service.
                    </span>
                </>
            ),
            subtitle: "Prise de rendez-vous, collecte de documents, relance des prospects inactifs — nos agents IA gèrent vos tâches chronophages 24h/24 pour que vous vous concentriez sur la vente.",
            metrics: [
                { icon: <TrendingUp className="w-5 h-5 text-violet-400" />, value: "+30%", label: "de rendez-vous confirmés" },
                { icon: <Clock className="w-5 h-5 text-purple-400" />, value: "-50%", label: "de temps administratif" },
                { icon: <Shield className="w-5 h-5 text-fuchsia-400" />, value: "+10%", label: "de prospects récupérés" },
            ],
        },
    };

    const content = heroContent[vertical];

    return (
        <div className="relative min-h-[90vh] flex flex-col items-center justify-center pt-28 pb-20 px-6 overflow-hidden">

            {/* Background — Cyan Aurora */}
            <div className="absolute inset-0 z-0 bg-[#030303] overflow-hidden">
                <div
                    className="absolute top-[8%] left-[-10%] w-[120%] h-[35%] pointer-events-none opacity-50"
                    style={{
                        background: 'linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.1) 25%, rgba(6,182,212,0.16) 50%, rgba(6,182,212,0.1) 75%, transparent 100%)',
                        borderRadius: '50%',
                        filter: 'blur(60px)',
                        transform: 'rotate(-3deg)',
                        animation: 'aurora-drift-1 12s ease-in-out infinite alternate',
                    }}
                />
                <div
                    className="absolute top-[18%] left-[-5%] w-[110%] h-[20%] pointer-events-none opacity-40"
                    style={{
                        background: 'linear-gradient(90deg, transparent 5%, rgba(6,182,212,0.12) 30%, rgba(6,182,212,0.18) 50%, rgba(6,182,212,0.1) 70%, transparent 95%)',
                        borderRadius: '50%',
                        filter: 'blur(50px)',
                        transform: 'rotate(2deg)',
                        animation: 'aurora-drift-2 15s ease-in-out infinite alternate',
                    }}
                />
                <div
                    className="absolute top-[30%] left-[5%] w-[90%] h-[15%] pointer-events-none opacity-30"
                    style={{
                        background: 'linear-gradient(90deg, transparent 10%, rgba(6,182,212,0.14) 35%, rgba(6,182,212,0.1) 65%, transparent 100%)',
                        borderRadius: '50%',
                        filter: 'blur(45px)',
                        transform: 'rotate(-1deg)',
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

                {/* Vertical Toggle */}
                <FadeInUp className="mb-6">
                    <div className="inline-flex items-center bg-white/[0.04] backdrop-blur-md border border-white/10 rounded-full p-1">
                        {[
                            { key: 'ecommerce', label: 'E-commerce' },
                            { key: 'immobilier', label: 'Immobilier' },
                        ].map((v) => (
                            <button
                                key={v.key}
                                onClick={() => onVerticalChange?.(v.key)}
                                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                                    vertical === v.key
                                        ? 'bg-white text-black shadow-lg'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                            >
                                {v.label}
                            </button>
                        ))}
                    </div>
                </FadeInUp>

                {/* Trust Badge */}
                <FadeInUp className="mb-8">
                    <div className="inline-flex items-center gap-3 bg-white/[0.06] backdrop-blur-md border border-white/10 text-gray-300 px-5 py-2.5 rounded-full text-sm font-medium">
                        {content.badge.icon && (
                            <>
                                <div className="flex items-center gap-1.5">
                                    <img src={content.badge.icon} alt="" className="h-4 w-auto brightness-0 invert opacity-70" />
                                </div>
                                <span className="w-px h-4 bg-white/10"></span>
                            </>
                        )}
                        <span>{content.badge.label}</span>
                    </div>
                </FadeInUp>

                {/* Headline */}
                <FadeInUp delay={0.1} className="text-center max-w-4xl mb-8">
                    <h1 className="text-4xl md:text-6xl lg:text-[4.5rem] font-bold tracking-tight text-white leading-[1.1] md:leading-[1.08]">
                        {content.headline}
                    </h1>
                </FadeInUp>

                {/* Subtitle */}
                <FadeInUp delay={0.15} className="text-center max-w-2xl mb-10">
                    <p className="text-lg md:text-xl text-gray-400 font-medium leading-relaxed">
                        {content.subtitle}
                    </p>
                </FadeInUp>

                {/* CTA Buttons */}
                <FadeInUp delay={0.2} className="flex flex-col sm:flex-row items-center gap-4 mb-6">
                    <ButtonColorful
                        onClick={() => onNavigate('/audit')}
                    >
                        {vertical === 'immobilier' ? 'Demander une démo' : 'Réserver un audit gratuit'}
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

                {/* Ambassador CTA */}
                <FadeInUp delay={0.25} className="mb-16">
                    <button
                        onClick={() => onNavigate('/ambassadeurs')}
                        className="text-sm font-medium text-emerald-400/70 hover:text-emerald-400 transition-colors flex items-center gap-2 px-4 py-2 rounded-full border border-emerald-500/10 hover:border-emerald-500/30 bg-emerald-500/[0.03] hover:bg-emerald-500/[0.06]"
                    >
                        <UserPlus className="w-3.5 h-3.5" />
                        Devenir ambassadeur Actero
                    </button>
                </FadeInUp>

                {/* Proof Metrics Bar */}
                <ScaleIn delay={0.3} className="w-full max-w-3xl">
                    <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl px-6 py-5 md:px-10 md:py-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0">
                            {content.metrics.map((item, i) => (
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
