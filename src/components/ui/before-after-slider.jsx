import React, { useState, useRef, useCallback } from 'react';
import { Layers, Zap, GripVertical } from 'lucide-react';
import { FadeInUp } from './scroll-animations';

export const BeforeAfterSlider = () => {
    const [sliderPos, setSliderPos] = useState(50);
    const [containerWidth, setContainerWidth] = useState(0);
    const containerRef = useRef(null);

    // Track container width via callback ref pattern
    const measuredRef = useCallback((node) => {
        if (node) {
            containerRef.current = node;
            setContainerWidth(node.offsetWidth);
            const observer = new ResizeObserver(([entry]) => {
                setContainerWidth(entry.contentRect.width);
            });
            observer.observe(node);
        }
    }, []);

    const handleDrag = (e) => {
        if (!containerRef.current) return;

        let clientX = e.clientX;
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
        <div className="absolute inset-0 w-full h-full bg-[#111] overflow-hidden">
            {/* Dot grid background */}
            <div className="absolute inset-0 opacity-20 pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(circle at center, #ff4444 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
            </div>

            {/* Title */}
            <h3 className="absolute top-4 left-4 md:top-6 md:left-6 text-sm md:text-lg font-bold tracking-tight text-red-400 opacity-80 flex items-center gap-2 z-20">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span> Écosystème Chaotique
            </h3>

            {/* Chaotic Connections */}
            <svg className="absolute inset-0 w-full h-full opacity-25" viewBox="0 0 800 500" preserveAspectRatio="none">
                <path d="M100,100 C200,300 300,50 400,200 S600,100 700,400" stroke="#ff4444" strokeWidth="2" fill="none" />
                <path d="M150,400 C300,100 500,400 700,150" stroke="#ff4444" strokeWidth="2" strokeDasharray="5,5" fill="none" />
            </svg>

            {/* Chaotic Scattered Nodes */}
            <div className="absolute top-[15%] left-[6%] p-2.5 md:p-3.5 border border-red-500/30 bg-[#1a0f0f] rounded-lg md:rounded-xl transform rotate-[-5deg] text-[11px] md:text-sm text-gray-300 font-medium z-10">
                Shopify Apps (x12)
            </div>
            <div className="absolute top-[22%] right-[8%] p-2.5 md:p-3.5 border border-red-500/30 bg-[#1a0f0f] rounded-lg md:rounded-xl transform rotate-[8deg] text-[11px] md:text-sm text-gray-300 font-medium z-10">
                Fichiers Excel
            </div>
            <div className="absolute bottom-[28%] left-[6%] p-2.5 md:p-3.5 border border-red-500/30 bg-[#1a0f0f] rounded-lg md:rounded-xl transform rotate-[3deg] text-[11px] md:text-sm text-gray-300 font-medium z-10">
                Zendesk (Isolé)
            </div>
            <div className="absolute bottom-[18%] right-[6%] p-2 md:p-3 border border-red-500/50 bg-red-900/20 text-red-400 rounded-lg md:rounded-xl font-bold flex items-center gap-1.5 text-[11px] md:text-sm z-10">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping"></div> Erreur de Sync.
            </div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-4 md:p-5 border-2 border-red-500/40 bg-red-500/10 rounded-full text-center z-10">
                <p className="text-gray-400 text-[10px] md:text-xs">Équipe Humaine</p>
                <p className="text-red-400 font-bold text-xs md:text-sm mt-0.5">Saturée</p>
            </div>
        </div>
    );

    // After Architecture (Order & AI)
    const renderAfter = () => (
        <div className="absolute inset-0 w-full h-full bg-[#0A0E1A] overflow-hidden">
            {/* Grid background */}
            <div className="absolute inset-0 pointer-events-none"
                style={{
                    backgroundImage: 'linear-gradient(to right, #ffffff05 1px, transparent 1px), linear-gradient(to bottom, #ffffff05 1px, transparent 1px)',
                    backgroundSize: '40px 40px'
                }}>
            </div>

            {/* Title */}
            <h3 className="absolute top-4 right-4 md:top-6 md:right-6 text-sm md:text-lg font-bold tracking-tight text-emerald-400 flex items-center gap-2 z-20">
                Infrastructure Actero <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
            </h3>

            {/* Clean Connection Lines */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 500" preserveAspectRatio="none">
                {/* Horizontal line through center */}
                <line x1="120" y1="250" x2="680" y2="250" stroke="#10b981" strokeWidth="2" opacity="0.2" />
                {/* Vertical line through center */}
                <line x1="400" y1="80" x2="400" y2="420" stroke="#10b981" strokeWidth="2" opacity="0.2" />
                {/* Endpoint dots */}
                <circle cx="120" cy="250" r="4" fill="#10b981" opacity="0.5" />
                <circle cx="680" cy="250" r="4" fill="#10b981" opacity="0.5" />
                <circle cx="400" cy="80" r="4" fill="#10b981" opacity="0.5" />
                <circle cx="400" cy="420" r="4" fill="#10b981" opacity="0.5" />
            </svg>

            {/* LEFT NODE: Shopify */}
            <div className="absolute top-1/2 left-[4%] md:left-[8%] transform -translate-y-1/2 p-2.5 md:p-3.5 border border-white/10 bg-[#0E1424] rounded-lg md:rounded-xl flex items-center gap-2 text-white text-[11px] md:text-sm font-medium z-10">
                <div className="w-6 h-6 md:w-7 md:h-7 rounded bg-[#95BF47]/20 flex items-center justify-center text-[#95BF47] font-bold text-[10px] md:text-xs">S</div> Shopify
            </div>

            {/* RIGHT NODE: Klaviyo */}
            <div className="absolute top-1/2 right-[4%] md:right-[8%] transform -translate-y-1/2 p-2.5 md:p-3.5 border border-white/10 bg-[#0E1424] rounded-lg md:rounded-xl flex items-center gap-2 text-white text-[11px] md:text-sm font-medium z-10">
                <div className="w-6 h-6 md:w-7 md:h-7 rounded bg-white/10 flex items-center justify-center font-bold text-[10px] md:text-xs">K</div> Klaviyo / CRM
            </div>

            {/* TOP NODE: Zendesk */}
            <div className="absolute top-[12%] md:top-[14%] left-1/2 transform -translate-x-1/2 p-2.5 md:p-3.5 border border-white/10 bg-[#0E1424] rounded-lg md:rounded-xl flex items-center gap-2 text-white text-[11px] md:text-sm font-medium z-10">
                <div className="w-6 h-6 md:w-7 md:h-7 rounded bg-[#17494D]/40 flex items-center justify-center text-teal-200 font-bold text-[10px] md:text-xs">Z</div> Zendesk
            </div>

            {/* BOTTOM NODE: Logistique */}
            <div className="absolute bottom-[12%] md:bottom-[14%] left-1/2 transform -translate-x-1/2 p-2.5 md:p-3.5 border border-white/10 bg-[#0E1424] rounded-lg md:rounded-xl flex items-center gap-2 text-white text-[11px] md:text-sm font-medium z-10">
                <div className="w-6 h-6 md:w-7 md:h-7 rounded bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-[10px] md:text-xs">L</div> Logistique
            </div>

            {/* CENTER: AI Engine */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 p-4 md:p-6 border-2 border-emerald-500/40 bg-emerald-500/10 rounded-2xl text-center shadow-[0_0_50px_rgba(16,185,129,0.15)] flex flex-col items-center justify-center z-10">
                <div className="absolute inset-0 rounded-2xl bg-emerald-400 blur-xl opacity-20 pointer-events-none"></div>
                <Zap className="w-5 h-5 md:w-7 md:h-7 text-emerald-400 mb-1 relative z-10" />
                <span className="font-bold text-white relative z-10 text-xs md:text-sm whitespace-nowrap">Actero AI Hub</span>
                <span className="text-[8px] md:text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-1 relative z-10">Data Centralisée</span>
            </div>
        </div>
    );

    return (
        <section className="py-24 md:py-32 relative overflow-hidden bg-[#0A0E1A] border-t border-white/5 z-10">
            <div className="max-w-7xl mx-auto px-6">

                <FadeInUp className="text-center mb-12 md:mb-16">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-bold text-gray-300 mb-6">
                        <Layers className="w-4 h-4" /> Analyse d'Architecture
                    </div>
                    <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">
                        Éradiquez la dette technique
                    </h2>
                    <p className="text-base md:text-lg text-gray-400 font-medium max-w-2xl mx-auto">
                        Faites glisser le curseur pour comparer. La majorité des e-commerçants empilent les applications. Nous détruisons ce chaos pour y placer une intelligence unique.
                    </p>
                </FadeInUp>

                {/* Slider Container */}
                <FadeInUp delay={0.2}>
                    <div
                        ref={measuredRef}
                        className="relative w-full h-[350px] sm:h-[420px] md:h-[520px] lg:h-[580px] rounded-[24px] md:rounded-[32px] overflow-hidden border border-white/10 select-none cursor-ew-resize mt-8 md:mt-12 bg-[#0E1424] shadow-2xl"
                        onMouseMove={handleDrag}
                        onTouchMove={handleDrag}
                        onClick={handleDrag}
                    >
                        {/* 1. Underlying (After / Clean) */}
                        {renderAfter()}

                        {/* 2. Overlay (Before / Chaos) clipped by slider */}
                        <div
                            className="absolute inset-0 h-full overflow-hidden border-r-2 border-white pointer-events-none shadow-[20px_0_50px_rgba(0,0,0,0.5)]"
                            style={{ width: `${sliderPos}%` }}
                        >
                            <div className="absolute inset-0" style={{ width: containerWidth || '100vw' }}>
                                {renderBefore()}
                            </div>
                        </div>

                        {/* 3. Slider Handle */}
                        <div
                            className="absolute top-0 bottom-0 flex items-center justify-center transform -translate-x-1/2 pointer-events-none z-20"
                            style={{ left: `${sliderPos}%` }}
                        >
                            <div className="absolute top-0 bottom-0 w-0.5 md:w-1 bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]"></div>
                            <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-full flex items-center justify-center shadow-2xl relative z-10 text-black border-4 border-[#030303]">
                                <GripVertical className="w-5 h-5 md:w-6 md:h-6" />
                            </div>
                        </div>

                    </div>

                    <div className="flex justify-between mt-4 md:mt-6 text-xs md:text-sm font-bold tracking-widest uppercase">
                        <span className="text-red-400">Stack Classique</span>
                        <span className="text-emerald-400">Actero Custom</span>
                    </div>
                </FadeInUp>

            </div>
        </section>
    );
};
