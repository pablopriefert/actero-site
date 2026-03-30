import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Shield, Clock, TrendingUp, UserPlus, ShoppingBag, Building2 } from 'lucide-react';
import { FadeInUp, ScaleIn } from './scroll-animations';
import { ButtonColorful } from './button-colorful';
import { MagneticButton } from './magnetic-button';

export const GlassHero = ({ onNavigate, vertical = 'ecommerce', onVerticalChange }) => {

    const heroContent = {
        ecommerce: {
            badge: { icon: '/shopify-partners.svg', label: 'Partenaire Shopify officiel' },
            headline: (
                <>
                    <span className="block text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #9ca3af 100%)' }}>Transformez votre SAV</span>
                    <span className="block text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(180deg, #e5e7eb 0%, #6b7280 100%)' }}>en machine de croissance.</span>
                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-300">
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
            accentColor: 'emerald',
            gradientFrom: 'from-emerald-500/20',
            gradientTo: 'to-cyan-500/20',
            glowColor: 'rgba(16,185,129,0.12)',
        },
        immobilier: {
            badge: { icon: null, label: 'Spécialiste IA pour agences immobilières' },
            headline: (
                <>
                    <span className="block text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(180deg, #ffffff 0%, #c4b5fd 100%)' }}>Automatisez votre agence.</span>
                    <span className="block text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(180deg, #e9d5ff 0%, #8b5cf6 100%)' }}>Récupérez chaque prospect.</span>
                    <span className="block text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400">
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
            accentColor: 'violet',
            gradientFrom: 'from-violet-500/20',
            gradientTo: 'to-purple-500/20',
            glowColor: 'rgba(139,92,246,0.14)',
        },
    };

    const content = heroContent[vertical];
    const isEcommerce = vertical === 'ecommerce';

    // Scroll parallax
    const { scrollY } = useScroll();
    const bgY    = useTransform(scrollY, [0, 700], [0,  160]);
    const contentY = useTransform(scrollY, [0, 500], [0, -50]);
    const contentOpacity = useTransform(scrollY, [0, 380], [1, 0]);

    return (
        <div className="relative min-h-[100vh] flex flex-col items-center justify-center pt-24 pb-20 px-6 overflow-hidden">

            {/* ── Aurora wave background ── */}
            <motion.div className="absolute inset-0 z-0 bg-[#040a04] overflow-hidden" style={{ y: bgY }}>

                {/* Base dark gradient */}
                <div className="absolute inset-0" style={{
                    background: 'radial-gradient(ellipse 120% 80% at 50% 30%, #0a1a0a 0%, #040a04 50%, #020502 100%)',
                }} />

                {/* Aurora wave 1 — main green */}
                <div
                    className="aurora-wave absolute w-[200%] h-[600px] opacity-30 pointer-events-none"
                    style={{
                        top: '15%',
                        left: '-50%',
                        background: `linear-gradient(180deg, transparent 0%, ${isEcommerce ? 'rgba(16,185,129,0.15)' : 'rgba(139,92,246,0.15)'} 30%, ${isEcommerce ? 'rgba(6,182,212,0.08)' : 'rgba(168,85,247,0.08)'} 60%, transparent 100%)`,
                        borderRadius: '50%',
                        filter: 'blur(40px)',
                    }}
                />

                {/* Aurora wave 2 — golden accent */}
                <div
                    className="aurora-wave-reverse absolute w-[180%] h-[400px] opacity-20 pointer-events-none"
                    style={{
                        top: '25%',
                        left: '-40%',
                        background: `linear-gradient(180deg, transparent 0%, rgba(202,178,100,0.12) 40%, ${isEcommerce ? 'rgba(16,185,129,0.06)' : 'rgba(139,92,246,0.06)'} 70%, transparent 100%)`,
                        borderRadius: '50%',
                        filter: 'blur(50px)',
                    }}
                />

                {/* Aurora wave 3 — subtle lower wave */}
                <div
                    className="aurora-wave absolute w-[160%] h-[350px] opacity-15 pointer-events-none"
                    style={{
                        top: '45%',
                        left: '-30%',
                        background: `linear-gradient(180deg, transparent 0%, ${isEcommerce ? 'rgba(52,211,153,0.1)' : 'rgba(167,139,250,0.1)'} 50%, transparent 100%)`,
                        borderRadius: '50%',
                        filter: 'blur(60px)',
                        animationDuration: '18s',
                    }}
                />

                {/* Top glow */}
                <div
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] pointer-events-none transition-all duration-700"
                    style={{
                        background: `radial-gradient(ellipse at center, ${content.glowColor} 0%, transparent 70%)`,
                        filter: 'blur(80px)',
                    }}
                />

                {/* Bottom fade */}
                <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#040a04] to-transparent pointer-events-none" />
            </motion.div>

            {/* ── Content (with scroll parallax) ── */}
            <motion.div
                className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center"
                style={{ y: contentY, opacity: contentOpacity }}
            >

                {/* ── Vertical Toggle — very prominent ── */}
                <FadeInUp className="mb-10">
                    <div className="relative inline-flex items-center bg-white/[0.06] backdrop-blur-xl border border-white/[0.10] rounded-2xl p-1.5 gap-1.5 shadow-2xl">
                        {/* Sliding indicator */}
                        <div
                            className={`absolute top-1.5 bottom-1.5 rounded-xl transition-all duration-300 ease-out ${
                                isEcommerce
                                    ? 'left-1.5 right-[calc(50%+0.375rem)]'
                                    : 'left-[calc(50%+0.375rem)] right-1.5'
                            } ${isEcommerce ? 'bg-emerald-500/15 border border-emerald-500/30' : 'bg-violet-500/15 border border-violet-500/30'}`}
                        />
                        {[
                            { key: 'ecommerce', label: 'E-commerce', icon: <ShoppingBag className="w-4 h-4" /> },
                            { key: 'immobilier', label: 'Immobilier', icon: <Building2 className="w-4 h-4" /> },
                        ].map((v) => (
                            <button
                                key={v.key}
                                onClick={() => onVerticalChange?.(v.key)}
                                className={`relative z-10 flex items-center gap-2.5 px-7 py-3 rounded-xl text-sm font-semibold tracking-wide transition-all duration-300 ${
                                    vertical === v.key
                                        ? v.key === 'ecommerce'
                                            ? 'text-emerald-300'
                                            : 'text-violet-300'
                                        : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                <span className={`transition-all duration-300 ${vertical === v.key ? (v.key === 'ecommerce' ? 'text-emerald-400' : 'text-violet-400') : 'text-zinc-600'}`}>
                                    {v.icon}
                                </span>
                                {v.label}
                            </button>
                        ))}
                    </div>
                </FadeInUp>

                {/* Made in France */}
                <FadeInUp className="mb-3">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.04]">
                    <span>🇫🇷</span>
                    <span>Made in France</span>
                  </div>
                </FadeInUp>

                {/* Trust Badge */}
                <FadeInUp className="mb-10">
                    <div className={`inline-flex items-center gap-3 backdrop-blur-md border px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-500 ${
                        isEcommerce
                            ? 'bg-emerald-500/[0.08] border-emerald-500/20 text-emerald-300'
                            : 'bg-violet-500/[0.08] border-violet-500/20 text-violet-300'
                    }`}>
                        {content.badge.icon && (
                            <>
                                <img src={content.badge.icon} alt="" className="h-4 w-auto brightness-0 invert opacity-80" />
                                <span className="w-px h-4 bg-white/15"></span>
                            </>
                        )}
                        <span>{content.badge.label}</span>
                    </div>
                </FadeInUp>

                {/* ── Headline ── */}
                <FadeInUp delay={0.1} className="text-center max-w-4xl mb-8">
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-extrabold text-white leading-[1.08] md:leading-[1.05]" style={{ letterSpacing: '-0.03em' }}>
                        {content.headline}
                    </h1>
                </FadeInUp>

                {/* Subtitle */}
                <FadeInUp delay={0.15} className="text-center max-w-2xl mb-10">
                    <p className="text-base md:text-lg text-zinc-400 font-normal leading-relaxed">
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
                        className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors flex items-center gap-2 px-6 py-3 border border-white/[0.10] rounded-xl hover:border-white/[0.20] bg-white/[0.04] hover:bg-white/[0.06]"
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

                {/* ── Proof Metrics Bar ── */}
                <ScaleIn delay={0.3} className="w-full max-w-3xl">
                    <div className="border rounded-2xl px-6 py-5 md:px-10 md:py-6 bg-white/[0.03] border-white/[0.08] backdrop-blur-xl">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0">
                            {content.metrics.map((item, i) => (
                                <div
                                    key={i}
                                    className={`flex items-center gap-4 ${i < 2 ? 'md:border-r md:border-white/[0.08]' : ''} ${i > 0 ? 'md:pl-8' : ''}`}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.08] flex items-center justify-center flex-shrink-0">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-xl leading-tight tracking-tight">{item.value}</p>
                                        <p className="text-zinc-500 text-sm font-medium">{item.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </ScaleIn>
            </motion.div>
        </div>
    );
};
