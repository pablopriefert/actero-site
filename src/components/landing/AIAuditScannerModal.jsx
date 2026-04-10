import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Zap,
  Bot,
  Search,
  Lock,
  Loader2,
  CheckCircle2,
  ArrowRight,
  Database,
  RefreshCw
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
  const [scanState, setScanState] = useState("idle"); // idle, scanning, complete, error
  const [progress, setProgress] = useState(0);
  const [currentLog, setCurrentLog] = useState("");
  const [auditData, setAuditData] = useState(null);
  const [isRealScanDone, setIsRealScanDone] = useState(false);
  const [scanError, setScanError] = useState(null);

  useEffect(() => {
    if (progress >= 95 && isRealScanDone && scanState === "scanning") {
      setProgress(100);
      setTimeout(() => setScanState(scanError ? "error" : "complete"), 600);
    }
  }, [progress, isRealScanDone, scanState, scanError]);

  const fetchRealAudit = async (targetUrl) => {
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
        setScanError(null);
      } else {
        throw new Error("No valid JSON from Gemini");
      }
    } catch (err) {
      console.error("Real Audit Failed:", err);
      setScanError(
        "Impossible d'analyser ce site pour le moment. Vérifiez l'URL ou réessayez dans quelques instants."
      );
      setAuditData(null);
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
    setScanError(null);
    setAuditData(null);

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
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={scanState !== "scanning" ? onClose : undefined}
      ></div>

      <div className="relative w-full max-w-4xl max-h-[95vh] overflow-y-auto hide-scrollbar z-10 animate-fade-in-up">
        {scanState !== "scanning" && (
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-6 right-6 w-10 h-10 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-full flex items-center justify-center z-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="mb-8 text-center mt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-xs font-bold text-gray-600 mb-4 uppercase tracking-widest">
            <Zap className="w-3.5 h-3.5" /> IA Gratuite
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-gray-900 mb-2">
            Audit Express d'Architecture
          </h2>
          <p className="text-lg text-gray-600 font-medium max-w-2xl mx-auto">
            Notre Agent IA analyse votre site et extrait les meilleures opportunités d'automatisation.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-3xl p-8 md:p-12 shadow-xl relative overflow-hidden">
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
                      <Search className="w-5 h-5 text-gray-400" />
                    </div>
                    <input
                      id="audit-url"
                      type="text"
                      placeholder="URL de votre site (ex: lumina.com)"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      className="w-full bg-white border border-gray-200 rounded-xl py-4 pl-12 pr-4 text-gray-900 font-medium placeholder-gray-400 focus:outline-none focus:border-[#1B7D3A]/50 focus:ring-1 focus:ring-[#1B7D3A]/50 transition-all"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="bg-[#1B7D3A] text-white font-bold px-8 py-4 rounded-xl hover:bg-[#166B32] transition-colors flex items-center justify-center gap-2 whitespace-nowrap"
                  >
                    Lancer le Scan <Bot className="w-5 h-5" />
                  </button>
                </form>
                <p className="text-xs text-gray-500 mt-4 font-medium flex items-center justify-center gap-1.5">
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
                  <span className="text-sm font-bold text-[#1B7D3A] font-mono flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours...
                  </span>
                  <span className="text-sm font-bold text-gray-900 font-mono">
                    {Math.round(progress)}%
                  </span>
                </div>

                <div className="w-full h-3 bg-gray-100 rounded-full border border-gray-200 overflow-hidden mb-6">
                  <motion.div
                    className="h-full bg-[#1B7D3A] relative"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "linear", duration: 0.2 }}
                  />
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 font-mono text-xs text-gray-500 h-32 overflow-hidden relative">
                  <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-gray-50 to-transparent z-10"></div>
                  <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-gray-50 to-transparent z-10"></div>
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    key={currentLog}
                    className="flex items-start gap-2"
                  >
                    <span className="text-[#1B7D3A] mt-0.5">❯</span>
                    <span className="text-gray-600">{currentLog}</span>
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
                <div className="w-16 h-16 bg-green-50 border border-green-200 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-8 h-8 text-[#1B7D3A]" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">
                  Analyse terminée avec succès !
                </h3>
                <p className="text-gray-600 font-medium mb-10 leading-relaxed">
                  L'IA a détecté <strong className="text-gray-900">3 goulots d'étranglement majeurs</strong> sur <span className="text-[#1B7D3A] font-mono">{url}</span>.
                  La résolution de ces processus vous ferait économiser <strong className="text-gray-900 bg-gray-50 px-2 py-0.5 rounded">{auditData?.timeSaved || "25h+ / semaine"}</strong>.
                </p>

                <div className="text-left space-y-4 mb-10">
                  {auditData?.bottlenecks?.map((neck, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex items-start gap-4 hover:border-gray-300 transition-all"
                    >
                      <div className="w-10 h-10 bg-[#1B7D3A]/10 rounded-lg flex items-center justify-center text-[#1B7D3A] flex-shrink-0 mt-1">
                        {neck.icon === 'bot' ? <Bot className="w-5 h-5" /> : neck.icon === 'database' ? <Database className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                      </div>
                      <div>
                        <h4 className="text-gray-900 font-bold mb-1">{neck.title}</h4>
                        <p className="text-sm text-gray-600 font-medium leading-relaxed">{neck.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => onNavigate("/audit")}
                    className="flex-1 bg-[#1B7D3A] text-white font-bold py-4 rounded-xl hover:bg-[#166B32] transition-colors flex items-center justify-center gap-2"
                  >
                    Obtenir le Plan Complet <ArrowRight className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setScanState("idle");
                      setProgress(0);
                      setIsRealScanDone(false);
                      setAuditData(null);
                      setScanError(null);
                    }}
                    className="flex-1 bg-gray-50 border border-gray-200 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    Scanner un autre site
                  </button>
                </div>
              </motion.div>
            )}

            {scanState === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-xl mx-auto text-center relative z-10"
                role="alert"
              >
                <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto mb-6">
                  <X className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2 tracking-tight">
                  Analyse impossible
                </h3>
                <p className="text-gray-600 font-medium mb-8 leading-relaxed">
                  {scanError || "Une erreur est survenue pendant l'analyse de votre site."}
                </p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => {
                      setScanState("idle");
                      setProgress(0);
                      setIsRealScanDone(false);
                      setAuditData(null);
                      setScanError(null);
                    }}
                    className="flex-1 bg-[#1B7D3A] text-white font-bold py-4 rounded-xl hover:bg-[#166B32] transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-5 h-5" /> Reessayer
                  </button>
                  <button
                    onClick={() => onNavigate("/audit")}
                    className="flex-1 bg-gray-50 border border-gray-200 text-gray-700 font-bold py-4 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    Contacter l'equipe
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
