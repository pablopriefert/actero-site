import React from 'react';
import { ArrowRight, Headphones, RefreshCw, BarChart3, Zap } from 'lucide-react';
import { FadeInUp } from './scroll-animations';
import { ButtonColorful } from './button-colorful';

export const GlassHero = ({ onNavigate }) => {

    const content = {
        badge: { icon: '/elevenlabs-grants.webp', label: 'Powered by ElevenLabs Grants' },
        headlineMain: "60% de vos tickets Shopify",
        headlineSub: "résolus automatiquement",
        subtitle: "Actero automatise le support client et relance vos paniers abandonnés pour les marques Shopify qui veulent scaler sans multiplier les coûts.",
        subtitleBold: "Commencez gratuitement, sans carte bancaire.",
        cards: [
            { title: "Support IA 24/7", desc: "80% des tickets résolus sans humain", bg: "bg-[#003725]", text: "text-white", descText: "text-white/60", icon: <Headphones className="w-7 h-7" />, iconBg: "bg-white/15", gradient: "bg-gradient-to-br from-[#003725] to-cta" },
            { title: "Relance paniers", desc: "+15% de taux de récupération", bg: "bg-[#F9F7F1]", text: "text-[#003725]", descText: "text-[#716D5C]", icon: <RefreshCw className="w-7 h-7" />, iconBg: "bg-[#003725]/10", gradient: "bg-gradient-to-br from-[#F9F7F1] to-[#EDE9E0]" },
            { title: "Monitoring IA", desc: "Alertes en temps réel sur vos KPIs", bg: "bg-[#F9F7F1]", text: "text-[#003725]", descText: "text-[#716D5C]", icon: <BarChart3 className="w-7 h-7" />, iconBg: "bg-[#003725]/10", gradient: "bg-gradient-to-br from-[#F0EDE6] to-[#F9F7F1]" },
            { title: "Automatisations", desc: "Shopify, CRM, support connectés", bg: "bg-[#003725]", text: "text-white", descText: "text-white/60", icon: <Zap className="w-7 h-7" />, iconBg: "bg-white/15", gradient: "bg-gradient-to-br from-cta to-[#003725]" },
        ],
    };

    return (
        <div className="relative bg-white pt-28 md:pt-36 pb-0 px-6">
            <div className="max-w-6xl mx-auto">

                {/* Hero text — centered like Shine hero */}
                <div className="max-w-3xl mx-auto text-center mb-12">
                    {/* Badge */}
                    <FadeInUp className="mb-6">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium text-[#716D5C]">
                            <span>Powered by</span>
                            <img src="/elevenlabs-grants.webp" alt="ElevenLabs Grants" className="h-3.5 w-auto" />
                        </div>
                    </FadeInUp>

                    {/* Headline — Instrument Serif (400 weight, like Shine Spectra) */}
                    <FadeInUp delay={0.05} className="mb-6">
                        <h1 className="text-4xl md:text-6xl lg:text-7xl font-normal leading-[1.1]" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
                            <span className="text-[#262626]">{content.headlineMain}</span>
                            <br />
                            <span className="text-[#716D5C]">{content.headlineSub}</span>
                        </h1>
                    </FadeInUp>

                    {/* Subtitle */}
                    <FadeInUp delay={0.1} className="mb-3">
                        <p className="text-base md:text-lg text-[#716D5C] font-normal leading-relaxed max-w-xl mx-auto">
                            {content.subtitle}
                        </p>
                    </FadeInUp>
                    <FadeInUp delay={0.12} className="mb-8">
                        <p className="text-base md:text-lg text-[#262626] font-medium">
                            {content.subtitleBold}
                        </p>
                    </FadeInUp>

                    {/* CTAs */}
                    <FadeInUp delay={0.15} className="flex flex-col items-center gap-3">
                        <div className="flex flex-wrap items-center justify-center gap-4">
                            <ButtonColorful onClick={() => onNavigate('/signup')}>
                                Essai gratuit 7 jours <ArrowRight className="w-4 h-4" />
                            </ButtonColorful>
                            <button
                                onClick={() => onNavigate('/tarifs')}
                                className="text-sm font-semibold text-[#003725] underline underline-offset-4 decoration-[#003725]/40 hover:decoration-[#003725] transition-colors"
                            >
                                Voir les tarifs
                            </button>
                        </div>
                        <p className="text-xs text-[#716D5C] font-medium">
                            Créez votre compte en 30 secondes
                        </p>
                    </FadeInUp>

                </div>

                {/* Feature cards — 4-column grid BELOW the CTA (Shine style) */}
                <FadeInUp delay={0.25} className="pb-16">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {content.cards.map((card, i) => (
                            <div
                                key={i}
                                className={`${card.gradient} ${card.text} rounded-3xl p-6 md:p-7 flex flex-col justify-between min-h-[220px] md:min-h-[280px] relative overflow-hidden group transition-transform hover:scale-[1.02] duration-300`}
                            >
                                {/* Decorative circle (3D-like depth) */}
                                <div className={`absolute -bottom-8 -right-8 w-32 h-32 rounded-full opacity-10 ${
                                    card.bg === 'bg-[#003725]' ? 'bg-white' : 'bg-[#003725]'
                                }`} />
                                <div className={`absolute top-1/2 right-4 w-20 h-20 rounded-full opacity-5 ${
                                    card.bg === 'bg-[#003725]' ? 'bg-white' : 'bg-[#003725]'
                                }`} />

                                {/* Icon */}
                                <div className={`w-12 h-12 rounded-2xl ${card.iconBg} flex items-center justify-center mb-auto`}>
                                    {card.icon}
                                </div>

                                {/* Text */}
                                <div className="relative z-10">
                                    <p className="font-bold text-lg md:text-xl leading-tight mb-1">{card.title}</p>
                                    <p className={`text-sm font-medium ${card.descText}`}>{card.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </FadeInUp>
            </div>
        </div>
    );
};
