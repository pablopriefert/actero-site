import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Shield, Clock, TrendingUp, UserPlus, ShoppingBag, Building2 } from 'lucide-react';
import { FadeInUp, ScaleIn } from './scroll-animations';
import { ButtonColorful } from './button-colorful';
import { MagneticButton } from './magnetic-button';

const ORBS = [
  { left: '8%',  top: '18%', size: 260, dur: 9,  delay: 0,   y: 28 },
  { left: '88%', top: '12%', size: 200, dur: 13, delay: 2.5, y: 20 },
  { left: '14%', top: '68%', size: 180, dur: 11, delay: 1,   y: 32 },
  { left: '82%', top: '62%', size: 300, dur: 10, delay: 3,   y: 18 },
  { left: '50%', top: '88%', size: 220, dur: 8,  delay: 0.8, y: 22 },
  { left: '38%', top: '30%', size: 140, dur: 14, delay: 4,   y: 26 },
];

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

    const orbColor = isEcommerce ? 'rgba(16,185,129,' : 'rgba(139,92,246,';

    return (
        <div className="relative min-h-[100vh] flex flex-col items-center justify-center pt-24 pb-20 px-6 overflow-hidden">

            {/* ── Geometric grid background ── */}
            <motion.div className="absolute inset-0 z-0 bg-[#030303] overflow-hidden" style={{ y: bgY }}>
                {/* Fine grid lines */}
                <svg
                    className="absolute inset-0 w-full h-full opacity-[0.04]"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <defs>
                        <pattern id="hero-grid" width="60" height="60" patternUnits="userSpaceOnUse">
                            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="white" strokeWidth="0.5" />
                        </pattern>
                        <pattern id="hero-grid-large" width="180" height="180" patternUnits="userSpaceOnUse">
                            <path d="M 180 0 L 0 0 0 180" fill="none" stroke="white" strokeWidth="1" />
                        </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#hero-grid)" />
                    <rect width="100%" height="100%" fill="url(#hero-grid-large)" />
                </svg>

                {/* Central radial fade — makes center readable */}
                <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                        background: 'radial-gradient(ellipse 80% 70% at 50% 40%, rgba(3,3,3,0.95) 0%, rgba(3,3,3,0.7) 50%, transparent 100%)',
                    }}
                />

                {/* Accent glow — changes with vertical */}
                <div
                    className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none transition-all duration-700"
                    style={{
                        background: `radial-gradient(ellipse at center, ${content.glowColor} 0%, transparent 70%)`,
                        filter: 'blur(60px)',
                    }}
                />

                {/* Corner accent lines (decorative) */}
                <svg className="absolute top-0 left-0 w-64 h-64 opacity-[0.06]" viewBox="0 0 256 256">
                    <line x1="0" y1="0" x2="256" y2="0" stroke="white" strokeWidth="1" />
                    <line x1="0" y1="0" x2="0" y2="256" stroke="white" strokeWidth="1" />
                    <line x1="40" y1="0" x2="40" y2="40" stroke="white" strokeWidth="0.5" />
                    <line x1="80" y1="0" x2="80" y2="40" stroke="white" strokeWidth="0.5" />
                    <line x1="0" y1="40" x2="40" y2="40" stroke="white" strokeWidth="0.5" />
                    <line x1="0" y1="80" x2="40" y2="80" stroke="white" strokeWidth="0.5" />
                </svg>
                <svg className="absolute top-0 right-0 w-64 h-64 opacity-[0.06]" viewBox="0 0 256 256">
                    <line x1="256" y1="0" x2="0" y2="0" stroke="white" strokeWidth="1" />
                    <line x1="256" y1="0" x2="256" y2="256" stroke="white" strokeWidth="1" />
                    <line x1="216" y1="0" x2="216" y2="40" stroke="white" strokeWidth="0.5" />
                    <line x1="176" y1="0" x2="176" y2="40" stroke="white" strokeWidth="0.5" />
                    <line x1="256" y1="40" x2="216" y2="40" stroke="white" strokeWidth="0.5" />
                    <line x1="256" y1="80" x2="216" y2="80" stroke="white" strokeWidth="0.5" />
                </svg>

                {/* Bottom fade */}
                <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#030303] to-transparent pointer-events-none" />
            </motion.div>

            {/* ── Floating orbs (outside scrolling bg, fixed in hero) ── */}
            {ORBS.map((orb, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full pointer-events-none"
                    style={{
                        left: orb.left,
                        top: orb.top,
                        width: orb.size,
                        height: orb.size,
                        x: '-50%',
                        y: '-50%',
                        background: `radial-gradient(circle at 38% 38%, ${orbColor}0.18) 0%, transparent 70%)`,
                        filter: 'blur(48px)',
                    }}
                    animate={{ y: [0, -orb.y, 0], x: [0, orb.y * 0.35, 0] }}
                    transition={{ duration: orb.dur, delay: orb.delay, repeat: Infinity, ease: 'easeInOut' }}
                />
            ))}

            {/* ── 3D rotating ring ── */}
            <div
                className="absolute pointer-events-none z-0"
                style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', perspective: '800px' }}
            >
                <motion.div
                    className="rounded-full border"
                    style={{
                        width: 560,
                        height: 560,
                        borderColor: isEcommerce ? 'rgba(16,185,129,0.08)' : 'rgba(139,92,246,0.08)',
                        rotateX: 70,
                    }}
                    animate={{ rotateZ: 360 }}
                    transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}
                />
            </div>
            <div
                className="absolute pointer-events-none z-0"
                style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)', perspective: '800px' }}
            >
                <motion.div
                    className="rounded-full border"
                    style={{
                        width: 340,
                        height: 340,
                        borderColor: isEcommerce ? 'rgba(6,182,212,0.06)' : 'rgba(168,85,247,0.06)',
                        rotateX: 65,
                    }}
                    animate={{ rotateZ: -360 }}
                    transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                />
            </div>

            {/* ── Content (with scroll parallax) ── */}
            <motion.div
                className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center"
                style={{ y: contentY, opacity: contentOpacity }}
            >

                {/* ── Vertical Toggle — very prominent ── */}
                <FadeInUp className="mb-10">
                    <div className="relative inline-flex items-center bg-white/[0.08] backdrop-blur-xl border border-white/[0.15] rounded-2xl p-1.5 gap-1.5 shadow-2xl">
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
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-400 px-3 py-1.5 rounded-full border border-white/[0.12] bg-white/[0.06]">
                    <span>🇫🇷</span>
                    <span>Made in France</span>
                  </div>
                </FadeInUp>

                {/* Trust Badge */}
                <FadeInUp className="mb-10">
                    <div className={`inline-flex items-center gap-3 backdrop-blur-md border px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-500 ${
                        isEcommerce
                            ? 'bg-emerald-500/[0.10] border-emerald-500/30 text-emerald-300'
                            : 'bg-violet-500/[0.10] border-violet-500/30 text-violet-300'
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
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-[1.12] md:leading-[1.1]" style={{ letterSpacing: '-0.02em' }}>
                        {content.headline}
                    </h1>
                </FadeInUp>

                {/* Subtitle */}
                <FadeInUp delay={0.15} className="text-center max-w-2xl mb-10">
                    <p className="text-base md:text-lg text-zinc-300 font-medium leading-relaxed">
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
                        className="text-sm font-semibold text-zinc-400 hover:text-white transition-colors flex items-center gap-2 px-6 py-3"
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
                    <div className="border rounded-2xl px-6 py-5 md:px-10 md:py-6 bg-white/[0.05] border-white/[0.12] backdrop-blur-xl">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0">
                            {content.metrics.map((item, i) => (
                                <div
                                    key={i}
                                    className={`flex items-center gap-4 ${i < 2 ? 'md:border-r md:border-white/[0.10]' : ''} ${i > 0 ? 'md:pl-8' : ''}`}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center flex-shrink-0">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <p className="text-white font-bold text-xl leading-tight tracking-tight">{item.value}</p>
                                        <p className="text-zinc-400 text-sm font-medium">{item.label}</p>
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
