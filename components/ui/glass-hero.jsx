import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Play, Mic, ArrowUp } from 'lucide-react';
import { FadeInUp, ScaleIn } from './scroll-animations';
import { LeadCaptureModal } from './lead-capture-modal';

export const GlassHero = ({ onNavigate }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [pendingPrompt, setPendingPrompt] = useState('');
    const [messages, setMessages] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleMockInteraction = (promptTextOrEvent) => {
        let text = '';
        if (typeof promptTextOrEvent === 'string') {
            text = promptTextOrEvent;
        } else if (promptTextOrEvent && promptTextOrEvent.preventDefault) {
            promptTextOrEvent.preventDefault();
            text = inputValue;
        }

        if (!text.trim()) return;

        setPendingPrompt(text);
        setIsModalOpen(true);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleMockInteraction();
        }
    };

    const generateAIResponse = async (prompt, brandData) => {
        // Add user message
        const userMsg = { role: 'user', content: prompt };
        // Add loading assistant message
        setMessages(prev => [...prev, userMsg, { role: 'assistant', content: '', isLoading: true }]);
        setIsGenerating(true);
        setInputValue('');

        // Simulate API thinking
        await new Promise(r => setTimeout(r, 2000));

        let aiReply = "Super, nous pouvons totalement automatiser cela. ";

        if (prompt.toLowerCase().includes("client") || prompt.toLowerCase().includes("support")) {
            aiReply = `Pour l'optimisation du service client chez ${brandData.brand}, je prépare un agent IA capable de traiter 80% des requêtes instantanément avec vos bases de connaissances. Vous voulez voir comment on s'y prend ?`;
        } else if (prompt.toLowerCase().includes("commerce") || prompt.toLowerCase().includes("shopify")) {
            aiReply = `Excellente idée. Actero peut synchroniser votre infrastructure e-commerce ${brandData.brand} avec vos outils (ex: Klaviyo) et intégrer un agent vocal pour augmenter la conversion et relancer les paniers abandonnés.`;
        } else {
            aiReply = `D'accord, je génère un audit sur-mesure pour ce processus chez ${brandData.brand}. L'objectif sera de réduire les tâches manuelles de 70% tout en augmentant la vélocité.`;
        }

        // Update with actual response
        setMessages(prev => {
            const newMsgs = [...prev];
            newMsgs[newMsgs.length - 1] = { role: 'assistant', content: aiReply, isLoading: false };
            return newMsgs;
        });
        setIsGenerating(false);
    };

    const handleModalSubmit = async (data) => {
        setIsModalOpen(false);
        await generateAIResponse(pendingPrompt, data);
    };
    return (
        <div className="relative min-h-screen flex flex-col items-center justify-center pt-24 pb-32 px-6 overflow-hidden">

            {/* Background Image Setup */}
            <div className="absolute inset-0 z-0">
                <img
                    src="/moody_landscape_bg.png"
                    alt="Premium Moody Landscape"
                    className="w-full h-full object-cover object-[center_70%] opacity-90"
                />
                {/* Gradients to blend with the rest of the dark site */}
                <div className="absolute inset-0 bg-gradient-to-b from-[#030303]/40 via-transparent to-[#030303] pointer-events-none"></div>
                <div className="absolute inset-x-0 bottom-0 h-96 bg-gradient-to-t from-[#030303] to-transparent pointer-events-none"></div>
            </div>

            <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col items-center">

                {/* Pill Badge */}
                <FadeInUp className="mb-8 relative group cursor-pointer inline-flex items-center">
                    <div className="absolute inset-0 bg-white/20 rounded-full blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <div className="relative bg-white/10 backdrop-blur-md border border-white/20 text-gray-200 px-5 py-2 rounded-full text-sm font-medium flex items-center gap-2 hover:bg-white/15 transition-colors">
                        Nouveau : Audit gratuit de votre infrastructure IA
                        <div className="bg-white/20 rounded-full p-1 flex items-center justify-center">
                            <ArrowRight className="w-3 h-3 text-white" />
                        </div>
                    </div>
                </FadeInUp>

                {/* Headlines */}
                <FadeInUp delay={0.1} className="text-center max-w-4xl mb-6">
                    <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight text-white mb-6 leading-[1.05]">
                        L'agence IA qui transforme <br className="hidden md:block" />
                        vos goulots en marges
                    </h1>
                    <p className="text-lg md:text-xl text-gray-300/80 font-medium max-w-xl mx-auto leading-relaxed">
                        Nous concevons et déployons des agents IA <br className="hidden md:block" />
                        et automatisations sur mesure pour votre entreprise.
                    </p>
                </FadeInUp>

                {/* Action Buttons */}
                <FadeInUp delay={0.2} className="flex items-center gap-4 mb-20">
                    <button
                        onClick={() => {
                            const el = document.getElementById('calendly');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="bg-white text-black px-7 py-3.5 rounded-full text-[15px] font-semibold hover:bg-gray-100 hover:scale-105 transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.3)]"
                    >
                        Réserver un audit
                    </button>
                    <button
                        onClick={() => {
                            const el = document.getElementById('calendly');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="bg-white/10 backdrop-blur-md border border-white/10 text-white w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/20 hover:scale-105 transition-all duration-300 group"
                    >
                        <Play className="w-4 h-4 text-white fill-white group-hover:scale-110 transition-transform" />
                    </button>
                </FadeInUp>

                {/* The Glassmorphic Product Card */}
                <ScaleIn delay={0.3} className="w-full max-w-4xl mx-auto perspective-[2000px]">
                    <div
                        className="w-full bg-[#1A1A1A]/60 backdrop-blur-2xl border border-white/10 rounded-[32px] p-6 shadow-[0_30px_100px_rgba(0,0,0,0.6)] relative overflow-hidden group hover:border-white/20 hover:shadow-[0_30px_120px_rgba(0,0,0,0.8)] transition-all duration-700 ease-out"
                        style={{ transform: "rotateX(2deg) rotateY(0deg) translateZ(0)", transformStyle: "preserve-3d" }}
                    >
                        {/* Inner Top Bar */}
                        <div className="flex justify-between items-center mb-16 pt-2 px-2">
                            <div className="flex gap-2">
                                <div className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                    <div className="w-3 h-3 bg-white rounded-[4px] rotate-45"></div>
                                </div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center cursor-pointer hover:bg-white/10 transition-colors">
                                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                            </div>
                        </div>

                        {/* Chat Interface Dynamic */}
                        <div className="flex flex-col items-center px-4 md:px-12 pb-12">

                            {messages.length === 0 ? (
                                <>
                                    <h3 className="text-2xl font-medium text-white mb-2 tracking-tight">Bonjour</h3>
                                    <p className="text-gray-400 text-[15px] mb-10">Comment puis-je optimiser vos processus aujourd'hui ?</p>

                                    {/* Suggestions / Tags (Empty State) */}
                                    <div className="w-full max-w-2xl flex flex-wrap items-center justify-center gap-2 mb-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
                                        <button onClick={() => handleMockInteraction("Service Client")} className="bg-white/10 text-gray-300 text-xs font-semibold px-4 py-2 rounded-full border border-white/5 hover:bg-white/20 hover:-translate-y-0.5 transition-all">Service Client</button>
                                        <button onClick={() => handleMockInteraction("E-commerce")} className="bg-white/5 text-gray-400 text-xs font-semibold px-4 py-2 rounded-full border border-transparent hover:bg-white/10 hover:text-white transition-all">E-commerce</button>
                                        <button onClick={() => handleMockInteraction("CRM")} className="bg-white/5 text-gray-400 text-xs font-semibold px-4 py-2 rounded-full border border-transparent hover:bg-white/10 hover:text-white transition-all">CRM</button>
                                        <button onClick={() => handleMockInteraction("Rapports IA")} className="bg-white/5 text-gray-400 text-xs font-semibold px-4 py-2 rounded-full border border-transparent hover:bg-white/10 hover:text-white transition-all">Rapports IA</button>
                                    </div>

                                    <div className="w-full max-w-2xl flex flex-col items-center gap-3 mb-8">
                                        <button
                                            onClick={() => handleMockInteraction("Connecter Shopify à Klaviyo et un agent vocal OpenAI")}
                                            className="flex items-center justify-between gap-4 text-sm font-medium text-gray-400 py-2 px-4 rounded-xl hover:bg-white/5 hover:text-white transition-colors group border border-transparent hover:border-white/10 w-full md:w-auto"
                                        >
                                            <span className="truncate">Connecter Shopify à Klaviyo et un agent vocal OpenAI</span>
                                            <ArrowRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all flex-shrink-0" />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="w-full max-w-2xl flex flex-col gap-6 mb-8 mt-4">
                                    {messages.map((msg, idx) => (
                                        <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[85%] rounded-2xl p-4 ${msg.role === 'user' ? 'bg-white/10 text-white rounded-br-none border border-white/10' : 'bg-transparent text-gray-300'}`}>
                                                {msg.role === 'assistant' && (
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <div className="w-6 h-6 bg-white rounded flex items-center justify-center">
                                                            <div className="w-2.5 h-2.5 bg-black rounded-sm rotate-45"></div>
                                                        </div>
                                                        <span className="text-sm font-bold text-white">Actero AI</span>
                                                    </div>
                                                )}

                                                {msg.isLoading ? (
                                                    <div className="flex gap-1 items-center h-6">
                                                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                                        <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></div>
                                                    </div>
                                                ) : (
                                                    <div className="text-[15px] leading-relaxed">
                                                        {msg.content}
                                                    </div>
                                                )}

                                                {msg.role === 'assistant' && !msg.isLoading && (
                                                    <button
                                                        onClick={() => {
                                                            const el = document.getElementById('calendly');
                                                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                                                        }}
                                                        className="mt-4 bg-white text-black text-sm font-bold px-5 py-2.5 rounded-xl hover:bg-gray-200 transition-colors inline-flex items-center gap-2"
                                                    >
                                                        Réserver un appel technique <ArrowRight className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Chat Input */}
                            <div className="w-full max-w-2xl bg-[#252525]/80 border border-white/5 rounded-2xl p-4 shadow-inner mt-auto transition-all hover:border-white/10 focus-within:border-white/20 focus-within:bg-[#2A2A2A]/90 relative z-10">
                                <textarea
                                    disabled={isGenerating}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={isGenerating ? "Actero génère une réponse..." : "Décrivez un processus chronophage..."}
                                    className="w-full bg-transparent text-white placeholder:text-gray-500 text-[15px] resize-none outline-none min-h-[60px] disabled:opacity-50"
                                ></textarea>
                                <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-3">
                                    <div className="flex items-center gap-3 text-gray-500">
                                        <button className="hover:text-white transition-colors" title="Joindre un fichier"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
                                        <button className="hover:text-white transition-colors" title="Ajouter du contexte"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></button>
                                        <button className="hover:text-white transition-colors" title="Exécuter"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            disabled={isGenerating}
                                            className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                                        >
                                            <Mic className="w-4 h-4" />
                                        </button>
                                        <button
                                            disabled={isGenerating || !inputValue.trim()}
                                            onClick={handleMockInteraction}
                                            className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:bg-gray-600 disabled:text-gray-400"
                                        >
                                            <ArrowUp className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Subtle sheen overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                    </div>
                </ScaleIn>

            </div>

            {/* Lead Capture Modal */}
            <LeadCaptureModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleModalSubmit}
            />
        </div>
    );
};
