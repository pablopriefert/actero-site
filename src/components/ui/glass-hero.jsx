import React from 'react';
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
                    <span className="block text-gray-900">Transformez votre SAV</span>
                    <span className="block text-gray-500">en machine de croissance.</span>
                    <span className="block text-[#1B7D3A]">
                        Récupérez chaque euro perdu.
                    </span>
                </>
            ),
            subtitle: "Actero automatise le support client et relance vos paniers abandonnés pour les marques Shopify qui veulent scaler sans multiplier les coûts. Résultats mesurables dès le premier mois.",
            metrics: [
                { icon: <TrendingUp className="w-5 h-5 text-[#1B7D3A]" />, value: "+15%", label: "de revenus récupérés en moyenne" },
                { icon: <Clock className="w-5 h-5 text-gray-500" />, value: "7 jours", label: "pour être opérationnel" },
                { icon: <Shield className="w-5 h-5 text-gray-500" />, value: "0 code", label: "on gère tout pour vous" },
            ],
        },
        immobilier: {
            badge: { icon: null, label: 'Spécialiste IA pour agences immobilières' },
            headline: (
                <>
                    <span className="block text-gray-900">Automatisez votre agence.</span>
                    <span className="block text-gray-500">Récupérez chaque prospect.</span>
                    <span className="block text-[#1B7D3A]">
                        3 agents IA à votre service.
                    </span>
                </>
            ),
            subtitle: "Prise de rendez-vous, collecte de documents, relance des prospects inactifs — nos agents IA gèrent vos tâches chronophages 24h/24 pour que vous vous concentriez sur la vente.",
            metrics: [
                { icon: <TrendingUp className="w-5 h-5 text-[#1B7D3A]" />, value: "+30%", label: "de rendez-vous confirmés" },
                { icon: <Clock className="w-5 h-5 text-gray-500" />, value: "-50%", label: "de temps administratif" },
                { icon: <Shield className="w-5 h-5 text-gray-500" />, value: "+10%", label: "de prospects récupérés" },
            ],
        },
    };

    const content = heroContent[vertical];
    const isEcommerce = vertical === 'ecommerce';

    return (
        <div className="relative min-h-[100vh] flex flex-col items-center justify-center pt-24 pb-20 px-6 bg-white">

            {/* ── Content ── */}
            <div
                className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center"
            >

                {/* ── Vertical Toggle ── */}
                <FadeInUp className="mb-10">
                    <div className="relative inline-flex items-center bg-gray-100 rounded-2xl p-1.5 gap-1.5">
                        {/* Sliding indicator */}
                        <div
                            className={`absolute top-1.5 bottom-1.5 rounded-xl transition-all duration-300 ease-out bg-white shadow-sm ${
                                isEcommerce
                                    ? 'left-1.5 right-[calc(50%+0.375rem)]'
                                    : 'left-[calc(50%+0.375rem)] right-1.5'
                            }`}
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
                                        ? 'text-gray-900'
                                        : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                <span className={`transition-all duration-300 ${vertical === v.key ? 'text-gray-900' : 'text-gray-400'}`}>
                                    {v.icon}
                                </span>
                                {v.label}
                            </button>
                        ))}
                    </div>
                </FadeInUp>

                {/* Made in France */}
                <FadeInUp className="mb-3">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 px-3 py-1.5 rounded-full border border-gray-200 bg-gray-50">
                    <span>🇫🇷</span>
                    <span>Made in France</span>
                  </div>
                </FadeInUp>

                {/* Trust Badge */}
                <FadeInUp className="mb-10">
                    <div className="inline-flex items-center gap-3 border px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-500 bg-gray-50 border-gray-200 text-gray-600">
                        {content.badge.icon && (
                            <>
                                <img src={content.badge.icon} alt="" className="h-4 w-auto opacity-60" />
                                <span className="w-px h-4 bg-gray-200"></span>
                            </>
                        )}
                        <span>{content.badge.label}</span>
                    </div>
                </FadeInUp>

                {/* ── Headline ── */}
                <FadeInUp delay={0.1} className="text-center max-w-4xl mb-8">
                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold text-gray-900 leading-[1.08] md:leading-[1.05]" style={{ letterSpacing: '-0.03em' }}>
                        {content.headline}
                    </h1>
                </FadeInUp>

                {/* Subtitle */}
                <FadeInUp delay={0.15} className="text-center max-w-2xl mb-10">
                    <p className="text-base md:text-lg text-gray-600 font-normal leading-relaxed">
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
                        className="text-sm font-semibold text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-2 px-6 py-3 underline underline-offset-4 decoration-gray-300 hover:decoration-gray-500"
                    >
                        Voir comment ça marche <ArrowRight className="w-4 h-4" />
                    </MagneticButton>
                </FadeInUp>

                {/* Ambassador CTA */}
                <FadeInUp delay={0.25} className="mb-16">
                    <button
                        onClick={() => onNavigate('/ambassadeurs')}
                        className="text-sm font-medium text-gray-500 hover:text-[#1B7D3A] transition-colors flex items-center gap-2 px-4 py-2 underline underline-offset-4 decoration-gray-300 hover:decoration-[#1B7D3A]"
                    >
                        <UserPlus className="w-3.5 h-3.5" />
                        Devenir ambassadeur Actero
                    </button>
                </FadeInUp>

                {/* ── Proof Metrics Bar ── */}
                <ScaleIn delay={0.3} className="w-full max-w-3xl">
                    <div className="border rounded-3xl px-6 py-5 md:px-10 md:py-6 bg-white border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-0">
                            {content.metrics.map((item, i) => (
                                <div
                                    key={i}
                                    className={`flex items-center gap-4 ${i < 2 ? 'md:border-r md:border-gray-200' : ''} ${i > 0 ? 'md:pl-8' : ''}`}
                                >
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                                        {item.icon}
                                    </div>
                                    <div>
                                        <p className="text-gray-900 font-bold text-xl leading-tight tracking-tight">{item.value}</p>
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
