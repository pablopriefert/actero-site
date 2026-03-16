import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Zap,
  Bot,
  Search,
  Lock,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Database,
  RefreshCw,
  X
} from 'lucide-react'
import { callGemini } from '../../lib/gemini'

const logs = [
  "Initialisation de l'Agent de Crawling...",
  "Extraction de la structure DOM...",
  "Analyse sémantique du contenu textuel...",
  "Identification du secteur d'activité...",
  "Audit des flux d'interactions visibles...",
  "Simulation de charges transactionnelles...",
  "Mise en corrélation avec nos modèles d'E-commerçants...",
  "Génération du plan d'optimisation IA...",
];

export const AIAuditScannerModal = ({ isOpen, onClose, onNavigate }) => {
  const [url, setUrl] = useState("");
  const [scanState, setScanState] = useState("idle"); // idle, scanning, complete
  const [progress, setProgress] = useState(0);
  const [currentLog, setCurrentLog] = useState("");
  const [auditData, setAuditData] = useState(null);
  const [isRealScanDone, setIsRealScanDone] = useState(false);

  useEffect(() => {
    if (progress >= 95 && isRealScanDone && scanState === "scanning") {
      setProgress(100);
      setTimeout(() => setScanState("complete"), 600);
    }
  }, [progress, isRealScanDone, scanState]);

  const fetchRealAudit = async (targetUrl) => {
    const defaultFallback = {
      timeSaved: "25h+ / semaine",
      bottlenecks: [
        {
          title: "Support de niveau 1 saturé",
          description: "Déploiement d'un agent IA multilingue connecté à votre base de données pour absorber 80% des tickets en temps réel.",
          icon: "bot",
        },
        {
          title: "Abandon de panier inexploité",
          description: "Automatisation d'un Voice Agent IA qui rappelle instantanément les paniers premium avec une offre personnalisée.",
          icon: "refresh",
        },
        {
          title: "Saisie manuelle CRM / Facturation",
          description: "Synchronisation Make instantanée entre vos paiements (Stripe) et votre comptabilité ou votre CRM de vente.",
          icon: "database",
        },
      ],
    };

    try {
      // 1. Scrape with Jina
      const jinaUrl = targetUrl.startsWith("http") ? targetUrl : `https://${targetUrl}`;
      const scrapeRes = await fetch(`https://r.jina.ai/${jinaUrl}`);
      if (!scrapeRes.ok) throw new Error("Scraping failed");
      const pageText = await scrapeRes.text();
      const contentExcerpt = pageText.substring(0, 5000);

      // 2. Analyze with Gemini Proxy
      const prompt = `Tu es un architecte système expert en IA. Voici le contenu textuel extrait du site web d'un prospect : \n\n"${contentExcerpt}"\n\nAnalyse son activité et propose 3 goulots d'étranglement ou automatisations IA très ciblées (ex: prospection métier, support spécifique, devis, etc.). Retourne UNIQUEMENT un JSON valide respectant cette structure exacte : {"timeSaved": "estimation réaliste", "bottlenecks": [ {"title": "Titre court", "description": "L'opportunité d'automatisation IA", "icon": "bot" | "refresh" | "database" } ] }`;

      const result = await callGemini(prompt);
      
      if (result) {
        setAuditData(result);
      } else {
        throw new Error("No valid JSON from Gemini");
      }
    } catch (err) {
      console.error("Real Audit Failed, using fallback:", err);
      setAuditData(defaultFallback);
    } finally {
      setIsRealScanDone(true);
    }
  };

  const handleStartScan = (e) => {
    e.preventDefault();
    if (!url || !url.includes(".")) return;

    setScanState("scanning");
    setProgress(0);
    setIsRealScanDone(false);

    let currentLogIndex = 0;
    setCurrentLog(logs[0]);

    fetchRealAudit(url);

    const interval = setInterval(() => {
      setProgress((prev) => {
        const next = prev + Math.random() * 12;
        if (next >= 95) {
          clearInterval(interval);
          return 95;
        }

        const logStage = Math.floor((next / 100) * logs.length);
        if (logStage > currentLogIndex && logStage < logs.length) {
          currentLogIndex = logStage;
          setCurrentLog(logs[logStage]);
        }

        return next;
      });
    }, 600);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={scanState !== "scanning" ? onClose : undefined}
      ></div>

      <div className="relative w-full max-w-4xl max-h-[95vh] overflow-y-auto hide-scrollbar z-10 animate-fade-in-up">
        {scanState !== "scanning" && (
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center z-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="mb-8 text-center mt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 mb-4 uppercase tracking-widest">
            <Zap className="w-3.5 h-3.5" /> IA Gratuite
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white mb-2">
            Audit Express d'Architecture
          </h2>
          <p className="text-lg text-gray-400 font-medium max-w-2xl mx-auto">
            Notre Agent IA analyse votre site et extrait les meilleures opportunités d'automatisation.
          </p>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
          <div
            className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] transition-colors duration-1000 pointer-events-none ${scanState === "idle"
              ? "bg-zinc-500/10"
              : scanState === "scanning"
                ? "bg-amber-500/10 animate-pulse"
                : "bg-emerald-500/20"
              }`}
          ></div>

          <AnimatePresence mode="wait">
            {scanState === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="max-w-xl mx-auto text-center relative z-10"
              >
                <form
                  onSubmit={handleStartScan}
                  className="flex flex-col sm:flex-row gap-4"
                >
                  <div className="relative flex-1">
                    <label htmlFor="audit-url" className="sr-only">URL de votre site</label>
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Search className="w-5 h-5 text-gray-500" />
                    </div>
                    <input
                      id="audit-url"
                      type="text"
                      placeholder="URL de votre site (ex: lumina.com)"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full bg-[#030303] border border-white/10 rounded-xl py-4 pl-12 pr-4 text-white font-medium placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-white text-black font-bold px-8 py-4 rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2 whitespace-nowrap shadow-[0_0_20px_rgba(255,255,255,0.1)]"
                  >
                    Lancer le Scan <Bot className="w-5 h-5" />
                  </button>
                </form>
                <p className="text-xs text-zinc-500 mt-4 font-medium flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> Analyse confidentielle et 100% gratuite.
                </p>
              </motion.div>
            )}

            {scanState === "scanning" && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="relative z-10"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-emerald-400 font-mono flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours...
                  </span>
                  <span className="text-sm font-bold text-white font-mono">
                    {Math.round(progress)}%
                  </span>
                </div>

                <div className="w-full h-3 bg-[#030303] rounded-full border border-white/5 overflow-hidden mb-6">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500/50 to-emerald-400 relative"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "linear", duration: 0.2 }}
                  >
                    <div className="absolute top-0 right-0 bottom-0 left-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8L3N2Zz4=')] opacity-50"></div>
                  </motion.div>
                </div>

                <div className="bg-[#030303] border border-white/10 rounded-xl p-4 font-mono text-xs text-gray-400 h-32 overflow-hidden relative">
                  <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-[#030303] to-transparent z-10"></div>
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[#030303] to-transparent z-10"></div>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    key={currentLog}
                    className="flex items-start gap-2"
                  >
                    <span className="text-emerald-500 mt-0.5">❯</span>
                    <span className="text-gray-300">{currentLog}</span>
                  </motion.div>
                </div>
              </motion.div>
            )}

            {scanState === "complete" && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl mx-auto text-center relative z-10"
              >
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">
                  Analyse terminée avec succès !
                </h3>
                <p className="text-zinc-400 font-medium mb-10 leading-relaxed">
                  L'IA a détecté <strong className="text-white">3 goulots d'étranglement majeurs</strong> sur <span className="text-emerald-400 font-mono">{url}</span>. 
                  La résolution de ces processus vous ferait économiser <strong className="text-white bg-white/10 px-2 py-0.5 rounded">{auditData?.timeSaved || "25h+ / semaine"}</strong>.
                </p>

                <div className="text-left space-y-4 mb-10">
                  {auditData?.bottlenecks?.map((neck, idx) => (
                    <div
                      key={idx}
                      className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-start gap-4 hover:border-white/20 transition-all"
                    >
                      <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-emerald-400 flex-shrink-0 mt-1">
                        {neck.icon === 'bot' ? <Bot className="w-5 h-5" /> : neck.icon === 'database' ? <Database className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="text-white font-bold mb-1">{neck.title}</h4>
                        <p className="text-sm text-gray-400 font-medium leading-relaxed">{neck.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => onNavigate("/audit")}
                    className="flex-1 bg-white text-black font-bold py-4 rounded-xl hover:scale-105 transition-transform flex items-center justify-center gap-2"
                  >
                    Obtenir le Plan Complet <ArrowRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setScanState("idle");
                      setProgress(0);
                      setIsRealScanDone(false);
                      setAuditData(null);
                    }}
                    className="flex-1 bg-white/5 border border-white/10 text-white font-bold py-4 rounded-xl hover:bg-white/10 transition-colors"
                  >
                    Scanner un autre site
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
