import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Layers, Zap, GripVertical } from 'lucide-react';
import { FadeInUp } from './scroll-animations';

export const BeforeAfterSlider = () => {
    const [sliderPos, setSliderPos] = useState(50);
    const containerRef = useRef(null);

    const handleDrag = (e) => {
        if (!containerRef.current) return;

        let clientX = e.clientX;
        // Support touch events
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
        }

        const rect = containerRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const percent = (x / rect.width) * 100;
        setSliderPos(percent);
    };

    // Before Architecture (Chaos)
    const renderBefore = () => (
        <div className="absolute inset-0 w-full h-full bg-[#111] p-8 flex flex-col items-center justify-center overflow-hidden">
            <div className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle at center, #ff4444 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            </div>

            <h3 className="absolute top-6 left-6 text-xl font-bold tracking-tight text-red-400 opacity-80 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Écosystème Chaotique
            </h3>

            {/* Chaotic Connections SVG Background */}
            <svg className="absolute inset-0 w-full h-full opacity-30" viewBox="0 0 800 500" preserveAspectRatio="none">
                <path d="M100,100 C200,300 300,50 400,200 S600,100 700,400" stroke="#ff4444" strokeWidth="2" fill="none" />
                <path d="M150,400 C300,100 500,400 700,150" stroke="#ff4444" strokeWidth="2" strokeDasharray="5,5" fill="none" />
                <path d="M50,250 L350,250 L500,50 L750,250" stroke="#ff4444" strokeWidth="1" fill="none" />
            </svg>

            {/* Chaotic Nodes */}
            <div className="relative z-10 w-full max-w-lg aspect-video">
                <div className="absolute top-[10%] left-[10%] p-4 border border-red-500/30 bg-[#1a0f0f] rounded-xl transform rotate-[-5deg]">Shopify Apps (x12)</div>
                <div className="absolute top-[60%] left-[20%] p-4 border border-red-500/30 bg-[#1a0f0f] rounded-xl transform rotate-[3deg]">Zendesk (Isolé)</div>
                <div className="absolute top-[20%] right-[10%] p-4 border border-red-500/30 bg-[#1a0f0f] rounded-xl transform rotate-[8deg]">Fichiers Excel</div>
                <div className="absolute top-[70%] right-[20%] p-3 border border-red-500/50 bg-red-900/20 text-red-400 rounded-xl font-bold flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-ping"></div> Erreur de Sync.
                </div>
                <div className="absolute top-[40%] left-[40%] p-6 border-2 border-red-500/40 bg-red-500/10 rounded-full text-center">
                    <p className="text-gray-400 text-sm">Équipe Humaine</p>
                    <p className="text-red-400 font-bold mt-1">Saturée</p>
                </div>
            </div>
        </div>
    );

    // After Architecture (Order & AI)
    const renderAfter = () => (
        <div className="absolute inset-0 w-full h-full bg-[#030303] flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: 'linear-gradient(to right, #ffffff05 1px, transparent 1px), linear-gradient(to bottom, #ffffff05 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}>
            </div>

            <h3 className="absolute top-6 right-6 text-xl font-bold tracking-tight text-emerald-400 flex items-center gap-2">
                Infrastructure Actero <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
            </h3>

            {/* Clean Connections SVG Background */}
            <svg className="absolute inset-0 w-full h-full opacity-60" viewBox="0 0 800 500" preserveAspectRatio="none">
                <path d="M200,250 L400,250 L600,250" stroke="#10b981" strokeWidth="3" fill="none" opacity="0.3" />
                <path d="M400,100 L400,400" stroke="#10b981" strokeWidth="3" fill="none" opacity="0.3" />
                <circle cx="200" cy="250" r="4" fill="#10b981" />
                <circle cx="600" cy="250" r="4" fill="#10b981" />
                <circle cx="400" cy="100" r="4" fill="#10b981" />
                <circle cx="400" cy="400" r="4" fill="#10b981" />
            </svg>

            {/* Clean Nodes */}
            <div className="relative z-10 w-full max-w-lg aspect-video flex items-center justify-center">
                <div className="absolute left-[10%] p-4 border border-white/10 bg-[#0a0a0a] rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-[#95BF47]/20 flex items-center justify-center text-[#95BF47] font-bold">S</div> Shopify
                </div>

                <div className="absolute right-[10%] p-4 border border-white/10 bg-[#0a0a0a] rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center font-bold">K</div> Klaviyo / CRM
                </div>

                <div className="absolute top-[15%] p-4 border border-white/10 bg-[#0a0a0a] rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-[#17494D]/40 flex items-center justify-center text-teal-200 font-bold">Z</div> Zendesk
                </div>

                <div className="absolute bottom-[15%] p-4 border border-white/10 bg-[#0a0a0a] rounded-xl flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">M</div> ERP / Logistique
                </div>

                {/* Central AI Engine */}
                <div className="relative p-8 border-2 border-emerald-500/40 bg-emerald-500/10 rounded-2xl text-center shadow-[0_0_50px_rgba(16,185,129,0.15)] flex flex-col items-center justify-center">
                    <div className="absolute inset-0 rounded-2xl bg-emerald-400 blur-xl opacity-20 pointer-events-none"></div>
                    <Zap className="w-8 h-8 text-emerald-400 mb-2 relative z-10" />
                    <span className="font-bold text-white relative z-10">Actero AI Hub</span>
                    <span className="text-xs text-emerald-400 font-bold uppercase tracking-widest mt-2 relative z-10">Data Centralisée</span>
                </div>
            </div>
        </div>
    );

    return (
        <section className="py-32 relative overflow-hidden bg-[#030303] border-t border-white/5 z-10">
            <div className="max-w-7xl mx-auto px-6">

                <FadeInUp className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-bold text-gray-300 mb-6">
                        <Layers className="w-4 h-4" /> Analyse d'Architecture
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
                        Éradiquez la dette technique
                    </h2>
                    <p className="text-lg text-gray-400 font-medium max-w-2xl mx-auto">
                        Faites glisser le curseur pour comparer. La majorité des e-commerçants empilent les applications. Nous détruisons ce chaos pour y placer une intelligence unique.
                    </p>
                </FadeInUp>

                {/* Slider Container */}
                <FadeInUp delay={0.2}>
                    <div
                        ref={containerRef}
                        className="relative w-full h-[500px] md:h-[600px] rounded-[32px] overflow-hidden border border-white/10 select-none cursor-ew-resize mt-12 bg-[#0a0a0a] shadow-2xl"
                        onMouseMove={handleDrag}
                        onTouchMove={handleDrag}
                        onClick={handleDrag}
                    >
                        {/* 1. Underlying Image (After / Clean) */}
                        {renderAfter()}

                        {/* 2. Top Image (Before / Chaos) clipped by slider */}
                        <div
                            className="absolute inset-0 h-full overflow-hidden border-r-2 border-white pointer-events-none shadow-[20px_0_50px_rgba(0,0,0,0.5)]"
                            style={{ width: `${sliderPos}%` }}
                        >
                            <div className="absolute inset-0" style={{ width: containerRef.current?.offsetWidth || '100vw' }}>
                                {renderBefore()}
                            </div>
                        </div>

                        {/* 3. Slider Handle */}
                        <div
                            className="absolute top-0 bottom-0 flex items-center justify-center transform -translate-x-1/2 pointer-events-none z-20"
                            style={{ left: `${sliderPos}%` }}
                        >
                            {/* Line */}
                            <div className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"></div>
                            {/* Handle Button */}
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-2xl relative z-10 text-black border-4 border-[#030303]">
                                <GripVertical className="w-6 h-6" />
                            </div>
                        </div>

                    </div>

                    <div className="flex justify-between mt-6 text-sm font-bold tracking-widest uppercase">
                        <span className="text-red-400">Stack Classique</span>
                        <span className="text-emerald-400">Actero Custom</span>
                    </div>
                </FadeInUp>

            </div>
        </section>
    );
};
