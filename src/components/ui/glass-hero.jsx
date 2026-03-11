import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Play, Mic, ArrowUp, Zap } from 'lucide-react';
import { FadeInUp, ScaleIn } from './scroll-animations';
import { LeadCaptureModal } from './lead-capture-modal';
import { ButtonColorful } from './button-colorful';
import { trackEvent } from '../../lib/analytics';

export const GlassHero = ({ onNavigate, onOpenAuditScanner }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [pendingPrompt, setPendingPrompt] = useState('');
    const [messages, setMessages] = useState([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const fileInputRef = useRef(null);

    const rotatingWords = [
        "plus d'outils.",
        "plus d'agences.",
        "plus de devinettes.",
        "plus de réunions.",
        "plus de recrutements."
    ];
    const [currentWordIndex, setCurrentWordIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentWordIndex((prev) => (prev + 1) % rotatingWords.length);
        }, 3000);
        return () => clearInterval(interval);
    }, [rotatingWords.length]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setInputValue(prev => prev + (prev ? "\n" : "") + `[Fichier joint : ${file.name}]`);
            // Reset input so the same file can be selected again if removed
            e.target.value = null;
        }
    };

    const toggleRecording = () => {
        const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            alert("Désolé, votre navigateur ne supporte pas la reconnaissance vocale.");
            return;
        }

        // Si on est déjà en train d'enregistrer, on annule (le navigateur gère souvent l'arrêt auto)
        if (isRecording) {
            setIsRecording(false);
            return;
        }

        const recognition = new SpeechRec();
        recognition.lang = 'fr-FR';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsRecording(true);
            trackEvent('Hero_Chat_Voice_Started');
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setInputValue(prev => prev + (prev ? " " : "") + transcript);
        };

        recognition.onerror = (event) => {
            console.error("Erreur micro:", event.error);
            setIsRecording(false);
        };

        recognition.onend = () => {
            setIsRecording(false);
        };

        recognition.start();
    };

    const handleMockInteraction = (promptTextOrEvent) => {
        let text = '';
        if (typeof promptTextOrEvent === 'string') {
            text = promptTextOrEvent;
        } else if (promptTextOrEvent && promptTextOrEvent.preventDefault) {
            promptTextOrEvent.preventDefault();
            text = inputValue;
        }

        if (!text.trim()) return;

        trackEvent('Hero_Chat_Message_Sent', {
            messageLength: text.length,
            usedVoice: isRecording
        });

        setPendingPrompt(text);
        setIsModalOpen(true);
    };

    const handleTagClick = (tag) => {
        trackEvent('Hero_Chat_Tag_Clicked', { tag });
        setPendingPrompt(tag);
        generateAIResponse(tag, null);
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

        const brandName = brandData && brandData.brand ? brandData.brand : 'votre entreprise';

        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

        // If no API key, use fallback
        if (!apiKey) {
            await new Promise(r => setTimeout(r, 2000));
            const fallback = `Exemple d'automatisation pour **${brandName}** : Dès qu'une nouvelle demande arrive par e-mail, une IA extrait les données clés, met à jour vos bases de données automatiquement et notifie le service concerné sur Slack.`;
            setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1] = { role: 'assistant', content: fallback, isLoading: false };
                return newMsgs;
            });
            setIsGenerating(false);
            return;
        }

        const fullPrompt = `Entreprise: ${brandName}. Problème ou objectif: "${prompt}"`;

        const payload = {
            contents: [{ parts: [{ text: fullPrompt }] }],
            systemInstruction: {
                parts: [{ text: "Tu es le Lead Architect IA d'Acero, spécialiste incontesté de l'automatisation E-commerce (Shopify, Klaviyo, Zendesk, Stripe, Make). Un CEO e-commerce te décrit une friction, une perte de temps ou d'argent dans ses processus. Ton rôle : 1. Analyser la vraie faille. 2. Proposer une architecture technique instantanée (Data Flow) pour l'éradiquer. 3. Chiffrer le gain mensuel. Sois ultra-premium, direct, impactant, mais garde toujours une phrase d'accroche très humaine, empathique et professionnelle. Parle de croissance, de marge et de scalabilité. TES RÉPONSES DOIVENT TOUJOURS ÊTRE EN FRANÇAIS. Retourne UNIQUEMENT un JSON valide respectant le schéma." }]
            },
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        introMessage: { type: "STRING", description: "Une phrase ou deux très naturelles et empathiques pour accuser réception du problème comme un vrai humain (ex: 'C'est un problème classique qui épuise votre équipe pour rien. Voyons comment on peut régler ça définitivement.')" },
                        diagnosis: { type: "STRING", description: "Le diagnostic du problème (1 phrase courte et percutante)" },
                        solution: { type: "STRING", description: "La logique de la solution d'automatisation proposée (ex: Déclencheur X -> Action Y avec l'outil Z)" },
                        timeSaved: { type: "STRING", description: "Estimation réaliste du temps gagné (ex: '15h / mois')" },
                        revenueImpact: { type: "STRING", description: "Impact métier (ex: '+12% de conversion sur les paniers abandonnés')" }
                    },
                    required: ["introMessage", "diagnosis", "solution", "timeSaved", "revenueImpact"]
                }
            }
        };

        try {
            const res = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }
            );

            if (!res.ok) throw new Error('API error');
            const result = await res.json();

            const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (jsonText) {
                const roiData = JSON.parse(jsonText);
                setMessages(prev => {
                    const newMsgs = [...prev];
                    newMsgs[newMsgs.length - 1] = {
                        role: 'assistant',
                        content: '',
                        isLoading: false,
                        roiData
                    };
                    return newMsgs;
                });
            } else {
                throw new Error('Empty response');
            }
        } catch (err) {
            console.error('Gemini API error:', err);
            // Fallback to simulated response
            await new Promise(r => setTimeout(r, 1500));
            const p = prompt.toLowerCase();
            let aiReply = '';
            if (p.includes('client') || p.includes('sav') || p.includes('support')) {
                aiReply = `Exemple d'automatisation SAV pour **${brandName}** : Nous connectons vos canaux (Zendesk/Intercom/Mail) à un agent IA entraîné sur vos données. Dès qu'un client vous contacte, l'IA analyse l'intention et résout 80% des demandes répétitives.`;
            } else if (p.includes('commerce') || p.includes('shopify') || p.includes('panier')) {
                aiReply = `Exemple d'automatisation E-commerce pour **${brandName}** : Un Agent Vocal IA connecté à votre Shopify téléphone automatiquement aux clients ayant abandonné leur panier. Résultat : +15% de récupération.`;
            } else if (p.includes('crm') || p.includes('lead') || p.includes('vente')) {
                aiReply = `Exemple d'automatisation Sales pour **${brandName}** : Une IA sync avec votre CRM pré-rédige des e-mails d'approche ultra-personnalisés en scrappant LinkedIn.`;
            } else {
                aiReply = `Exemple d'automatisation pour **${brandName}** : Dès qu'une nouvelle demande arrive par e-mail, une IA extrait les données clés, met à jour vos bases de données et notifie le service concerné sur Slack.`;
            }
            aiReply += '\n\nDiscutons-en pour auditer vos process spécifiques :';
            setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1] = { role: 'assistant', content: aiReply, isLoading: false };
                return newMsgs;
            });
        } finally {
            setIsGenerating(false);
        }
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

                {/* Headlines - Marketer Style Rotating Text */}
                <FadeInUp delay={0.1} className="text-center max-w-4xl mb-6">
                    <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.1] md:leading-[1.1]">
                        <span className="block mb-2">La croissance e-commerce</span>
                        <span className="block mb-2 text-white/80">ne passe pas par</span>
                        <div className="h-[1.4em] relative overflow-hidden flex justify-center items-center mt-2">
                            <AnimatePresence mode="wait">
                                <motion.span
                                    key={currentWordIndex}
                                    initial={{ y: 50, opacity: 0, filter: 'blur(8px)' }}
                                    animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                                    exit={{ y: -50, opacity: 0, filter: 'blur(8px)' }}
                                    transition={{ duration: 0.5, ease: "circOut" }}
                                    className="absolute text-emerald-400 tracking-tight"
                                >
                                    {rotatingWords[currentWordIndex]}
                                </motion.span>
                            </AnimatePresence>
                        </div>
                    </h1>
                    <motion.p
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, delay: 1.1, ease: 'easeOut' }}
                        className="text-lg md:text-xl text-gray-300 font-medium max-w-2xl mx-auto leading-relaxed mt-8"
                    >
                        Elle passe par une infrastructure connectée. Intégrez l'IA à votre Shopify, votre CRM et votre Support depuis un seul endroit.
                    </motion.p>
                </FadeInUp>

                {/* Action Buttons */}
                <FadeInUp delay={0.2} className="flex items-center gap-4 mb-20">
                    <ButtonColorful
                        onClick={() => onNavigate('/audit')}
                    >
                        Réserver un audit
                    </ButtonColorful>
                    <button
                        onClick={() => alert("Vidéo de présentation à venir prochainement !")}
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
                                        <button onClick={() => handleTagClick("Service Client")} className="bg-white/10 text-gray-300 text-xs font-semibold px-4 py-2 rounded-full border border-white/5 hover:bg-white/20 hover:-translate-y-0.5 transition-all">Service Client</button>
                                        <button onClick={() => handleTagClick("E-commerce")} className="bg-white/5 text-gray-400 text-xs font-semibold px-4 py-2 rounded-full border border-transparent hover:bg-white/10 hover:text-white transition-all">E-commerce</button>
                                        <button onClick={() => handleTagClick("CRM")} className="bg-white/5 text-gray-400 text-xs font-semibold px-4 py-2 rounded-full border border-transparent hover:bg-white/10 hover:text-white transition-all">CRM</button>
                                        <button onClick={() => handleTagClick("Rapports IA")} className="bg-white/5 text-gray-400 text-xs font-semibold px-4 py-2 rounded-full border border-transparent hover:bg-white/10 hover:text-white transition-all">Rapports IA</button>
                                    </div>

                                    <div className="w-full max-w-2xl flex flex-col items-center gap-3 mb-8">
                                        {onOpenAuditScanner && (
                                            <button
                                                onClick={onOpenAuditScanner}
                                                className="flex items-center justify-between gap-4 text-sm font-bold text-emerald-400 bg-emerald-500/10 py-3 px-6 rounded-xl hover:bg-emerald-500/20 transition-all border border-emerald-500/30 w-full shadow-[0_0_15px_rgba(16,185,129,0.15)] mb-2"
                                            >
                                                <span className="truncate flex items-center gap-2"><Zap className="w-4 h-4 fill-emerald-400" /> Scanner mon site web (Audit IA Gratuit)</span>
                                                <ArrowRight className="w-4 h-4 transition-transform translate-x-0 flex-shrink-0" />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleTagClick("Connecter Shopify à Klaviyo et un agent vocal OpenAI")}
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
                                                ) : msg.roiData ? (
                                                    <div className="space-y-4">
                                                        {/* Intro Message */}
                                                        {msg.roiData.introMessage && (
                                                            <div className="text-[15px] leading-relaxed text-gray-300 mb-6 border-b border-white/5 pb-4">
                                                                {msg.roiData.introMessage}
                                                            </div>
                                                        )}
                                                        {/* Diagnosis */}
                                                        <div>
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Diagnostic</p>
                                                            <p className="text-white font-bold text-base leading-snug">{msg.roiData.diagnosis}</p>
                                                        </div>
                                                        {/* Architecture */}
                                                        <div>
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                                <svg className="w-3 h-3 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                                                Architecture Recommandée
                                                            </p>
                                                            <div className="bg-white/5 border border-white/10 p-3 rounded-xl">
                                                                <p className="text-gray-300 text-sm font-medium leading-relaxed">{msg.roiData.solution}</p>
                                                            </div>
                                                        </div>
                                                        {/* ROI Cards */}
                                                        <div className="grid grid-cols-2 gap-3">
                                                            <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl p-3">
                                                                <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Gain de temps</p>
                                                                <p className="text-emerald-300 font-bold text-lg tracking-tighter">{msg.roiData.timeSaved}</p>
                                                            </div>
                                                            <div className="bg-zinc-800/30 border border-zinc-400/20 rounded-xl p-3">
                                                                <p className="text-[10px] font-bold text-zinc-300 uppercase mb-1">Impact ROI</p>
                                                                <p className="text-zinc-400 font-bold text-lg tracking-tighter">{msg.roiData.revenueImpact}</p>
                                                            </div>
                                                        </div>
                                                        <p className="text-gray-400 text-sm">Discutons-en pour auditer vos process spécifiques :</p>
                                                    </div>
                                                ) : (
                                                    <div className="text-[15px] leading-relaxed">
                                                        {msg.content}
                                                    </div>
                                                )}

                                                {msg.role === 'assistant' && !msg.isLoading && (
                                                    <div className="mt-6 inline-block">
                                                        <ButtonColorful
                                                            onClick={() => {
                                                                const el = document.getElementById('calendly');
                                                                if (el) el.scrollIntoView({ behavior: 'smooth' });
                                                            }}
                                                        >
                                                            Réserver un appel technique <ArrowRight className="w-3.5 h-3.5" />
                                                        </ButtonColorful>
                                                    </div>
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
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            className="hidden"
                                        />
                                        <button onClick={() => fileInputRef.current?.click()} className="hover:text-white transition-colors" title="Joindre un fichier"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg></button>
                                        <button onClick={() => alert("Intégration du contexte base de connaissances à venir.")} className="hover:text-white transition-colors" title="Ajouter du contexte"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></button>
                                        <button onClick={() => alert("Exécution du code en bac à sable à venir.")} className="hover:text-white transition-colors" title="Exécuter"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            disabled={isGenerating}
                                            onClick={toggleRecording}
                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all disabled:opacity-50 ${isRecording ? 'bg-red-500/20 text-red-500 animate-pulse' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}
                                            title="Dicter à la voix"
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
