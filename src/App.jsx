import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { Analytics } from "@vercel/analytics/react";
import { motion, useInView as useFmInView, useMotionValue, useTransform, animate, AnimatePresence } from 'framer-motion';
import {
  ChevronRight, Play, UserX, Database, TrendingDown, ArrowRight, Activity,
  Clock, DollarSign, CheckCircle2, Cpu, BrainCircuit, Server, CreditCard,
  Plus, Minus, Menu, X, LayoutDashboard, Users, Settings, LogOut, FileText,
  LifeBuoy, Search, Filter, MoreVertical, Lock, Mail, AlertCircle, TerminalSquare,
  ArrowUpRight, Download, Sparkles, Bot, Zap, ShoppingCart, MessageSquare,
  Repeat, Target, ShieldCheck, ZapOff, ArrowRightCircle, Copy, RefreshCw,
  Lightbulb, TrendingUp, XCircle, CheckCircle, BarChart2, UserRoundX, Loader2, UserPlus
} from 'lucide-react';

// --- Configuration Supabase ---
import { DemoHeroGeometric } from '../components/blocks/demo-hero';
import { HeroBackground } from '../components/ui/shape-landing-hero';
import { ButtonColorful } from '../components/ui/button-colorful';
import { Futuristic3DBackground } from '../components/ui/futuristic-3d-background';
import { GlassHero } from '../components/ui/glass-hero';
import { FadeInUp, SlideInRight, SlideInLeft, StaggerContainer, StaggerItem, ScaleIn } from '../components/ui/scroll-animations';
import { initAmplitude, trackEvent } from './lib/analytics';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Sécurité & Configuration
const isSupabaseConfigured = SUPABASE_URL && SUPABASE_URL.includes('supabase.co');
let supabase = null;

// --- API Gemini ---
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
console.log("GEMINI KEY length:", apiKey?.length, "starts:", apiKey?.slice(0, 4));

// --- Utilitaires ---
function useInView(options) {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setIsInView(true); observer.unobserve(entry.target); }
    }, options);
    if (ref.current) observer.observe(ref.current);
    return () => { if (ref.current) observer.unobserve(ref.current); };
  }, [options]);
  return [ref, isInView];
}

const AnimatedNumber = ({ end, suffix = "", prefix = "", duration = 2000, decimals = 0 }) => {
  const [ref, isInView] = useInView({ threshold: 0.1 });
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isInView) return;
    let startTime = null;
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(end * easeProgress);
      if (progress < 1) requestAnimationFrame(animate);
      else setCount(end);
    };
    requestAnimationFrame(animate);
  }, [isInView, end, duration]);
  return <span ref={ref}>{prefix}{count.toFixed(decimals)}{suffix}</span>;
};

async function fetchWithRetry(url, options, retries = 5) {
  const delays = [1000, 2000, 4000, 8000, 16000];
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise(res => setTimeout(res, delays[i]));
    }
  }
}

const Logo = ({ className = "w-8 h-8", light = false }) => (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={`${className} ${light ? 'text-white' : 'text-white'}`}>
    <path d="M16 2L2 30H10L16 18L22 30H30L16 2Z" fill="currentColor" />
  </svg>
);

// Scroll-triggered animated counter
const ScrollCounter = ({ value, prefix = '', suffix = '', className = '' }) => {
  const ref = useRef(null);
  const isInView = useFmInView(ref, { once: true, margin: '-100px' });
  const count = useMotionValue(0);
  const rounded = useTransform(count, v => Math.round(v));
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (isInView) {
      const controls = animate(count, value, {
        duration: 2,
        ease: [0.22, 1, 0.36, 1],
      });
      return controls.stop;
    }
  }, [isInView, value, count]);

  useEffect(() => {
    const unsubscribe = rounded.on('change', v => setDisplay(v));
    return unsubscribe;
  }, [rounded]);

  return <span ref={ref} className={className}>{prefix}{display}{suffix}</span>;
};

// ==========================================
// === DASHBOARD V2 DESIGN START ===
// ==========================================
const Badge = ({ children, variant = 'gray', className = '' }) => {
  const variants = {
    gray: 'bg-white/5 text-gray-400 border-white/10',
    zinc: 'bg-zinc-800 text-zinc-400 border-zinc-600',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${variants[variant] || variants.gray} ${className}`}>
      {children}
    </span>
  );
};

const StatCard = ({ title, value, icon: Icon, color = 'zinc', subtitleItems = [], className = '' }) => {
  const colors = {
    zinc: { bg: 'bg-zinc-800', border: 'border-zinc-700', text: 'text-zinc-300', val: 'text-zinc-300', hover: 'group-hover:bg-zinc-400/10' },
    emerald: { bg: 'bg-emerald-50', border: 'border-emerald-100', text: 'text-emerald-600', val: 'text-emerald-600', hover: 'group-hover:bg-emerald-500/10' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-100', text: 'text-amber-600', val: 'text-amber-600', hover: 'group-hover:bg-amber-500/10' },
    gray: { bg: 'bg-white/5', border: 'border-white/5', text: 'text-gray-400', val: 'text-white', hover: 'group-hover:bg-gray-500/10' }
  };
  const c = colors[color] || colors.gray;

  return (
    <div className={`bg-[#0a0a0a] p-6 rounded-2xl border border-white/10 shadow-sm flex flex-col relative overflow-hidden group transition-all duration-200 ease-out transform hover:-translate-y-1 hover:shadow-md ${className}`}>
      <div className={`absolute -top-10 -right-10 w-32 h-32 ${c.hover} rounded-full blur-3xl transition-colors`}></div>
      <div className="flex items-center gap-3 mb-4 relative z-10">
        <div className={`p-2.5 ${c.bg} border ${c.border} ${c.text} rounded-xl`}>
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{title}</p>
      </div>
      <div className={`text-3xl font-bold ${c.val} tracking-tight mb-1 relative z-10 min-h-[36px] flex items-end`}>
        {value}
      </div>
      {subtitleItems.length > 0 && (
        <div className="mt-auto relative z-10 flex items-center gap-2 text-xs font-medium text-gray-400 pt-2">
          {subtitleItems.map((item, idx) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span>•</span>}
              <span>{item}</span>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

const SectionHeader = ({ title, description, icon: Icon, action }) => (
  <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
    <div>
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="w-5 h-5 text-zinc-300" />}
        <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
      </div>
      {description && <p className="text-sm text-gray-400 font-medium">{description}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
);

const SkeletonRow = ({ height = "h-4", width = "w-full", className = "" }) => (
  <div className={`${height} ${width} bg-white/10 rounded-md animate-pulse ${className}`}></div>
);

// --- PREMIUM DASHBOARD WIDGETS ---

const LiveLogFeed = () => {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const templates = [
      { text: "Webhook Shopify réceptionné", icon: "🌐", color: "text-blue-400" },
      { text: "Analyse IA terminée: Anomalie détectée", icon: "🧠", color: "text-amber-400" },
      { text: "Correction envoyée à Klaviyo", icon: "✉️", color: "text-purple-400" },
      { text: "Synchronisation CRM réussie", icon: "✅", color: "text-emerald-400" },
      { text: "Nouvelle commande #4092 analysée", icon: "🛒", color: "text-zinc-300" },
      { text: "Lead #89 scorer par Actero AI", icon: "⚡", color: "text-indigo-400" },
      { text: "Workflow 'Panier Abandonné' déclenché", icon: "🔄", color: "text-orange-400" }
    ];

    let idCounter = 0;

    // Initialize with some logs
    setLogs(Array(4).fill(null).map((_, i) => ({
      id: idCounter++,
      ...templates[Math.floor(Math.random() * templates.length)],
      time: new Date(Date.now() - (4 - i) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    })));

    const interval = setInterval(() => {
      const template = templates[Math.floor(Math.random() * templates.length)];
      setLogs(prev => {
        const newLogs = [{
          id: idCounter++,
          ...template,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        }, ...prev];
        return newLogs.slice(0, 6); // Keep last 6
      });
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-[#0a0a0a] rounded-2xl border border-white/10 p-6 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
          Flux en direct <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </h3>
        <Badge variant="zinc">Temps Réel</Badge>
      </div>

      <div className="flex-1 relative">
        {/* Fading bottom edge */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-[#0a0a0a] to-transparent z-10"></div>
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {logs.map(log => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="flex items-center gap-3 p-3 bg-white/5 border border-white/5 rounded-xl text-sm"
              >
                <div className="w-8 h-8 rounded-lg bg-black/50 flex items-center justify-center flex-shrink-0 border border-white/5 shadow-inner">
                  <span>{log.icon}</span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className={`font-semibold truncate ${log.color}`}>{log.text}</p>
                </div>
                <span className="text-xs text-gray-500 font-mono flex-shrink-0">{log.time}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

const ROIGlowChart = () => {
  // Simulated chart path drawing an upward curve
  return (
    <div className="bg-[#0a0a0a] rounded-2xl border border-white/10 p-6 shadow-sm flex flex-col h-full relative overflow-hidden group">
      <div className="absolute top-[-50%] right-[-10%] w-[300px] h-[300px] bg-emerald-500/10 blur-[100px] rounded-full group-hover:bg-emerald-500/20 transition-colors duration-700 pointer-events-none"></div>

      <div className="flex items-center justify-between mb-8 relative z-10">
        <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Croissance du ROI</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-white tracking-tighter">+24%</span>
            <span className="text-sm font-bold text-emerald-500 flex items-center"><ArrowUpRight className="w-4 h-4" /> ce mois</span>
          </div>
        </div>
        <div className="p-3 bg-white/5 rounded-xl border border-white/5">
          <DollarSign className="w-5 h-5 text-emerald-400" />
        </div>
      </div>

      <div className="flex-1 relative w-full min-h-[160px] flex items-end">
        <svg viewBox="0 0 400 120" className="w-full h-full preserve-3d overflow-visible">
          <defs>
            <linearGradient id="glowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(16, 185, 129, 0.4)" />
              <stop offset="100%" stopColor="rgba(16, 185, 129, 0)" />
            </linearGradient>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Grid lines */}
          <line x1="0" y1="30" x2="400" y2="30" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="0" y1="70" x2="400" y2="70" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="0" y1="110" x2="400" y2="110" stroke="rgba(255,255,255,0.05)" strokeWidth="1" strokeDasharray="4 4" />

          {/* Fill Area */}
          <motion.path
            d="M 0 110 Q 50 100, 100 80 T 200 60 T 300 30 T 400 10 L 400 120 L 0 120 Z"
            fill="url(#glowGradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.5, delay: 0.5 }}
          />

          {/* Stroke Line */}
          <motion.path
            d="M 0 110 Q 50 100, 100 80 T 200 60 T 300 30 T 400 10"
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            filter="url(#glow)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />

          {/* Dots */}
          {[
            { cx: 0, cy: 110 }, { cx: 100, cy: 80 }, { cx: 200, cy: 60 }, { cx: 300, cy: 30 }, { cx: 400, cy: 10 }
          ].map((pt, i) => (
            <motion.circle
              key={i}
              cx={pt.cx}
              cy={pt.cy}
              r="4"
              fill="#0a0a0a"
              stroke="#10b981"
              strokeWidth="2"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 1.5 + (i * 0.1), type: "spring" }}
            />
          ))}
        </svg>
      </div>
    </div>
  );
};

// === DASHBOARD V2 DESIGN END ===

const MilestoneBadge = ({ hoursSaved }) => {
  if (!hoursSaved || hoursSaved < 100) return null;

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-2xl p-6 mb-8 flex items-center justify-between"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(245,158,11,0.4)]">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-amber-500">Jalon Atteint 🎉</h3>
          <p className="text-zinc-400 font-medium">Félicitations ! Vous avez dépassé les {Math.floor(hoursSaved / 100) * 100} heures gagnées grâce à Actero AI.</p>
        </div>
      </div>
    </motion.div>
  );
};

const InfrastructureNodeMap = () => {
  return (
    <div className="bg-[#0a0a0a] rounded-3xl border border-white/10 p-8 shadow-sm relative overflow-hidden h-[400px] flex items-center justify-center">
      {/* Background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]"></div>

      {/* Animated Pulses running horizontally */}
      <motion.div
        animate={{ x: [0, 600] }}
        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
        className="absolute top-[40%] left-[-100px] w-20 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent blur-sm"
      ></motion.div>
      <motion.div
        animate={{ x: [0, 600] }}
        transition={{ repeat: Infinity, duration: 3.5, ease: "linear", delay: 1 }}
        className="absolute top-[60%] left-[-100px] w-20 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent blur-sm"
      ></motion.div>

      {/* Nodes */}
      <div className="relative z-10 flex items-center gap-12 lg:gap-24 w-full justify-center">

        {/* Source Node */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-md relative group">
            <div className="absolute inset-0 bg-white/5 blur-xl group-hover:bg-white/10 transition-colors rounded-2xl"></div>
            <ShoppingCart className="w-8 h-8 text-indigo-400" />
          </div>
          <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">Shopify</span>
        </div>

        {/* Brain Node (Actero) */}
        <div className="flex flex-col items-center gap-3">
          <div className="w-20 h-20 bg-zinc-900 border border-emerald-500/30 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.1)] relative">
            <div className="absolute inset-[-10px] border border-emerald-500/20 rounded-full animate-ping [animation-duration:3s]"></div>
            <BrainCircuit className="w-10 h-10 text-emerald-400" />
          </div>
          <span className="text-xs font-bold text-emerald-500 tracking-widest uppercase shadow-emerald-500/50">Actero OS</span>
        </div>

        {/* Dest Nodes */}
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-md relative group">
              <Mail className="w-8 h-8 text-amber-400" />
            </div>
            <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">Klaviyo</span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-md relative group">
              <Database className="w-8 h-8 text-blue-400" />
            </div>
            <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">Make</span>
          </div>
        </div>
      </div>

      {/* Visual SVG Lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
        {/* Left to Center */}
        <path d="M 35% 50% L 45% 50%" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
        {/* Center to Top Right */}
        <path d="M 55% 50% L 65% 35%" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
        {/* Center to Bottom Right */}
        <path d="M 55% 50% L 65% 65%" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
      </svg>
    </div>
  );
};

// ==========================================
// 1. PAGE DE CONNEXION (LOGIN)
// ==========================================
const LoginPage = ({ onNavigate, onLogin }) => {
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error("Erreur : Base de données non connectée.");
      }

      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/#type=recovery`,
        });
        if (error) throw error;
        setSuccess("✅ Lien envoyé. Vérifie ta boîte mail.");
        return;
      }

      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;

      onNavigate('/app');

    } catch (err) {
      setError(isForgot
        ? "Erreur lors de l'envoi du lien."
        : "Identifiants incorrects."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError('');
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/app`
        }
      });
      if (error) throw error;
    } catch (err) {
      setError('Erreur Google Auth.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#111111] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        {/* Le container du formulaire, reproduisant la carte grise */}
        <div className="bg-[#18181b] w-full max-w-[400px] border border-white/5 shadow-2xl rounded-3xl p-8 md:p-10 mx-auto flex flex-col outline outline-1 outline-white/5">

          <div className="flex flex-col items-center mb-8">
            <div onClick={() => onNavigate('/')} className="cursor-pointer w-12 h-12 rounded-full bg-[#27272a] flex items-center justify-center shadow-inner hover:scale-105 transition-transform mb-4 border border-white/5">
              <Logo light={true} className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-white text-2xl font-semibold tracking-tight">Actero</h2>
          </div>

          <form className="space-y-4 flex flex-col" onSubmit={handleSubmit}>
            {error && <div className="p-3 bg-red-500/10 text-red-500 text-xs font-medium rounded-xl border border-red-500/20 text-center">{error}</div>}
            {success && <div className="p-3 bg-emerald-500/10 text-emerald-500 text-xs font-medium rounded-xl border border-emerald-500/20 text-center">{success}</div>}

            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3.5 bg-[#27272a] border border-transparent rounded-[14px] focus:ring-1 focus:ring-zinc-500 outline-none transition-all text-sm text-white placeholder:text-zinc-500 font-medium disabled:opacity-50"
              placeholder="Adresse e-mail"
            />

            {!isForgot && (
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-[#27272a] border border-transparent rounded-[14px] focus:ring-1 focus:ring-zinc-500 outline-none transition-all text-sm text-white placeholder:text-zinc-500 font-medium disabled:opacity-50"
                placeholder="Mot de passe"
              />
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 rounded-[14px] text-sm font-semibold text-zinc-300 bg-[#313136] hover:bg-[#3f3f46] hover:text-white transition-colors disabled:opacity-50 h-[48px] flex items-center justify-center"
            >
              {loading && !isForgot ? (
                <svg className="animate-spin h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                isForgot ? 'Envoyer le lien' : 'Se connecter'
              )}
            </button>

            {!isForgot && (
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3.5 mt-1 rounded-[14px] text-sm font-semibold text-zinc-300 bg-[#27272a] hover:bg-[#313136] hover:text-white transition-colors disabled:opacity-50 h-[48px]"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continuer avec Google
              </button>
            )}

            <div className="flex items-center justify-center mt-6 pt-4">
              <button
                type="button"
                onClick={() => { setIsForgot(!isForgot); setError(''); setSuccess(''); }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors font-medium underline underline-offset-4 decoration-zinc-800 hover:decoration-zinc-600"
              >
                {isForgot ? "Retour à la connexion" : "Mot de passe oublié ?"}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// ADMIN ONBOARDING VIEW
// ==========================================
const AdminOnboardingView = () => {
  const [brandName, setBrandName] = useState('');
  const [email, setEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successData, setSuccessData] = useState(null);

  const handleCreateAndInvite = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessData(null);
    setLoading(true);

    try {
      if (!brandName.trim() || !email.trim()) {
        throw new Error("Le nom de l'entreprise et l'email sont requis.");
      }

      if (!isSupabaseConfigured || !supabase) {
        throw new Error("Backend required: Instance Supabase manquante.");
      }

      const { data, error } = await supabase.rpc('admin_onboard_client', {
        p_brand_name: brandName.trim(),
        p_email: email.trim()
      });

      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || "Erreur indéterminée via RPC.");

      setSuccessData(data);
      setBrandName('');
      setEmail('');
    } catch (err) {
      console.error("[ONBOARDING ERROR]", err);
      // Fallback for missing RPC
      if (err.message?.includes('Could not find the function') || err.code === 'PGRST202' || err.code === 'PGRST200' || err.code === '42883') {
        setErrorMsg("Backend required: La RPC 'admin_onboard_client' est manquante ou inaccessible. Demander à Claude de l'ajouter.");
      } else {
        setErrorMsg(err.message || "Une erreur est survenue lors de l'onboarding.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendMagicLink = async (targetEmail) => {
    try {
      const { data, error } = await supabase.rpc('admin_resend_magic_link', { p_email: targetEmail });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || "Erreur lors du renvoi.");
      alert("Magic Link renvoyé avec succès !");
    } catch (err) {
      console.error(err);
      if (err.message?.includes('Could not find the function') || err.code === 'PGRST202' || err.code === '42883') {
        alert("Backend required: RPC 'admin_resend_magic_link' manquante.");
      } else {
        alert("Erreur: " + err.message);
      }
    }
  };

  const handleCheckStatus = async (targetEmail) => {
    try {
      const { data, error } = await supabase.rpc('admin_get_onboarding_status', { p_email: targetEmail });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.message || "Erreur de vérification.");
      alert(`Statut: ${data.status}\nLié: ${data.linked ? 'Oui' : 'Non'}`);
    } catch (err) {
      console.error(err);
      if (err.message?.includes('Could not find the function') || err.code === 'PGRST202' || err.code === '42883') {
        alert("Backend required: RPC 'admin_get_onboarding_status' manquante.");
      } else {
        alert("Erreur: " + err.message);
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in-up">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Onboarding Client</h2>
        <p className="text-gray-400 font-normal mt-1 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-zinc-400" />
          Créez un profil client et envoyez-lui un accès immédiat (SaaS fermé).
        </p>
      </div>

      <div className="bg-[#0a0a0a] p-8 rounded-2xl border border-white/10 shadow-sm mb-8">
        <form onSubmit={handleCreateAndInvite} className="space-y-6">
          {errorMsg && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-start gap-3 text-sm font-medium">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-white mb-2">Nom de l'entreprise (Brand)</label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Ex: Koma"
                className="w-full px-4 py-3 bg-[#030303] border border-white/10 rounded-xl focus:ring-2 focus:ring-zinc-400 outline-none transition-all text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-white mb-2">Email du client</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: contact@koma.com"
                className="w-full px-4 py-3 bg-[#030303] border border-white/10 rounded-xl focus:ring-2 focus:ring-zinc-400 outline-none transition-all text-sm"
                required
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto flex justify-center items-center gap-2 py-3 px-6 rounded-xl shadow-sm text-sm font-bold text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Création en cours...</>
              ) : (
                <><CheckCircle className="w-4 h-4" /> Créer & envoyer l'accès</>
              )}
            </button>
          </div>
        </form>
      </div>

      {successData && (
        <div className="bg-emerald-50 border border-emerald-100 p-8 rounded-2xl shadow-sm animate-fade-in-up">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-emerald-900 mt-1">Client onboardé avec succès !</h3>
              <p className="text-emerald-700 text-sm font-medium mt-1">Le profil a été créé et l'invitation a été envoyée.</p>
            </div>
          </div>

          <div className="bg-[#0a0a0a] rounded-xl border border-emerald-100 p-4 space-y-3 text-sm mb-6">
            <div className="flex justify-between border-b border-gray-50 pb-2 flex-wrap gap-2">
              <span className="text-gray-400 font-medium whitespace-nowrap">Client ID</span>
              <span className="font-mono font-bold text-white truncate max-w-xs">{successData.client_id}</span>
            </div>
            <div className="flex justify-between border-b border-gray-50 pb-2 flex-wrap gap-2">
              <span className="text-gray-400 font-medium whitespace-nowrap">Email invité</span>
              <span className="font-bold text-white truncate max-w-xs">{successData.email}</span>
            </div>
            <div className="flex justify-between flex-wrap gap-2">
              <span className="text-gray-400 font-medium whitespace-nowrap">Statut liaison</span>
              <span className="font-bold text-white">
                {successData.linked ? (
                  <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Lié ({successData.user_id})</span>
                ) : (
                  <span className="text-amber-600 flex items-center gap-1"><Clock className="w-4 h-4" /> En attente de connexion du client</span>
                )}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => handleResendMagicLink(successData.email)}
              className="bg-[#0a0a0a] text-emerald-700 hover:bg-emerald-50 border border-emerald-200 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" /> Renvoyer magic link
            </button>
            <button
              onClick={() => handleCheckStatus(successData.email)}
              className="bg-[#0a0a0a] text-gray-300 hover:bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Activity className="w-4 h-4" /> Vérifier statut
            </button>
            <button
              onClick={() => { navigator.clipboard.writeText(successData.client_id); alert('ID copié !'); }}
              className="bg-[#0a0a0a] text-gray-300 hover:bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" /> Copier ID
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 2. DASHBOARD ADMIN
// ==========================================

const AdminActivityHeatmap = () => {
  // Generate 30 days of mock data
  const days = Array.from({ length: 30 }, (_, i) => {
    const isWeekend = i % 7 === 0 || i % 7 === 6;
    const intensity = isWeekend ? Math.floor(Math.random() * 2) : Math.floor(Math.random() * 5); // 0-4
    return { id: i, intensity };
  });

  const getColor = (intensity) => {
    switch (intensity) {
      case 0: return 'bg-white/5 border-white/5';
      case 1: return 'bg-emerald-900/40 border-emerald-800/50';
      case 2: return 'bg-emerald-700/60 border-emerald-600/50';
      case 3: return 'bg-emerald-500/80 border-emerald-400/50';
      case 4: return 'bg-emerald-400 border-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.4)]';
      default: return 'bg-white/5 border-white/5';
    }
  };

  return (
    <div className="bg-[#0a0a0a] rounded-2xl border border-white/10 p-6 shadow-sm mt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">Activité Globale</h3>
          <p className="text-xs text-zinc-500 mt-1">Intensité d'exécution des workflows par les clients (30 derniers jours)</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
          Moins <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map(v => <div key={v} className={`w-3 h-3 rounded-sm border ${getColor(v)}`}></div>)}
          </div> Plus
        </div>
      </div>
      <div className="flex gap-2 justify-between items-end">
        {days.map(day => (
          <motion.div
            key={day.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: day.id * 0.02 }}
            className={`flex-1 rounded-sm border transition-colors hover:ring-2 ring-emerald-400/50 aspect-square ${getColor(day.intensity)}`}
            title={`Jour ${day.id}: Activité niveau ${day.intensity}`}
          ></motion.div>
        ))}
      </div>
    </div>
  );
};

const AdminKanbanBoard = ({ requests }) => {
  const columns = [
    { id: 'en_attente', title: 'À qualifier', statusFilter: ['en_attente', 'nouveau', null, ''], color: 'border-amber-500/30 bg-amber-500/5', badge: 'bg-amber-100 text-amber-700' },
    { id: 'en_cours', title: 'Architecture en cours', statusFilter: ['en_cours', 'analyse'], color: 'border-blue-500/30 bg-blue-500/5', badge: 'bg-blue-100 text-blue-700' },
    { id: 'termine', title: 'Déployé', statusFilter: ['termine', 'valide', 'deploye'], color: 'border-emerald-500/30 bg-emerald-500/5', badge: 'bg-emerald-100 text-emerald-700' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
      {columns.map(col => {
        const columnTasks = requests.filter(r => col.statusFilter.includes(r.status?.toLowerCase() || ''));
        return (
          <div key={col.id} className={`rounded-3xl border border-white/5 bg-[#0a0a0a]/50 p-4 flex flex-col gap-4 shadow-inner min-h-[60vh]`}>
            <div className="flex items-center justify-between mb-2 px-2">
              <h3 className="font-bold text-white text-sm tracking-widest uppercase">{col.title}</h3>
              <span className="bg-white/10 text-zinc-400 px-2.5 py-0.5 rounded-full text-xs font-bold">{columnTasks.length}</span>
            </div>
            {columnTasks.map(req => (
              <motion.div
                layoutId={req.id}
                key={req.id}
                className={`bg-[#111] border ${col.color} p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow group cursor-pointer`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${col.badge}`}>{req.status || 'Nouveau'}</span>
                  {req.priority === 'high' && <span className="text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest uppercase">Prio</span>}
                </div>
                <h4 className="font-bold text-white text-base leading-tight mb-2 group-hover:text-emerald-400 transition-colors">{req.title || 'Projet IA'}</h4>
                <p className="text-xs text-zinc-500 font-medium line-clamp-2 mb-4">{req.description}</p>
                <div className="flex items-center justify-between border-t border-white/5 pt-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-white/10 flex items-center justify-center text-[10px] font-bold text-white uppercase">{req.clients?.brand_name?.charAt(0) || '?'}</div>
                    <span className="text-xs font-bold text-zinc-400 truncate max-w-[100px]">{req.clients?.brand_name || 'Client Inconnu'}</span>
                  </div>
                  <span className="text-[10px] text-zinc-600 font-mono">{new Date(req.created_at).toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' })}</span>
                </div>
              </motion.div>
            ))}
            {columnTasks.length === 0 && (
              <div className="text-center p-8 border border-white/5 border-dashed rounded-2xl text-zinc-600 text-sm font-medium">Vide</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

const CommandKModal = ({ isOpen, onClose, clients, setActiveTab }) => {
  const [search, setSearch] = useState('');

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredClients = clients.filter(c =>
    c.brand_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh] px-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="w-full max-w-2xl bg-[#111] border border-white/10 rounded-2xl shadow-2xl relative overflow-hidden"
      >
        <div className="flex items-center px-4 py-3 border-b border-white/10 relative">
          <Search className="w-5 h-5 text-zinc-500 absolute left-4" />
          <input
            autoFocus
            type="text"
            placeholder="Rechercher un client, une commande, une page..."
            className="w-full bg-transparent border-none outline-none text-white pl-10 py-2 placeholder:text-zinc-600 font-medium"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex items-center gap-1.5 ml-4">
            <kbd className="bg-white/10 text-zinc-400 text-xs px-2 py-1 rounded font-mono font-bold tracking-widest leading-none">ESC</kbd>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {search === '' && (
            <div className="mb-4">
              <div className="text-xs font-bold text-zinc-600 uppercase tracking-widest px-3 py-2">Raccourcis Rapides</div>
              <button onClick={() => { setActiveTab('overview'); onClose(); }} className="w-full flex items-center justify-between px-3 py-3 hover:bg-white/5 rounded-xl transition-colors text-left group">
                <div className="flex items-center gap-3">
                  <LayoutDashboard className="w-5 h-5 text-zinc-400 group-hover:text-white" />
                  <span className="text-zinc-300 group-hover:text-white font-medium">Aller à Vue Globale</span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all" />
              </button>
              <button onClick={() => { setActiveTab('requests'); onClose(); }} className="w-full flex items-center justify-between px-3 py-3 hover:bg-white/5 rounded-xl transition-colors text-left group">
                <div className="flex items-center gap-3">
                  <Sparkles className="w-5 h-5 text-amber-400 group-hover:text-amber-300" />
                  <span className="text-zinc-300 group-hover:text-white font-medium">Aller aux Demandes IA</span>
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all" />
              </button>
            </div>
          )}

          <div className="text-xs font-bold text-zinc-600 uppercase tracking-widest px-3 py-2">Clients</div>
          {filteredClients.length > 0 ? (
            filteredClients.map(client => (
              <button key={client.id} onClick={() => { setActiveTab('clients'); onClose(); }} className="w-full flex items-center justify-between px-3 py-3 hover:bg-white/5 rounded-xl transition-colors text-left group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center border border-white/5 font-bold text-white text-xs">
                    {client.brand_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-zinc-300 group-hover:text-white font-medium">{client.brand_name}</span>
                </div>
                <kbd className="bg-white/5 border border-white/10 text-zinc-500 text-[10px] px-2 py-0.5 rounded font-mono opacity-0 group-hover:opacity-100 transition-all">Aller au dossier</kbd>
              </button>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-zinc-500 font-medium">Aucun client trouvé pour "{search}"</div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const AdminDashboard = ({ onNavigate, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ✅ DATA FROM SUPABASE (instead of mocks)
  const [clients, setClients] = useState([]);
  const [requestsData, setRequestsData] = useState([]);
  const [leads, setLeads] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [isCommandKOpen, setIsCommandKOpen] = useState(false);

  // Command-K Listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandKOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const load = async () => {
      setDataLoading(true);
      setDataError("");

      try {
        if (!isSupabaseConfigured || !supabase) {
          throw new Error("Supabase non configuré.");
        }

        // 1) Clients
        const { data: clientsRows, error: clientsErr } = await supabase
          .from("clients")
          .select("*")
          .order("created_at", { ascending: false });

        if (clientsErr) throw clientsErr;
        setClients(clientsRows || []);

        // 2) Requests
        const { data: requestsRows, error: requestsErr } = await supabase
          .from("requests")
          .select("id, client_id, title, description, stack, priority, status, created_at, clients(brand_name)")
          .order("created_at", { ascending: false });

        if (requestsErr) throw requestsErr;
        setRequestsData(requestsRows || []);

        // 3) Leads
        const { data: leadsRows, error: leadsErr } = await supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false });

        if (leadsErr) throw leadsErr;
        setLeads(leadsRows || []);
      } catch (e) {
        setDataError(e?.message || "Erreur de chargement des données.");
      } finally {
        setDataLoading(false);
      }
    };

    load();
  }, []);

  const handleAddClient = async () => {
    const brandName = prompt("Nom de l'entreprise du nouveau client :");
    if (!brandName || !brandName.trim()) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData?.session?.user?.id;
      if (!userId) throw new Error("Utilisateur non authentifié.");

      const { data, error } = await supabase
        .from('clients')
        .insert([{ brand_name: brandName.trim(), owner_user_id: userId }])
        .select()
        .single();

      if (error) throw error;

      setClients(prev => [data, ...prev]);
    } catch (err) {
      console.error(err);
      alert("Erreur lors de l'ajout du client : " + err.message);
    }
  };

  const Sidebar = () => (
    <div className="w-full md:w-64 bg-[#0a0a0a] border-r border-white/10 flex flex-col h-full">
      <div className="h-16 flex items-center px-6 border-b border-white/10 justify-between md:justify-start">
        <div className="flex items-center gap-2">
          <Logo className="w-6 h-6 text-white" />
          <span className="font-bold text-lg text-white">Actero Admin</span>
        </div>
        <button className="md:hidden text-gray-400 hover:text-white" onClick={() => setIsMobileMenuOpen(false)}><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
        <button onClick={() => { setActiveTab('overview'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'overview' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}><LayoutDashboard className="w-4 h-4" /> Vue Globale</button>
        <button onClick={() => { setActiveTab('clients'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'clients' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}><Users className="w-4 h-4" /> Clients</button>
        <button onClick={() => { setActiveTab('automations'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'automations' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}><TerminalSquare className="w-4 h-4" /> Infrastructures</button>
        <button onClick={() => { setActiveTab('requests'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'requests' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
          <div className="flex items-center gap-3"><Sparkles className="w-4 h-4" /> Demandes IA</div>
          {requestsData.length > 0 && <span className="bg-emerald-100 text-emerald-700 py-0.5 px-2 rounded-full text-xs font-bold">{requestsData.length}</span>}
        </button>
        <button onClick={() => { setActiveTab('leads'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'leads' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
          <div className="flex items-center gap-3"><Users className="w-4 h-4" /> Leads AI</div>
          {leads.length > 0 && <span className="bg-blue-100 text-blue-700 py-0.5 px-2 rounded-full text-xs font-bold">{leads.length}</span>}
        </button>
        <button onClick={() => { setActiveTab('onboarding'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'onboarding' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
          <div className="flex items-center gap-3"><UserPlus className="w-4 h-4" /> Onboarding</div>
        </button>
      </div>
      <div className="p-4 border-t border-white/10">
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"><LogOut className="w-4 h-4" /> Déconnexion</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#030303] flex flex-col md:flex-row font-sans">
      {/* Mobile Header */}
      <div className="md:hidden h-16 bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Logo className="w-6 h-6 text-white" />
          <span className="font-bold text-lg text-white">Actero Admin</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-400"><Menu className="w-6 h-6" /></button>
      </div>

      {/* Sidebar Desktop */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Sidebar Mobile Overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="relative w-4/5 max-w-xs bg-[#0a0a0a] h-full shadow-2xl">
            <Sidebar />
          </div>
        </div>
      )}

      {/* COMMAND-K MODAL */}
      <AnimatePresence>
        {isCommandKOpen && (
          <CommandKModal
            isOpen={isCommandKOpen}
            onClose={() => setIsCommandKOpen(false)}
            clients={clients}
            setActiveTab={setActiveTab}
          />
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="hidden md:flex h-16 bg-[#0a0a0a] border-b border-white/10 items-center px-8 shadow-sm">
          <h1 className="text-xl font-bold text-white capitalize tracking-tight">{activeTab.replace('-', ' ')}</h1>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">

          {activeTab === 'onboarding' && (
            <AdminOnboardingView />
          )}

          {activeTab === 'overview' && (
            <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start gap-4 shadow-sm">
                <AlertCircle className="w-6 h-6 text-red-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="text-base font-bold text-red-900">Alertes Systèmes</h3>
                  <p className="text-sm text-red-700 mt-1 font-medium">Client "DataSync" : 0 exécution depuis 48h. Vérification recommandée.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-white/10 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Total Heures Économisées</p>
                  <p className="text-4xl font-bold text-white font-mono tracking-tighter"><AnimatedCounter value={4205} /> <span className="text-xl font-medium text-gray-400">h</span></p>
                </div>
                <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-white/10 shadow-sm hover:shadow-md transition-shadow">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Valeur Générée (Globale)</p>
                  <p className="text-4xl font-bold text-white font-mono tracking-tighter"><AnimatedCounter value={185400} /> <span className="text-xl font-medium text-gray-400">€</span></p>
                </div>
                <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-white/10 shadow-sm relative overflow-hidden hover:shadow-md transition-shadow">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Taux de succès global</p>
                  <p className="text-4xl font-bold text-emerald-600 font-mono tracking-tighter"><AnimatedCounter value={99} />.8 <span className="text-xl font-medium text-emerald-500">%</span></p>
                </div>
              </div>

              <AdminActivityHeatmap />
            </div>
          )}

          {activeTab === 'clients' && (
            <div className="max-w-6xl mx-auto animate-fade-in-up">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div className="relative w-full sm:w-auto">
                  <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" placeholder="Rechercher un client..." className="pl-10 pr-4 py-2.5 bg-[#0a0a0a] border border-white/10 rounded-xl text-sm w-full sm:w-80 focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400 outline-none transition-all shadow-sm" />
                </div>
                <button onClick={handleAddClient} className="bg-zinc-300 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-zinc-400 transition-colors shadow-sm w-full sm:w-auto justify-center">
                  <Plus className="w-4 h-4" /> Nouveau client
                </button>
              </div>

              {dataLoading ? (
                <div className="flex justify-center items-center py-20">
                  <svg className="animate-spin h-8 w-8 text-zinc-300" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </div>
              ) : dataError ? (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2"><AlertCircle className="w-5 h-5 flex-shrink-0" />{dataError}</div>
              ) : clients.length === 0 ? (
                <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-16 text-center shadow-sm flex flex-col items-center">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5">
                    <Users className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Aucun client pour le moment</h3>
                  <p className="text-gray-400 font-normal mb-6">Ajoutez votre premier client pour commencer à monitorer son infrastructure.</p>
                  <button onClick={handleAddClient} className="bg-zinc-300 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-zinc-400 transition-colors shadow-sm">
                    <Plus className="w-4 h-4" /> Ajouter un client
                  </button>
                </div>
              ) : (
                <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-sm overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="border-b border-white/5 bg-[#030303]">
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Entreprise</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Contact</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Plan</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Statut</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">CA Généré</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {clients.map(client => (
                        <tr key={client.id} className="hover:bg-white/5/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-white">{client.brand_name}</td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-400">—</td>
                          <td className="px-6 py-4 text-sm"><span className="bg-white/10 text-gray-200 px-3 py-1.5 rounded-lg font-bold border border-white/10">—</span></td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border bg-white/5 text-gray-400 border-white/10 opacity-70 cursor-not-allowed" title="Non disponible avec les données actuelles">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                              —
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-mono font-bold text-white">—</td>
                          <td className="px-6 py-4 text-right">
                            <button className="text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-lg transition-colors"><MoreVertical className="w-5 h-5" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'leads' && (
            <div className="max-w-6xl mx-auto animate-fade-in-up">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Leads Capturés</h2>
                <p className="text-gray-400 font-normal mt-1 flex items-center gap-2"><Sparkles className="w-4 h-4 text-zinc-400" /> Contacts intéressés depuis le simulateur d'Architecture IA sur la landing page.</p>
              </div>

              {dataLoading ? (
                <div className="flex justify-center items-center py-20">
                  <svg className="animate-spin h-8 w-8 text-zinc-300" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </div>
              ) : dataError ? (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2"><AlertCircle className="w-5 h-5 flex-shrink-0" />{dataError}</div>
              ) : leads.length === 0 ? (
                <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-16 text-center shadow-sm flex flex-col items-center">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5">
                    <Users className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Aucun lead pour le moment</h3>
                  <p className="text-gray-400 font-normal mb-6">Patientez jusqu'à ce que de nouveaux prospects soumettent une demande d'Architecture Cible.</p>
                </div>
              ) : (
                <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-sm overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="border-b border-white/5 bg-[#030303]">
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Entreprise</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Email</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Source</th>
                        <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {leads.map(lead => (
                        <tr key={lead.id} className="hover:bg-white/5/50 transition-colors">
                          <td className="px-6 py-4 font-bold text-white">{lead.brand_name}</td>
                          <td className="px-6 py-4 text-sm font-medium text-zinc-300"><a href={`mailto:${lead.email}`} className="hover:underline">{lead.email}</a></td>
                          <td className="px-6 py-4 text-sm"><Badge variant="gray">{lead.source === 'landing_architecture' ? 'Simulateur IA' : lead.source}</Badge></td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-400">
                            {new Date(lead.created_at).toLocaleDateString('fr-FR', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="max-w-6xl mx-auto animate-fade-in-up">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Demandes d'architecture IA</h2>
                <p className="text-gray-400 font-normal">Projets soumis par vos prospects via le widget de la landing page.</p>
              </div>

              {dataLoading ? (
                <div className="flex justify-center items-center py-20">
                  <svg className="animate-spin h-8 w-8 text-zinc-300" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                </div>
              ) : dataError ? (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2"><AlertCircle className="w-5 h-5 flex-shrink-0" />{dataError}</div>
              ) : requestsData.length === 0 ? (
                <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-16 text-center shadow-sm flex flex-col items-center">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5">
                    <Sparkles className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Aucune demande pour le moment</h3>
                  <p className="text-gray-400 font-normal">Les projets soumis par vos clients apparaîtront ici.</p>
                </div>
              ) : (
                <AdminKanbanBoard requests={requestsData} />
              )}
            </div>
          )}

          {activeTab === 'automations' && (
            <div className="max-w-6xl mx-auto text-center py-20 animate-fade-in-up">
              <Database className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">Gestion des Infrastructures</h3>
              <p className="text-gray-400 font-normal max-w-md mx-auto">Cette section vous permettra de connecter l'API n8n pour monitorer tous les workflows actifs de vos clients depuis un seul endroit.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

// ==========================================
// Animated Counter Component
// ==========================================
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

const AnimatedCounter = ({ value, duration = 1.2, suffix = '', className = '' }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const previousValueRef = useRef(0);
  const startTimeRef = useRef(null);
  const requestRef = useRef(null);
  const elementRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !elementRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setHasAnimated(true);
        observer.disconnect();
      }
    }, { threshold: 0.1 });
    observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!hasAnimated) return;
    if (value === 0 && previousValueRef.current === 0) {
      setDisplayValue(0);
      return;
    }
    const startValue = previousValueRef.current;
    const endValue = value;
    const durationMs = duration * 1000;
    const animate = (time) => {
      if (startTimeRef.current === null) startTimeRef.current = time;
      const progressMs = time - startTimeRef.current;
      const progressRatio = Math.min(progressMs / durationMs, 1);
      const easedProgress = easeOutCubic(progressRatio);
      const currentValue = startValue + (endValue - startValue) * easedProgress;
      setDisplayValue(currentValue);
      if (progressRatio < 1) {
        requestRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        previousValueRef.current = endValue;
        startTimeRef.current = null;
      }
    };
    if (startValue !== endValue) {
      startTimeRef.current = null;
      requestRef.current = requestAnimationFrame(animate);
    }
    return () => {
      if (requestRef.current !== null) cancelAnimationFrame(requestRef.current);
    };
  }, [value, duration, hasAnimated]);

  const formattedValue = Math.round(displayValue).toLocaleString('fr-FR');
  return (
    <span ref={elementRef} className={className}>
      {formattedValue}
      {suffix && <span className="text-[0.6em] font-medium text-inherit ml-1 opacity-60 align-baseline">{suffix}</span>}
    </span>
  );
};

// ==========================================
// ACTIVITY FEATURE (DASHBOARD)
// ==========================================
const ActivityModal = ({ log, onClose }) => {
  if (!log) return null;
  const copyId = () => navigator.clipboard.writeText(log.id);
  const timeSavedStr = log.time_saved_seconds ? `${Math.round(log.time_saved_seconds / 60)} min` : '-';
  const revStr = log.revenue_amount ? `${Number(log.revenue_amount).toLocaleString('fr-FR')} €` : '-';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>
      <div className="bg-[#0a0a0a] rounded-2xl w-full max-w-lg relative z-10 shadow-xl overflow-hidden animate-fade-in-up border border-white/10">
        <div className="p-6 md:p-8 flex items-center justify-between border-b border-white/5 bg-[#030303]">
          <h3 className="text-xl font-bold text-white tracking-tight">Détail de l'événement</h3>
          <button onClick={onClose} className="p-2 bg-[#0a0a0a] rounded-full border border-white/10 text-gray-400 hover:bg-white/5 hover:text-white shadow-sm transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 md:p-8 space-y-6">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">ID Événement</p>
            <div className="flex items-center gap-3">
              <code className="bg-white/5 text-gray-400 px-3 py-1.5 rounded-lg text-sm font-mono flex-1 truncate border border-white/5">{log.id}</code>
              <button onClick={copyId} className="p-2 bg-[#0a0a0a] border border-white/10 rounded-lg hover:bg-white/5 text-gray-400 transition-colors shadow-sm" title="Copier l'ID"><Copy className="w-4 h-4" /></button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Date d'exécution</p>
              <p className="font-bold text-white">{new Date(log.created_at).toLocaleString('fr-FR')}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Catégorie</p>
              <Badge variant="gray">{log.event_category || 'N/A'}</Badge>
            </div>
            <div className="col-span-2">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Type de ticket / Source</p>
              <p className="font-bold text-white">{log.ticket_type || 'Standard'}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Temps économisé</p>
              <p className="font-bold text-emerald-600">{timeSavedStr}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Impact (Revenu)</p>
              <p className="font-bold text-amber-600">{revStr}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ActivityView = ({ supabase }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [lastCreatedAt, setLastCreatedAt] = useState(null);

  const [period, setPeriod] = useState('30d');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedLog, setSelectedLog] = useState(null);

  // Derive unique categories and types
  const uniqueCategories = [...new Set(logs.map(l => l.event_category).filter(Boolean))];
  const uniqueTypes = [...new Set(logs.map(l => l.ticket_type).filter(Boolean))];

  const fetchActivity = async (isLoadMore = false) => {
    if (!supabase) return;
    setError('');
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      let query = supabase
        .from('automation_events')
        .select('id, event_category, ticket_type, time_saved_seconds, revenue_amount, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      // Period filter
      if (period !== 'all') {
        const date = new Date();
        if (period === '24h') date.setDate(date.getDate() - 1);
        if (period === '7d') date.setDate(date.getDate() - 7);
        if (period === '30d') date.setDate(date.getDate() - 30);
        query = query.gte('created_at', date.toISOString());
      }

      // Categories and types
      if (categoryFilter !== 'all') query = query.eq('event_category', categoryFilter);
      if (typeFilter !== 'all') query = query.eq('ticket_type', typeFilter);

      // Pagination
      if (isLoadMore && lastCreatedAt) {
        query = query.lt('created_at', lastCreatedAt);
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      const newLogs = data || [];
      if (isLoadMore) {
        setLogs(prev => [...prev, ...newLogs]);
      } else {
        setLogs(newLogs);
      }

      if (newLogs.length === 50) {
        setHasMore(true);
        setLastCreatedAt(newLogs[49].created_at);
      } else {
        setHasMore(false);
      }

    } catch (err) {
      setError(err.message || 'Erreur lors de la récupération des logs.');
    } finally {
      if (isLoadMore) setLoadingMore(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    setLastCreatedAt(null);
    setHasMore(true);
    fetchActivity(false);
  }, [period, categoryFilter, typeFilter]);

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-sm overflow-hidden flex flex-col">
      <div className="p-6 md:p-8 border-b border-white/5 bg-[#030303] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Flux de données récent</h3>
          <p className="text-sm text-gray-400 font-medium mt-1">Historique des actions exécutées par l'infrastructure.</p>
        </div>
        <button onClick={() => fetchActivity(false)} className="text-sm font-bold text-gray-400 hover:text-white flex items-center gap-2 bg-[#0a0a0a] border border-white/10 px-4 py-2 rounded-xl shadow-sm hover:shadow-md transition-all text-nowrap disabled:opacity-50" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading && !loadingMore ? 'animate-spin' : ''}`} /> Rafraîchir
        </button>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 bg-[#0a0a0a] border-b border-white/5 flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-bold text-gray-400">Filtres :</span>
        </div>
        <select value={period} onChange={e => setPeriod(e.target.value)} className="bg-[#0a0a0a] border border-white/10 text-gray-300 text-sm font-medium rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400 outline-none shadow-sm cursor-pointer hover:bg-white/5 transition-colors">
          <option value="24h">Dernières 24h</option>
          <option value="7d">7 derniers jours</option>
          <option value="30d">30 derniers jours</option>
          <option value="all">Tout l'historique</option>
        </select>

        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-[#0a0a0a] border border-white/10 text-gray-300 text-sm font-medium rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400 outline-none max-w-[200px] truncate shadow-sm cursor-pointer hover:bg-white/5 transition-colors">
          <option value="all">Toutes les catégories</option>
          {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>

        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="bg-[#0a0a0a] border border-white/10 text-gray-300 text-sm font-medium rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400 outline-none max-w-[200px] truncate shadow-sm cursor-pointer hover:bg-white/5 transition-colors">
          <option value="all">Tous les types</option>
          {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="py-4 relative min-h-[300px]">
        {error ? (
          <div className="p-10 flex flex-col items-center justify-center text-center">
            <AlertCircle className="w-10 h-10 text-red-500 mb-4" />
            <p className="text-red-700 font-bold mb-1">Erreur de connexion</p>
            <p className="text-sm text-red-500 font-medium">{error}</p>
          </div>
        ) : loading && logs.length === 0 ? (
          <div className="p-6 md:p-8 space-y-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 items-start">
                <SkeletonRow height="h-10" width="w-10" className="rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-3 pt-1">
                  <SkeletonRow height="h-4" width="w-1/4" />
                  <SkeletonRow height="h-3" width="w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5">
              <Activity className="w-10 h-10 text-gray-300" />
            </div>
            <p className="text-white font-bold text-xl mb-2">Aucune activité trouvée</p>
            <p className="text-gray-400 font-medium">Réessayez en modifiant vos filtres.</p>
          </div>
        ) : (
          <>
            <div className="relative border-l border-white/10 ml-6 md:ml-10 my-4 py-2 space-y-4">
              {logs.map((log) => {
                const savedTime = log.time_saved_seconds ? `${Math.round(log.time_saved_seconds / 60)}m` : '';
                const revenue = log.revenue_amount ? `${Number(log.revenue_amount).toLocaleString('fr-FR')}€` : '';

                return (
                  <div key={log.id} onClick={() => setSelectedLog(log)} className="relative pl-6 md:pl-8 pr-6 md:pr-10 group cursor-pointer animate-fade-in-up">
                    <div className="absolute left-[-5px] top-6 w-2.5 h-2.5 rounded-full bg-gray-200 ring-4 ring-white group-hover:bg-zinc-400 group-hover:ring-zinc-800 transition-all"></div>
                    <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-xl shadow-sm hover:shadow-md hover:border-white/10 transition-all flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          {log.event_category && <Badge variant="gray">{log.event_category}</Badge>}
                          <span className="text-xs font-medium text-gray-400">{new Date(log.created_at).toLocaleString('fr-FR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-base font-bold text-white truncate mb-2 leading-snug">
                          {log.ticket_type || "Exécution standard du flux"}
                        </p>
                        <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-gray-400">
                          {savedTime && <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md"><Clock className="w-3.5 h-3.5" /> <span className="text-[10px] uppercase font-bold tracking-widest opacity-80">Gagnées:</span> {savedTime}</span>}
                          {revenue && <span className="flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md"><DollarSign className="w-3.5 h-3.5" /> <span className="text-[10px] uppercase font-bold tracking-widest opacity-80">Impact:</span> {revenue}</span>}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-gray-300 group-hover:text-zinc-300 transition-colors mt-2">
                        <ArrowRight className="w-5 h-5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="p-6 md:p-8 flex justify-center border-t border-white/5 bg-[#030303]">
                <button
                  onClick={() => fetchActivity(true)}
                  disabled={loadingMore}
                  className="bg-[#0a0a0a] border border-white/10 text-gray-300 font-bold px-6 py-3 rounded-xl hover:text-white hover:border-gray-300 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {loadingMore ? <span className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></span> : "Charger les événements précédents"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedLog && <ActivityModal log={selectedLog} onClose={() => setSelectedLog(null)} />}
    </div>
  );
};

// ==========================================
// INTELLIGENCE FEATURE START
// ==========================================
// === EXECUTION PLAN DRAWER START ===
const ExecutionPlanDrawer = ({ reco, onClose, onImplement, supabase, onNavigateToActivity }) => {
  const [loading, setLoading] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [recentEvents, setRecentEvents] = useState([]);

  // Fetch contextual events only if implementation has started
  useEffect(() => {
    let interval;
    if (startedAt) {
      const fetchRecentEvents = async () => {
        const { data } = await supabase
          .from('automation_events')
          .select('id, event_category, ticket_type, created_at, time_saved_seconds')
          .gte('created_at', startedAt)
          .order('created_at', { ascending: false })
          .limit(10);
        if (data) setRecentEvents(data);
      };

      fetchRecentEvents();
      interval = setInterval(fetchRecentEvents, 5000);
    }
    return () => clearInterval(interval);
  }, [startedAt, supabase]);

  const handleImplementClick = async () => {
    setLoading(true);
    await onImplement(reco.id, 'implemented');
    setStartedAt(new Date().toISOString());
    setLoading(false);
  };

  if (!reco) return null;

  // Generate copy steps based on category (pure UI copy, no mocked business data)
  const steps = {
    growth: [
      { title: "Acquisition", desc: "Configuration des nouveaux canaux d'acquisition ciblés." },
      { title: "Conversion", desc: "Déploiement des stratégies d'optimisation du taux de conversion." },
      { title: "Analyse", desc: "Mise en place des trackers de performance de croissance." }
    ],
    efficiency: [
      { title: "Analyse des processus", desc: "Identification des goulots d'étranglement actuels." },
      { title: "Automatisation", desc: "Connexion et automatisation des flux de travail chronophages." },
      { title: "Monitoring", desc: "Surveillance continue des gains d'efficacité." }
    ],
    risk: [
      { title: "Audit de sécurité", desc: "Identification des failles et vulnérabilités potentielles." },
      { title: "Mise en place de garde-fous", desc: "Déploiement des règles de mitigation des risques." },
      { title: "Alerting", desc: "Configuration des notifications d'anomalies en temps réel." }
    ],
    automation: [
      { title: "Cartographie du workflow", desc: "Définition des déclencheurs et actions automatisées." },
      { title: "Intégrations requises", desc: "Connexion sécurisée aux outils tiers." },
      { title: "Assurance Qualité (QA)", desc: "Tests approfondis des scénarios d'automatisation." }
    ],
    all: [
      { title: "Initialisation", desc: "Préparation de l'environnement d'exécution." },
      { title: "Déploiement", desc: "Mise en oeuvre des recommandations de l'IA." },
      { title: "Surveillance", desc: "Suivi des impacts post-déploiement." }
    ]
  };

  const planSteps = steps[reco.category] || steps.all;
  const isStarted = !!startedAt;

  return (
    <>
      {/* Backdrop overlay */}
      <div className="fixed inset-0 z-50 bg-gray-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full md:w-[540px] bg-[#0a0a0a] shadow-2xl flex flex-col transform transition-transform duration-300 translate-x-0 overflow-y-auto border-l border-white/10">

        {/* Header */}
        <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#0a0a0a]/90 backdrop-blur z-10">
          <div className="flex items-center gap-3 text-white font-bold">
            <Sparkles className="w-5 h-5 text-zinc-300" />
            <h2 className="text-xl tracking-tight">Plan d'exécution IA</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-white/5 border border-white/10 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors shadow-sm">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8 flex-1 flex flex-col gap-8 animate-fade-in-up font-light text-gray-400">

          {/* Section A: Résumé */}
          <section>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/10 text-gray-400 border border-white/10 mb-4 inline-block uppercase tracking-widest">
              Contexte de l'action
            </span>
            <h3 className="text-2xl font-bold text-white mb-2 leading-tight tracking-tight">{reco.title}</h3>
            <p className="text-sm font-normal text-gray-400 leading-relaxed mb-6">{reco.description}</p>

            <div className="flex gap-4 p-5 rounded-2xl bg-[#030303] border border-white/5">
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Score d'impact IA</p>
                <span className="text-2xl font-black text-white">{reco.impact_score}<span className="text-sm font-bold text-gray-400">/100</span></span>
              </div>
              <div className="w-px bg-gray-200"></div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Catégorie</p>
                <span className="text-sm font-bold text-white capitalize">{reco.category}</span>
              </div>
            </div>
          </section>

          {/* Section B: Gains */}
          {((reco.estimated_time_gain_minutes > 0) || (reco.estimated_revenue_gain > 0)) && (
            <section>
              <h4 className="text-xs font-bold text-gray-400 mb-4 uppercase tracking-widest">Gains Stratégiques Estimés</h4>
              <div className="grid grid-cols-2 gap-4">
                {reco.estimated_time_gain_minutes > 0 && (
                  <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-xl flex flex-col">
                    <Clock className="w-5 h-5 text-emerald-500 mb-2" />
                    <span className="text-xl font-bold text-emerald-700">+{Math.round(reco.estimated_time_gain_minutes / 60)}h<span className="text-sm font-normal text-emerald-600">/mois</span></span>
                  </div>
                )}
                {reco.estimated_revenue_gain > 0 && (
                  <div className="bg-amber-50/50 border border-amber-100 p-4 rounded-xl flex flex-col">
                    <TrendingUp className="w-5 h-5 text-amber-500 mb-2" />
                    <span className="text-xl font-bold text-amber-700">+{Number(reco.estimated_revenue_gain).toLocaleString('fr-FR')}€</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Section D: Étapes Copy UI */}
          <section className="relative">
            <h4 className="text-xs font-bold text-gray-400 mb-6 uppercase tracking-widest">Protocoles d'implémentation</h4>
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-px before:bg-gradient-to-b before:from-gray-200 before:to-transparent">
              {planSteps.map((step, idx) => (
                <div key={idx} className="relative flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-[#0a0a0a] border border-white/10 flex items-center justify-center flex-shrink-0 z-10 text-gray-400 font-bold text-sm shadow-sm mt-1">
                    {idx + 1}
                  </div>
                  <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-2xl flex-1 shadow-sm mt-1">
                    <h5 className="font-bold text-white mb-1 leading-tight">{step.title}</h5>
                    <p className="text-sm font-normal text-gray-400 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section: Timeline Contextuelle (Après clic implémenter) */}
          {isStarted && (
            <section className="mt-4 bg-gray-900 rounded-3xl p-6 text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4">
                <span className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/20">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Realtime
                </span>
              </div>
              <h4 className="text-lg font-bold mb-2">Exécution en cours</h4>
              <p className="text-sm text-gray-400 font-normal mb-6">Les agents parcourent l'infrastructure actuellement.</p>

              {recentEvents.length === 0 ? (
                <div className="py-8 text-center flex flex-col items-center">
                  <RefreshCw className="w-6 h-6 text-gray-400 animate-spin mb-3" />
                  <p className="text-sm font-bold text-gray-400">En attente des premiers signaux n8n...</p>
                </div>
              ) : (
                <div className="space-y-3 mb-6">
                  {recentEvents.map((evt, i) => (
                    <div key={i} className="bg-[#0a0a0a]/5 border border-white/10 p-3 rounded-xl flex items-center justify-between text-sm animate-fade-in-up">
                      <div className="flex items-center gap-3">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold text-gray-200">{evt.event_category} / {evt.ticket_type}</span>
                      </div>
                      <span className="text-xs text-gray-400 font-medium">Il y a quelques secondes</span>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => { onClose(); onNavigateToActivity(); }}
                className="w-full bg-[#0a0a0a] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
              >
                Voir l'activité en direct <ArrowRight className="w-4 h-4" />
              </button>
            </section>
          )}

        </div>

        {/* Footer actions */}
        {!isStarted && (
          <div className="p-6 md:p-8 border-t border-white/10 bg-[#030303] flex flex-col sm:flex-row gap-3 sticky bottom-0 z-10">
            <button
              disabled={loading}
              onClick={handleImplementClick}
              className="flex-1 bg-zinc-300 text-white font-bold py-3.5 px-6 rounded-xl hover:bg-zinc-400 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <span className="animate-spin w-5 h-5 border-2 border-white/20 border-t-white rounded-full"></span> : <Bot className="w-5 h-5" />}
              Implémenter maintenant
            </button>
            <button
              disabled={loading}
              onClick={onClose}
              className="flex-1 sm:flex-none bg-[#0a0a0a] text-gray-400 font-bold py-3.5 px-6 rounded-xl border border-white/10 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        )}
      </div>
    </>
  );
};
// === EXECUTION PLAN DRAWER END ===

const RecommendationCard = ({ reco, onAction, onOpenPlan }) => {
  const [loadingAction, setLoadingAction] = useState(false);

  const handleAction = async (status) => {
    setLoadingAction(true);
    await onAction(reco.id, status);
    setLoadingAction(false);
  };

  const priorityVariants = {
    high: 'red',
    medium: 'amber',
    low: 'emerald'
  };

  const categoryLabels = {
    growth: 'Croissance',
    efficiency: 'Efficacité',
    risk: 'Risque',
    automation: 'Automatisation',
    all: 'Toutes les catégories'
  };

  const impactColor = reco.impact_score >= 80 ? 'bg-emerald-500' : reco.impact_score >= 50 ? 'bg-amber-500' : 'bg-gray-400';

  return (
    <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col gap-6 transition-all hover:shadow-md relative overflow-hidden group">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge variant={priorityVariants[reco.priority_level] || 'amber'}>
              Priorité {reco.priority_level === 'high' ? 'Haute' : reco.priority_level === 'medium' ? 'Moyenne' : 'Basse'}
            </Badge>
            {reco.category && (
              <Badge variant="gray">
                {categoryLabels[reco.category] || reco.category}
              </Badge>
            )}
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-auto md:ml-0">
              {new Date(reco.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </span>
          </div>
          <h4 className="text-xl font-bold text-white mb-2 leading-tight tracking-tight">{reco.title}</h4>
          <p className="text-sm font-medium text-gray-400 line-clamp-2 md:line-clamp-none leading-relaxed mb-6">{reco.description}</p>

          <div className="flex flex-wrap items-center gap-6 mb-2">
            <div className="flex items-center gap-3 bg-white/5 px-3 py-2 rounded-xl border border-white/5">
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none mb-1">Impact</p>
                <span className="text-sm font-bold text-white leading-none">{reco.impact_score}/100</span>
              </div>
              <div className="h-8 w-px bg-gray-200"></div>
              <div className="h-1.5 w-16 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                <div className={`h-full rounded-full ${impactColor}`} style={{ width: `${Math.min(100, reco.impact_score)}%` }}></div>
              </div>
            </div>

            {reco.estimated_time_gain_minutes > 0 && (
              <div className="flex flex-col justify-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Gain de temps</p>
                <p className="text-sm font-bold text-emerald-600 flex items-center gap-1">
                  <Clock className="w-4 h-4" /> +{Math.round(reco.estimated_time_gain_minutes / 60)}h/mois
                </p>
              </div>
            )}
            {reco.estimated_revenue_gain > 0 && (
              <div className="flex flex-col justify-center">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Impact CA</p>
                <p className="text-sm font-bold text-amber-600 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" /> +{Number(reco.estimated_revenue_gain).toLocaleString('fr-FR')}€
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {reco.status === 'active' && (
        <div className="pt-6 border-t border-white/5 flex flex-wrap items-center gap-3">
          <button
            disabled={loadingAction}
            onClick={() => handleAction('implemented')}
            className="flex-1 lg:flex-none text-sm font-bold bg-zinc-300 text-white px-5 py-2.5 rounded-xl hover:bg-zinc-400 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loadingAction ? <span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full"></span> : <CheckCircle className="w-4 h-4" />} Implémenter
          </button>
          {onOpenPlan && (
            <button
              disabled={loadingAction}
              onClick={() => onOpenPlan(reco)}
              className="flex-1 lg:flex-none text-sm font-bold bg-[#0a0a0a] text-gray-300 border border-white/10 px-5 py-2.5 rounded-xl hover:text-white hover:bg-white/5 transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              Voir le plan <ArrowRight className="w-4 h-4 text-gray-400" />
            </button>
          )}
          <button
            disabled={loadingAction}
            onClick={() => handleAction('dismissed')}
            className="flex-1 lg:flex-none text-sm font-bold bg-[#0a0a0a] text-gray-400 border border-transparent px-4 py-2.5 rounded-xl hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 lg:ml-auto"
          >
            {loadingAction ? <span className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"></span> : <XCircle className="w-4 h-4" />} Ignorer
          </button>
        </div>
      )}
      {reco.status !== 'active' && (
        <div className="pt-5 border-t border-white/5 flex items-center gap-2 text-sm font-bold text-gray-400">
          <CheckCircle className="w-4 h-4" /> {reco.status === 'implemented' ? 'Marqué comme implémenté' : 'Recommandation ignorée'}
        </div>
      )}
    </div>
  );
};

const IntelligenceView = ({ supabase, setActiveTab }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState('active');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState('impact'); // impact or recent
  const [actionError, setActionError] = useState('');

  // Execution Plan Drawer state
  const [selectedPlanReco, setSelectedPlanReco] = useState(null);

  const fetchRecommendations = async () => {
    if (!supabase) return;
    setLoading(true);
    setError('');
    setActionError('');
    try {
      let query = supabase
        .from('ai_recommendations')
        .select('id, client_id, title, description, category, priority_level, impact_score, estimated_time_gain_minutes, estimated_revenue_gain, status, created_at, updated_at, expires_at')
        .eq('status', statusFilter)
        .limit(50);

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      if (sortBy === 'impact') {
        query = query.order('impact_score', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      const { data, error: fetchErr } = await query;
      if (fetchErr) throw fetchErr;

      setRecommendations(data || []);
    } catch (err) {
      setError(err.message || 'Erreur lors de la récupération des recommandations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecommendations();
  }, [statusFilter, categoryFilter, sortBy]);

  const handleAction = async (id, newStatus) => {
    try {
      setActionError('');
      // Call RPC only (no fallback to update the table directly)
      const { error: rpcErr } = await supabase.rpc('mark_ai_recommendation', { p_id: id, p_status: newStatus });

      if (rpcErr) {
        throw rpcErr;
      }

      // Success, remove from active list if filter is active
      if (statusFilter === 'active') {
        setRecommendations(prev => prev.filter(r => r.id !== id));
      } else {
        // Just refresh list
        await fetchRecommendations();
      }
    } catch (err) {
      setActionError(err.message || 'Une erreur est survenue lors de la mise à jour.');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <div className="p-6 md:p-8 border-b border-white/5 bg-gradient-to-r from-zinc-900 to-zinc-800 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-[#0a0a0a]/10 rounded-xl backdrop-blur-md border border-white/10 shadow-sm">
                <Lightbulb className="w-5 h-5 text-amber-300" />
              </div>
              <h3 className="text-xl font-bold tracking-tight">Intelligence & Recommandations</h3>
            </div>
            <p className="text-sm text-zinc-300 font-medium max-w-xl">L'IA analyse vos flux de données en continu pour identifier des optimisations de croissance, d'efficacité et des correctifs applicatifs.</p>
          </div>
          <button onClick={() => fetchRecommendations()} disabled={loading} className="text-sm font-bold text-white bg-[#0a0a0a] hover:bg-zinc-100 px-4 py-2 rounded-xl shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Rafraîchir
          </button>
        </div>

        <div className="px-6 py-4 bg-[#0a0a0a] border-b border-white/5 flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-500" />
            <span className="text-sm font-bold text-zinc-600">Filtrer par :</span>
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-white/5 border border-white/10 text-zinc-700 text-sm font-bold rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-zinc-900 outline-none">
            <option value="active">À traiter</option>
            <option value="implemented">Implémentées</option>
            <option value="dismissed">Ignorées</option>
          </select>

          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-white/5 border border-white/10 text-zinc-700 text-sm font-bold rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-zinc-900 outline-none">
            <option value="all">Toutes les catégories</option>
            <option value="growth">Croissance</option>
            <option value="efficiency">Efficacité</option>
            <option value="risk">Risque</option>
            <option value="automation">Automatisation</option>
          </select>

          <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="bg-white/5 border border-white/10 text-zinc-700 text-sm font-bold rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-zinc-900 outline-none ml-auto">
            <option value="impact">Trier par: Impact (Haut &rarr; Bas)</option>
            <option value="recent">Trier par: Plus récentes</option>
          </select>
        </div>
      </div>

      {actionError && (
        <div className="p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-start gap-3 animate-pulse">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{actionError}</p>
        </div>
      )}

      {error ? (
        <div className="p-10 bg-[#0a0a0a] border border-red-100 rounded-3xl flex flex-col items-center justify-center text-center shadow-sm">
          <AlertCircle className="w-10 h-10 text-red-400 mb-4" />
          <p className="text-red-900 font-bold mb-1">Erreur de connexion</p>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : loading && recommendations.length === 0 ? (
        <div className="space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-6 shadow-sm animate-pulse h-48 flex flex-col gap-4">
              <div className="h-6 bg-zinc-100 rounded w-1/4"></div>
              <div className="h-4 bg-zinc-100 rounded w-3/4 mt-2"></div>
              <div className="h-4 bg-zinc-100 rounded w-1/2"></div>
              <div className="mt-auto flex gap-4">
                <div className="h-10 bg-zinc-100 rounded w-32"></div>
                <div className="h-10 bg-zinc-100 rounded w-32"></div>
              </div>
            </div>
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-16 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center">
          <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 border border-emerald-100">
            <Lightbulb className="w-10 h-10 text-emerald-400" />
          </div>
          <p className="text-white font-bold text-xl mb-2">Tout est optimisé</p>
          <p className="text-zinc-500 font-medium max-w-md">L'IA n'a pas de nouvelle recommandation à proposer pour le moment avec ces critères de recherche.</p>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in-up">
          {recommendations.map((reco) => (
            <RecommendationCard
              key={reco.id}
              reco={reco}
              onAction={handleAction}
              onOpenPlan={setSelectedPlanReco}
            />
          ))}
        </div>
      )}

      {selectedPlanReco && (
        <ExecutionPlanDrawer
          reco={selectedPlanReco}
          supabase={supabase}
          onClose={() => setSelectedPlanReco(null)}
          onImplement={handleAction}
          onNavigateToActivity={() => setActiveTab('activity')}
        />
      )}
    </div>
  );
};
// ==========================================
// INTELLIGENCE FEATURE END
// ==========================================

// ==========================================
// 3. DASHBOARD USER (CLIENT)
// ==========================================
const ClientDashboard = ({ onNavigate, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [currentClient, setCurrentClient] = useState(null);
  const [requests, setRequests] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Project submission state
  const [projectTitle, setProjectTitle] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectStack, setProjectStack] = useState('');
  const [projectPriority, setProjectPriority] = useState('normal');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    const fetchClientData = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError('');
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const session = sessionData?.session;
        if (sessionError || !session) {
          onNavigate('/login');
          return;
        }

        const { data: clientRecord, error: clientErr } = await supabase
          .from('clients')
          .select('id, brand_name, owner_user_id, created_at')
          .eq('owner_user_id', session.user.id)
          .single();

        if (clientErr && clientErr.code !== 'PGRST116') {
          throw clientErr;
        }

        if (clientRecord) {
          setCurrentClient(clientRecord);
          // Fetch requests
          const { data: requestsData, error: reqErr } = await supabase
            .from('requests')
            .select('*')
            .eq('client_id', clientRecord.id)
            .order('created_at', { ascending: false });

          if (reqErr) throw reqErr;
          setRequests(requestsData || []);

          // Fetch Metrics via RPC
          setMetricsLoading(true);
          const { data: metricsData, error: metricsErr } = await supabase
            .rpc('recompute_client_metrics', { p_client_id: clientRecord.id });

          if (metricsErr && metricsErr.code !== 'PGRST116') {
            console.error(metricsErr);
            setMetricsError('Impossible de charger les métriques.');
          } else {
            setMetrics(metricsData);
          }
          setMetricsLoading(false);

        } else {
          setCurrentClient(null);
        }
      } catch (err) {
        setError(err.message || 'Erreur lors du chargement des données.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchClientData();
  }, [onNavigate]);

  // Polling metrics every 30s using RPC
  useEffect(() => {
    if (!currentClient || !isSupabaseConfigured) return;

    const intervalId = setInterval(async () => {
      try {
        const { data: metricsData, error: metricsErr } = await supabase
          .rpc('recompute_client_metrics', { p_client_id: currentClient.id });
        if (!metricsErr && metricsData) {
          setMetrics(metricsData);
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [currentClient, isSupabaseConfigured]);

  const handleSubmitProject = async (e) => {
    e.preventDefault();
    if (!currentClient || !projectTitle || !projectDesc) return;

    setIsSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);

    try {
      const { error: insertErr } = await supabase.from('requests').insert({
        client_id: currentClient.id,
        title: projectTitle,
        description: projectDesc,
        stack: projectStack,
        priority: projectPriority,
        status: 'en_attente'
      });

      if (insertErr) throw insertErr;

      setSubmitSuccess(true);
      setProjectTitle('');
      setProjectDesc('');
      setProjectStack('');
      setProjectPriority('normal');

      // Refresh requests
      const { data: requestsData, error: reqErr } = await supabase
        .from('requests')
        .select('*')
        .eq('client_id', currentClient.id)
        .order('created_at', { ascending: false });

      if (!reqErr && requestsData) {
        setRequests(requestsData);
      }

      setTimeout(() => {
        setActiveTab('requests');
        setSubmitSuccess(false);
      }, 2000);

    } catch (err) {
      setSubmitError(err.message || 'Erreur lors de la soumission du projet.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSupabaseConfigured && isLoading) {
    return (
      <div className="min-h-screen bg-[#030303] flex items-center justify-center">
        <svg className="animate-spin h-10 w-10 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
      </div>
    );
  }



  const Sidebar = () => (
    <div className="w-full md:w-64 bg-[#0a0a0a] border-r border-white/10 flex flex-col h-full">
      <div className="h-16 flex items-center px-6 border-b border-white/10 justify-between md:justify-start">
        <div className="flex items-center gap-2">
          <Logo className="w-6 h-6 text-white" />
          <span className="font-bold text-lg text-white">Actero OS</span>
        </div>
        <button className="md:hidden text-zinc-500" onClick={() => setIsMobileMenuOpen(false)}><X className="w-5 h-5" /></button>
      </div>
      <div className="flex-1 py-6 px-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 mt-2">Pilotage</div>
        <button onClick={() => { setActiveTab('overview'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'overview' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}><LayoutDashboard className="w-4 h-4" /> Vue d'ensemble</button>
        <button onClick={() => { setActiveTab('requests'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'requests' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
          <div className="flex items-center gap-3"><ClipboardList className="w-4 h-4" /> Requêtes</div>
          {requests.length > 0 && <span className="bg-emerald-100 text-emerald-700 py-0.5 px-2 rounded-full text-xs font-bold">{requests.length}</span>}
        </button>
        <button onClick={() => { setActiveTab('architect'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'architect' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}><BrainCircuit className="w-4 h-4" /> Architecte IA</button>

        <div className="px-3 text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 mt-6">Infrastructure</div>
        <button onClick={() => { setActiveTab('systems'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'systems' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}><Database className="w-4 h-4" /> Mes Systèmes</button>
        <button onClick={() => { setActiveTab('activity'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'activity' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}><Activity className="w-4 h-4" /> Activité en direct</button>
        <button onClick={() => { setActiveTab('intelligence'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'intelligence' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}><Lightbulb className="w-4 h-4" /> Intelligence</button>
        <button onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition-colors ${activeTab === 'reports' ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}><Download className="w-4 h-4" /> Rapports</button>
      </div>
      <div className="p-4 border-t border-white/10">
        <button onClick={onLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:bg-white/5 hover:text-white transition-colors"><LogOut className="w-4 h-4" /> Déconnexion</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#030303] flex flex-col md:flex-row font-sans">
      {/* Mobile Header */}
      <div className="md:hidden h-16 bg-[#0a0a0a] border-b border-white/10 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Logo className="w-6 h-6 text-white" />
          <span className="font-bold text-lg text-white">Actero OS</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(true)} className="text-zinc-600"><Menu className="w-6 h-6" /></button>
      </div>

      {/* Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}></div>
          <div className="relative w-4/5 max-w-xs bg-[#0a0a0a] h-full shadow-2xl">
            <Sidebar />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Command Center Sticky Header */}
        <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/10 px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-bold text-white tracking-tight whitespace-nowrap">
              {activeTab === 'overview' && "Vue d'ensemble"}
              {activeTab === 'requests' && "Mes demandes"}
              {activeTab === 'architect' && "Architecte IA"}
              {activeTab === 'activity' && "Activité temps réel"}
              {activeTab === 'systems' && "Mes Systèmes"}
              {activeTab === 'reports' && "Rapports & Exports"}
              {activeTab === 'intelligence' && "Intelligence"}
            </h1>

            <div className="hidden lg:flex items-center gap-3">
              <Badge variant="emerald" className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                Opérationnel
              </Badge>
              <div className="h-4 w-px bg-gray-200 mx-1"></div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-bold text-white"><AnimatedCounter value={metrics ? Math.round(metrics.time_saved_minutes / 60) : 0} />h <span className="text-gray-400 font-medium font-normal">/mois</span></span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
                <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-bold text-white"><AnimatedCounter value={metrics?.estimated_roi || 0} />€ <span className="text-gray-400 font-medium font-normal">/mois</span></span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
                <Activity className="w-3.5 h-3.5 text-zinc-300" />
                <span className="text-xs font-bold text-white"><AnimatedCounter value={metrics?.active_automations || 0} /> <span className="text-gray-400 font-medium font-normal">actifs</span></span>
              </div>
            </div>
          </div>

          <button onClick={() => setActiveTab('activity')} className="text-sm font-bold text-gray-400 hover:text-zinc-300 flex items-center gap-2 transition-colors">
            Voir l'activité <ArrowRight className="w-4 h-4" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">

          {activeTab === 'overview' && (
            <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
              <div>
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Bonjour{currentClient ? ` ${currentClient.brand_name}` : ""}, voici vos performances.</h2>
                <p className="text-zinc-500 font-medium text-lg">Synthèse des 30 derniers jours.</p>
              </div>

              {!metricsLoading && metrics && <MilestoneBadge hoursSaved={Math.round(metrics.time_saved_minutes / 60)} />}

              {metricsLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-[#0a0a0a] p-6 rounded-2xl border border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-pulse flex flex-col justify-between h-40">
                      <div className="flex items-center gap-3">
                        <SkeletonRow height="h-10" width="w-10" className="rounded-xl flex-shrink-0" />
                        <div className="flex-1">
                          <SkeletonRow height="h-3" width="w-2/3" className="mb-2" />
                          <SkeletonRow height="h-3" width="w-1/3" />
                        </div>
                      </div>
                      <SkeletonRow height="h-8" width="w-1/2" />
                    </div>
                  ))}
                </div>
              ) : metricsError ? (
                <div className="p-5 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-base font-bold text-red-900">Indisponibilité des services</h3>
                    <p className="text-sm text-red-700 mt-1 font-medium">{metricsError}</p>
                  </div>
                </div>
              ) : !metrics || (metrics.active_automations === 0 && metrics.tasks_executed === 0 && metrics.time_saved_minutes === 0 && metrics.estimated_roi === 0) ? (
                <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-16 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5">
                    <Activity className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Metrics à venir</h3>
                  <p className="text-gray-400 font-normal">Les premières métriques apparaîtront bientôt dès que vos workflows seront pleinement opérationnels.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <StatCard
                    title="Temps économisé"
                    value={<AnimatedCounter value={Math.round(metrics.time_saved_minutes / 60)} suffix="h" />}
                    icon={Clock}
                    color="emerald"
                    subtitleItems={["Équivalent en temps humain", "Ce mois-ci"]}
                  />
                  <StatCard
                    title="ROI Généré"
                    value={<AnimatedCounter value={metrics.estimated_roi} suffix="€" />}
                    icon={DollarSign}
                    color="amber"
                    subtitleItems={["Valeur métier estimée"]}
                  />
                  <StatCard
                    title="Automatisations actives"
                    value={<AnimatedCounter value={metrics.active_automations} />}
                    icon={Activity}
                    color="emerald"
                    subtitleItems={["Workflows surveillés 24/7"]}
                  />
                  <StatCard
                    title="Tâches automatisées"
                    value={<AnimatedCounter value={metrics.tasks_executed} />}
                    icon={TerminalSquare}
                    color="zinc"
                    subtitleItems={["Actions réussies", "Ce mois-ci"]}
                  />
                </div>
              )}

              {/* Advanced Dashboard Widgets */}
              {!metricsLoading && !metricsError && metrics && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                  <div className="h-[400px]">
                    <LiveLogFeed />
                  </div>
                  <div className="h-[400px]">
                    <ROIGlowChart />
                  </div>
                </div>
              )}

              {/* Support CTA */}
              <div className="bg-zinc-900 rounded-3xl p-8 md:p-10 mt-12 flex flex-col md:flex-row items-center justify-between shadow-xl">
                <div className="mb-6 md:mb-0 text-center md:text-left">
                  <h3 className="text-2xl font-bold text-white mb-2">Un besoin d'évolution ?</h3>
                  <p className="text-zinc-500 font-medium">Vous souhaitez ajouter un nouveau processus à votre infrastructure ?</p>
                </div>
                <button onClick={() => setActiveTab('architect')} className="bg-white text-black px-6 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors shadow-sm w-full md:w-auto">
                  Consulter l'Architecte IA <ArrowUpRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="max-w-4xl mx-auto animate-fade-in-up">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Mes demandes d'architecture</h2>
                <p className="text-zinc-500 font-medium">Suivez l'état d'avancement de vos projets d'automatisation.</p>
              </div>

              {error ? (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2"><AlertCircle className="w-5 h-5 flex-shrink-0" />{error}</div>
              ) : requests.length === 0 ? (
                <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-16 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5">
                    <FileText className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Aucune demande pour l'instant</h3>
                  <p className="text-gray-400 font-normal mb-6">Soumettez votre premier projet à notre équipe d'architectes IA.</p>
                  <button onClick={() => setActiveTab('architect')} className="bg-zinc-300 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-zinc-400 transition-colors shadow-sm">
                    <Plus className="w-4 h-4" /> Soumettre un projet
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {requests.map(req => (
                    <div key={req.id} className="bg-[#0a0a0a] border border-white/10 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden flex flex-col md:flex-row">
                      <div className="p-8 md:w-1/3 border-b md:border-b-0 md:border-r border-white/5 bg-[#030303]">
                        <div className="flex items-center justify-between mb-6">
                          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-lg border border-amber-200">{req.status || "En attente"}</span>
                          <span className="text-xs text-zinc-500 font-bold">{new Date(req.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-1">Impact estimé :</p>
                        <p className="text-base text-emerald-600 font-bold flex items-center gap-1"><Clock className="w-4 h-4" /> ~{req.timeSaved || "N/A"}</p>
                      </div>
                      <div className="p-8 md:w-2/3">
                        <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">{req.title || "Projet IA"}</h3>
                        <p className="text-base font-medium text-zinc-600 mb-6 pb-6 border-b border-white/5 leading-relaxed">{req.description || req.diagnosis}</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {req.stack && <span className="bg-zinc-100 text-zinc-700 text-xs font-bold px-3 py-1 rounded-lg border border-white/10">Stack : {req.stack}</span>}
                          {req.priority && <span className="bg-zinc-800 text-zinc-400 text-xs font-bold px-3 py-1 rounded-lg border border-zinc-600">Priorité : {req.priority}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'architect' && (
            <div className="max-w-3xl mx-auto animate-fade-in-up">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Architecte IA</h2>
                <p className="text-zinc-500 font-medium tracking-tight leading-relaxed">Décrivez votre besoin d'automatisation. Nos experts concevront une architecture sur mesure pour vous faire gagner de la bande passante.</p>
              </div>

              <form onSubmit={handleSubmitProject} className="bg-[#0a0a0a] border border-white/10 p-8 md:p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-6">
                {submitSuccess && <div className="p-4 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 flex items-center gap-2"><CheckCircle2 className="w-5 h-5 flex-shrink-0" /> Projet soumis avec succès ! Vous serez contacté très prochainement.</div>}
                {submitError && <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 flex items-center gap-2"><AlertCircle className="w-5 h-5 flex-shrink-0" /> {submitError}</div>}

                <div>
                  <label className="block text-sm font-bold text-white mb-2">Titre du projet <span className="text-emerald-500">*</span></label>
                  <input required value={projectTitle} onChange={e => setProjectTitle(e.target.value)} type="text" className="w-full bg-[#030303] border border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-all font-medium" placeholder="Ex: Relance automatique des factures impayées" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-white mb-2">Objectif & Contexte <span className="text-emerald-500">*</span></label>
                  <textarea required value={projectDesc} onChange={e => setProjectDesc(e.target.value)} rows="5" className="w-full bg-[#030303] border border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-all font-medium leading-relaxed" placeholder="Décrivez le processus chronophage que vous souhaitez automatiser. Indiquez la perte de temps ou d'argent pour nous aider à évaluer le ROI potentiel..."></textarea>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-white mb-2">Outils existants (Stack) <span className="text-zinc-500 font-normal">(Optionnel)</span></label>
                    <input value={projectStack} onChange={e => setProjectStack(e.target.value)} type="text" className="w-full bg-[#030303] border border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-all font-medium" placeholder="Ex: Shopify, Klaviyo, Stripe..." />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-white mb-2">Priorité <span className="text-emerald-500">*</span></label>
                    <div className="relative">
                      <select value={projectPriority} onChange={e => setProjectPriority(e.target.value)} className="w-full bg-[#030303] border border-white/10 rounded-xl py-3 px-4 appearance-none outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-all font-medium text-zinc-700">
                        <option value="low">Basse (Pas d'urgence)</option>
                        <option value="normal">Normale (D'ici quelques semaines)</option>
                        <option value="high">Haute (Impact immédiat attendu)</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="pt-2 border-t border-white/5 flex justify-end">
                  <button disabled={isSubmitting || submitSuccess} type="submit" className="w-full md:w-auto mt-4 px-8 bg-white text-zinc-900 rounded-xl py-4 font-bold hover:bg-zinc-800 disabled:opacity-50 transition-colors shadow-sm inline-flex items-center justify-center gap-2">
                    {isSubmitting ? <><span className="animate-spin w-4 h-4 border-2 border-white/20 border-t-white rounded-full"></span> Soumission...</> : "Soumettre le projet"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="max-w-4xl mx-auto animate-fade-in-up">
              {!isSupabaseConfigured ? (
                // Keep minimal fallback if no Supabase
                <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-16 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5">
                    <Activity className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Flux de synchronisation</h3>
                  <p className="text-gray-400 font-normal">Les logs de vos automatisations apparaîtront ici prochainement.</p>
                </div>
              ) : (
                <ActivityView supabase={supabase} />
              )}
            </div>
          )}

          {activeTab === 'intelligence' && (
            <div className="max-w-4xl mx-auto animate-fade-in-up">
              {!isSupabaseConfigured ? (
                <div className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-16 text-center shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6 border border-white/5">
                    <Lightbulb className="w-8 h-8 text-gray-300" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Intelligence Actero</h3>
                  <p className="text-gray-400 font-normal">L'IA est en cours d'analyse de vos processus.</p>
                </div>
              ) : (
                <IntelligenceView supabase={supabase} setActiveTab={setActiveTab} />
              )}
            </div>
          )}

          {activeTab === 'systems' && (
            <div className="max-w-5xl mx-auto animate-fade-in-up">
              <h2 className="text-3xl font-bold text-white mb-8 tracking-tight">Vos infrastructures actives</h2>
              <div className="mb-12">
                <InfrastructureNodeMap />
              </div>

              <h3 className="text-xl font-bold text-white mb-6 tracking-tight">Workflows Déployés</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { name: "Récupération Paniers", desc: "Séquence dynamique Shopify -> Klaviyo", status: "Actif", runs: "1,240 exéc." },
                  { name: "Support IA Niveau 1", desc: "Analyse des emails SAV et réponse", status: "Actif", runs: "3,102 exéc." },
                  { name: "Synchronisation CRM", desc: "Stripe -> Quickbooks (Quotidien)", status: "Actif", runs: "30 exéc." },
                ].map((sys, idx) => (
                  <div key={idx} className="bg-[#0a0a0a] border border-white/10 rounded-2xl p-6 shadow-sm relative hover:shadow-md hover:border-white/20 transition-all group">
                    <div className="flex justify-between items-start mb-6">
                      <div className="p-3 bg-white/5 border border-white/5 rounded-xl group-hover:bg-white/10 transition-colors">
                        <Database className="w-5 h-5 text-gray-400" />
                      </div>
                      <span className="bg-emerald-50/10 text-emerald-400 text-xs font-bold px-3 py-1 rounded-lg border border-emerald-500/20">{sys.status}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">{sys.name}</h3>
                    <p className="text-sm text-zinc-500 font-medium mb-6 leading-relaxed">{sys.desc}</p>
                    <div className="pt-4 border-t border-white/5 flex items-center justify-between text-sm">
                      <span className="font-bold text-zinc-400">{sys.runs}</span>
                      <span className="text-emerald-500 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> 100% de succès</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="max-w-4xl mx-auto text-center py-20 animate-fade-in-up">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
                <FileText className="w-10 h-10 text-zinc-300" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-3 tracking-tight">Centre de rapports (Bêta)</h3>
              <p className="text-zinc-500 font-medium max-w-md mx-auto mb-8 leading-relaxed">Générez des rapports PDF mensuels détaillant le ROI exact de chaque workflow déployé.</p>
              <button disabled className="opacity-50 cursor-not-allowed bg-zinc-100 text-zinc-500 border border-white/10 shadow-sm px-6 py-3 rounded-xl font-bold inline-flex items-center gap-2">
                <Download className="w-5 h-5" /> Bientôt disponible
              </button>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

// ==========================================
// AI AUDIT SCANNER (Free Modal version)
// ==========================================
const AIAuditScannerModal = ({ isOpen, onClose }) => {
  const [url, setUrl] = useState("");
  const [scanState, setScanState] = useState("idle"); // idle, scanning, complete
  const [progress, setProgress] = useState(0);
  const [currentLog, setCurrentLog] = useState("");
  const [auditData, setAuditData] = useState(null);
  const [isRealScanDone, setIsRealScanDone] = useState(false);

  const logs = [
    "Initialisation de l'Agent IA...",
    "Scraping de l'arborescence du domaine...",
    "Analyse de la stack technologique e-commerce...",
    "Détection des goulots d'étranglement (Support)...",
    "Analyse des failles de rétention (Klaviyo/CRM)...",
    "Génération des architectures d'automatisation...",
    "Calcul du ROI potentiel et des heures sauvées...",
    "Finalisation du rapport..."
  ];

  // Reset state when opening/closing
  useEffect(() => {
    if (!isOpen) {
      setScanState("idle");
      setProgress(0);
      setUrl("");
      setCurrentLog("");
      setAuditData(null);
      setIsRealScanDone(false);
    }
  }, [isOpen]);

  // Handle the progress snapping to 100 once real scan is done
  useEffect(() => {
    if (progress >= 95 && isRealScanDone && scanState === 'scanning') {
      setProgress(100);
      setTimeout(() => setScanState("complete"), 600);
    }
  }, [progress, isRealScanDone, scanState]);

  const fetchRealAudit = async (targetUrl) => {
    const defaultFallback = {
      timeSaved: "25h+ / semaine",
      bottlenecks: [
        { title: "Support de niveau 1 saturé", description: "Déploiement d'un agent IA multilingue connecté à votre base de données pour absorber 80% des tickets en temps réel.", icon: "bot" },
        { title: "Abandon de panier inexploité", description: "Automatisation d'un Voice Agent IA qui rappelle instantanément les paniers premium avec une offre personnalisée.", icon: "refresh" },
        { title: "Saisie manuelle CRM / Facturation", description: "Synchronisation Make instantanée entre vos paiements (Stripe) et votre comptabilité ou votre CRM de vente.", icon: "database" }
      ]
    };

    try {
      // 1. Scrape with Jina
      const jinaUrl = targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`;
      const scrapeRes = await fetch(`https://r.jina.ai/${jinaUrl}`);
      if (!scrapeRes.ok) throw new Error("Scraping failed");
      const pageText = await scrapeRes.text();
      const contentExcerpt = pageText.substring(0, 5000); // Take first 5k chars to be safe

      // 2. Analyze with Gemini
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("No Gemini API key");

      const prompt = `Tu es un architecte système expert en IA. Voici le contenu textuel extrait du site web d'un prospect : \n\n"${contentExcerpt}"\n\nAnalyse son activité et propose 3 goulots d'étranglement ou automatisations IA très ciblées (ex: prospection métier, support spécifique, devis, etc.). Retourne UNIQUEMENT un JSON valide respectant cette structure exacte : {"timeSaved": "estimation réaliste", "bottlenecks": [ {"title": "Titre court", "description": "L'opportunité d'automatisation IA", "icon": "bot" | "refresh" | "database" } ] }`;

      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" }
      };

      const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!aiRes.ok) throw new Error("Gemini API error");

      const result = await aiRes.json();
      const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;

      if (jsonText) {
        setAuditData(JSON.parse(jsonText));
      } else {
        throw new Error("No valid JSON from Gemini");
      }
    } catch (err) {
      console.error("Real Audit Failed, using fallback:", err);
      // Fallback
      setAuditData(defaultFallback);
    } finally {
      setIsRealScanDone(true);
    }
  };

  const handleStartScan = (e) => {
    e.preventDefault();
    if (!url || !url.includes('.')) return;

    setScanState("scanning");
    setProgress(0);
    setIsRealScanDone(false);

    let currentLogIndex = 0;
    setCurrentLog(logs[0]);

    // Start background fetch
    fetchRealAudit(url);

    const interval = setInterval(() => {
      setProgress(prev => {
        const next = prev + (Math.random() * 12);

        // If scan isn't done, cap at 95%
        if (next >= 95) {
          clearInterval(interval);
          return 95;
        }

        // Update log based on progress
        const logStage = Math.floor((next / 100) * logs.length);
        if (logStage > currentLogIndex && logStage < logs.length) {
          currentLogIndex = logStage;
          setCurrentLog(logs[logStage]);
        }

        return next;
      });
    }, 600);
  };

  const handleApplyAutomations = () => {
    onClose();
    const el = document.getElementById('calendly');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={scanState !== 'scanning' ? onClose : undefined}
      ></div>

      <div className="relative w-full max-w-4xl max-h-[95vh] overflow-y-auto hide-scrollbar z-10 animate-fade-in-up">
        {/* Close button */}
        {scanState !== 'scanning' && (
          <button
            onClick={onClose}
            className="absolute top-6 right-6 w-10 h-10 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center z-50 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}

        <div className="mb-8 text-center mt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold text-emerald-400 mb-4 uppercase tracking-widest">
            <Zap className="w-3.5 h-3.5" /> IA Gratuite
          </div>
          <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white mb-2">Audit Express d'Architecture</h2>
          <p className="text-lg text-gray-400 font-medium max-w-2xl mx-auto">Notre Agent IA analyse votre site et extrait les meilleures opportunités d'automatisation.</p>
        </div>

        <div className="bg-[#0a0a0a] border border-white/10 rounded-3xl p-8 md:p-12 shadow-2xl relative overflow-hidden">
          {/* Subtle background glow depending on state */}
          <div className={`absolute top-0 right-0 w-64 h-64 rounded-full blur-[100px] transition-colors duration-1000 pointer-events-none ${scanState === 'idle' ? 'bg-zinc-500/10' :
            scanState === 'scanning' ? 'bg-amber-500/10 animate-pulse' :
              'bg-emerald-500/20'
            }`}></div>

          <AnimatePresence mode="wait">

            {/* STATE 1: IDLE */}
            {scanState === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="max-w-xl mx-auto text-center relative z-10"
              >
                <form onSubmit={handleStartScan} className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Search className="w-5 h-5 text-gray-500" />
                    </div>
                    <input
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
                <p className="text-xs text-zinc-500 mt-4 font-medium flex items-center justify-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Analyse confidentielle et 100% gratuite.</p>
              </motion.div>
            )}

            {/* STATE 2: SCANNING */}
            {scanState === "scanning" && (
              <motion.div
                key="scanning"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="relative z-10"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold text-emerald-400 font-mono flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Analyse en cours...
                  </span>
                  <span className="text-sm font-bold text-white font-mono">{Math.round(progress)}%</span>
                </div>

                {/* Progress Bar */}
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

                {/* Terminal Window */}
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

            {/* STATE 3: COMPLETE (Free Results) */}
            {scanState === "complete" && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="max-w-2xl mx-auto text-center relative z-10"
              >
                <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">Analyse terminée avec succès !</h3>
                <p className="text-zinc-400 font-medium mb-10 leading-relaxed">
                  L'IA a détecté <strong className="text-white">3 goulots d'étranglement majeurs</strong> sur <span className="text-emerald-400 font-mono">{url}</span>. La résolution de ces processus vous ferait économiser <strong className="text-white bg-white/10 px-2 py-0.5 rounded">{auditData?.timeSaved || "25h+ / semaine"}</strong>.
                </p>

                <div className="text-left space-y-4 mb-10">
                  {auditData?.bottlenecks?.map((neck, idx) => (
                    <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-5 flex items-start gap-4 hover:border-white/20 transition-all">
                      <div className="mt-1">
                        {neck.icon === 'refresh' ? <RefreshCw className="w-5 h-5 text-amber-400" /> :
                          neck.icon === 'database' ? <Database className="w-5 h-5 text-blue-400" /> :
                            <Bot className="w-5 h-5 text-emerald-400" />}
                      </div>
                      <div>
                        <h4 className="text-white font-bold mb-1">{neck.title}</h4>
                        <p className="text-sm text-gray-400">{neck.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                  <button
                    onClick={onClose}
                    className="px-6 py-4 text-gray-400 font-bold hover:text-white transition-colors"
                  >
                    Fermer
                  </button>
                  <button
                    onClick={handleApplyAutomations}
                    className="bg-emerald-500 text-black font-bold px-8 py-4 rounded-xl hover:bg-emerald-400 transition-colors shadow-[0_0_20px_rgba(16,185,129,0.2)] flex items-center gap-2"
                  >
                    Auditer mon business complet <ArrowRight className="w-5 h-5" />
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

// === LANDING IOS26 START ===
const LandingPage = ({ onNavigate }) => {
  // --- Helpers ---
  const scrollToId = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // --- États pour l'interaction IA ---
  const [aiInput, setAiInput] = useState("");
  const [platform, setPlatform] = useState("Shopify");
  const [objective, setObjective] = useState("Conversion");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState("");

  // --- Modal AI Lead ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [brandName, setBrandName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- États UI (FAQ & Modals) ---
  const [openFaqIndex, setOpenFaqIndex] = useState(0);
  const [isAuditScannerOpen, setIsAuditScannerOpen] = useState(false);

  // --- Initialiser Amplitude ---
  useEffect(() => {
    initAmplitude();
    trackEvent('Landing_Page_Viewed');
  }, []);

  const handleOpenModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (brandName.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(contactEmail)) return;
    setIsSubmitting(true);

    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.from('leads').insert({
          brand_name: brandName.trim(),
          email: contactEmail.trim(),
          source: 'landing_architecture'
        });
      }
    } catch (err) {
      console.error("Erreur d'insertion lead", err);
    }

    setIsSubmitting(false);
    setIsModalOpen(false);
    generateAIAudit();
  };

  const generateAIAudit = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    setAiError("");
    setAiResult(null);

    const fullPrompt = `Plateforme: ${platform}, Objectif: ${objective}. Problème e-commerce: "${aiInput}"`;

    const payload = {
      contents: [{ parts: [{ text: fullPrompt }] }],
      systemInstruction: {
        parts: [{ text: "Tu es un architecte système expert en automatisation e-commerce (n8n, Make, Shopify, Klaviyo, Stripe). Le prospect te décrit un problème opérationnel, une perte de temps ou une fuite de revenus. Ton rôle est d'analyser le problème et de proposer une solution d'automatisation élégante et haut de gamme. Ne parle pas de code, parle de flux de données et de résultats. Retourne UNIQUEMENT un JSON valide." }]
      },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            diagnosis: { type: "STRING", description: "Le diagnostic du problème (1 phrase courte et percutante)" },
            solution: { type: "STRING", description: "La logique de la solution d'automatisation proposée (ex: Déclencheur X -> Action Y avec l'outil Z)" },
            timeSaved: { type: "STRING", description: "Estimation réaliste du temps gagné (ex: '15h / mois')" },
            revenueImpact: { type: "STRING", description: "Impact métier (ex: '+12% de conversion sur les paniers abandonnés')" }
          },
          required: ["diagnosis", "solution", "timeSaved", "revenueImpact"]
        }
      }
    };

    try {
      const result = await fetchWithRetry(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      const jsonText = result.candidates?.[0]?.content?.parts?.[0]?.text;
      if (jsonText) {
        setAiResult(JSON.parse(jsonText));
      } else {
        throw new Error("Réponse vide de l'IA");
      }
    } catch (err) {
      setAiError("Le système d'analyse est actuellement très sollicité. Veuillez réessayer dans quelques instants.");
    } finally {
      setAiLoading(false);
    }
  };
  return (
    <div className="relative min-h-screen bg-[#030303] font-sans text-white selection:bg-emerald-500/20 selection:text-white">
      {/* GLOBAL BACKGROUND - Added based on user request to make it site-wide */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="/moody_landscape_bg.png"
          alt="Premium Moody Landscape Background"
          className="w-full h-full object-cover object-[center_70%] opacity-40 mix-blend-screen"
        />
        {/* Gradient overlay to maintain high contrast for readable text everywhere */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#030303]/20 via-[#030303]/70 to-[#030303]/90"></div>
      </div>

      {/* Content wrapper with relative positioning so it sits above the fixed bg */}
      <div className="relative z-10 w-full">
        {/* NAVBAR */}
        <nav className="fixed top-0 w-full z-50 bg-[#030303]/70 backdrop-blur-2xl border-b border-white/10/50 shadow-sm transition-all duration-300">
          <div className="max-w-6xl mx-auto px-6 h-16 md:h-20 flex justify-between items-center">
            <div className="flex items-center gap-2 cursor-pointer group" onClick={() => window.scrollTo(0, 0)}>
              <Logo light={true} className="w-7 h-7 text-white group-hover:scale-105 transition-transform" />
              <span className="font-bold text-xl tracking-tight text-white">Actero</span>
            </div>

            <div className="hidden lg:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
              <button onClick={() => scrollToId('comment-ca-marche')} className="text-sm font-semibold text-gray-400 hover:text-white transition-colors">Produit</button>
              <button onClick={() => onNavigate('/cas-client')} className="text-sm font-semibold text-emerald-400/80 hover:text-emerald-400 transition-colors flex items-center gap-1"><Database className="w-3.5 h-3.5" /> Cas Clients</button>
              <button onClick={() => scrollToId('faq')} className="text-sm font-semibold text-gray-400 hover:text-white transition-colors">FAQ</button>
            </div>

            <div className="flex items-center gap-4 md:gap-6">
              <button
                onClick={() => onNavigate('/login')}
                className="hidden md:block text-sm font-semibold text-gray-400 hover:text-white transition-colors"
              >
                Connexion
              </button>
              <ButtonColorful onClick={() => {
                trackEvent('Header_CTA_Clicked', { location: 'navbar' });
                scrollToId('calendly');
              }}>
                Demander un audit
              </ButtonColorful>
            </div>
          </div>
        </nav>

        <main>
          {/* 1. HERO SECTION (New Redesign) */}
          <GlassHero onNavigate={onNavigate} onOpenAuditScanner={() => setIsAuditScannerOpen(true)} />

          {/* BACKGROUND WRAPPER FOR ALL SECTIONS BELOW HERO */}
          <div className="relative w-full z-10">
            <div className="relative z-10 w-full">

              {/* 2. SECTION STORYTELLING - LE PROBLÈME */}
              <section className="py-24 md:py-32 bg-transparent px-6 relative z-10">
                <FadeInUp className="max-w-5xl mx-auto text-center">
                  <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-white mb-6">Vous perdez déjà de l'argent.</h2>
                  <p className="text-xl md:text-2xl text-gray-400 font-medium max-w-3xl mx-auto leading-relaxed mb-20">
                    Panier abandonné. Support saturé. Données inexploitées.<br className="hidden md:block" />
                    Chaque jour sans automatisation vous coûte.
                  </p>

                  <StaggerContainer className="grid md:grid-cols-3 gap-12 lg:gap-16 text-center">
                    {[
                      { icon: <TrendingDown className="w-8 h-8 text-gray-400" />, title: "Perte de conversion", desc: "Des relances génériques qui ne convertissent plus." },
                      { icon: <Clock className="w-8 h-8 text-gray-400" />, title: "Temps humain gaspillé", desc: "Des heures perdues sur des tâches répétitives." },
                      { icon: <BarChart2 className="w-8 h-8 text-gray-400" />, title: "Décisions sans data", desc: "Navigation à vue au lieu d'itérer sur la data." }
                    ].map((block, i) => (
                      <StaggerItem key={i} className="flex flex-col items-center group">
                        <div className="mb-6 opacity-60 group-hover:opacity-100 group-hover:-translate-y-1 transition-all duration-300">
                          {block.icon}
                        </div>
                        <h3 className="text-xl font-bold text-white mb-3">{block.title}</h3>
                        <p className="text-base text-gray-400 font-medium leading-relaxed">{block.desc}</p>
                      </StaggerItem>
                    ))}
                  </StaggerContainer>
                </FadeInUp>
              </section>

              {/* INFINITE LOGO MARQUEE */}
              <section className="py-16 bg-transparent relative z-10 overflow-hidden">
                <FadeInUp className="text-center mb-10">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-[0.2em]">Intégrations compatibles</p>
                </FadeInUp>
                <div className="relative">
                  {/* Gradient fade edges */}
                  <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#030303] to-transparent z-10 pointer-events-none"></div>
                  <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#030303] to-transparent z-10 pointer-events-none"></div>
                  <div className="flex animate-marquee gap-16 items-center whitespace-nowrap">
                    {[...Array(2)].map((_, setIdx) => (
                      <React.Fragment key={setIdx}>
                        {['Shopify', 'Stripe', 'Klaviyo', 'Make', 'n8n', 'HubSpot', 'Zendesk', 'Slack', 'OpenAI', 'Intercom', 'Salesforce', 'Zapier'].map((name, i) => (
                          <span key={`${setIdx}-${i}`} className="text-xl md:text-2xl font-bold text-white/10 hover:text-white/30 transition-colors duration-500 select-none flex-shrink-0">{name}</span>
                        ))}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </section>

              {/* 3. SECTION BENTO GRID - COMMENT ÇA MARCHE */}
              <section id="comment-ca-marche" className="py-32 bg-transparent px-6 relative overflow-hidden z-10">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#0a0a0a] rounded-full blur-3xl opacity-50 -mr-40 -mt-40 pointer-events-none"></div>

                <div className="max-w-6xl mx-auto relative z-10">
                  <FadeInUp className="text-center mb-20">
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-white mb-6">Et si votre boutique devenait autonome ?</h2>
                    <p className="text-lg text-gray-400 font-medium max-w-2xl mx-auto">3 étapes. Zéro code. Résultat garanti.</p>
                  </FadeInUp>

                  {/* Bento Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 md:gap-5">

                    {/* Card 1 - Large (spans 4 cols) */}
                    <FadeInUp delay={0.1} className="md:col-span-4 group">
                      <div className="relative bg-[#0a0a0a] rounded-[28px] p-8 md:p-10 border border-white/5 h-full overflow-hidden hover:border-white/15 transition-all duration-500">
                        <div className="absolute -top-20 -right-20 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                        <div className="relative z-10">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                              <Activity className="w-5 h-5 text-emerald-400" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Étape 01</span>
                          </div>
                          <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-tight">Analyse en continu</h3>
                          <p className="text-gray-400 font-medium leading-relaxed max-w-md text-base">Actero se connecte à l'ensemble de votre stack (Shopify, CRM, Support) et surveille chaque interaction en temps réel. Aucune installation technique nécessaire.</p>
                          <div className="mt-8 flex gap-3 flex-wrap">
                            {['Shopify', 'Klaviyo', 'Zendesk', 'Hubspot'].map(tag => (
                              <span key={tag} className="text-xs font-semibold bg-white/5 text-gray-400 border border-white/10 px-3 py-1.5 rounded-full">{tag}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </FadeInUp>

                    {/* Card 2 - Tall (spans 2 cols) */}
                    <FadeInUp delay={0.2} className="md:col-span-2 group">
                      <div className="relative bg-[#0a0a0a] rounded-[28px] p-8 border border-white/5 h-full overflow-hidden hover:border-white/15 transition-all duration-500">
                        <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-zinc-400/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                        <div className="relative z-10 flex flex-col h-full">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                              <BrainCircuit className="w-5 h-5 text-amber-400" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Étape 02</span>
                          </div>
                          <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">Recommandation IA</h3>
                          <p className="text-gray-400 font-medium leading-relaxed text-base flex-1">L'intelligence artificielle identifie le workflow exact qui augmentera vos marges et rédige le plan d'action.</p>
                          <div className="mt-6 w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
                          <p className="mt-4 text-sm font-bold text-zinc-500 italic">"Gemini a analysé 1,247 flux pour cette recommandation."</p>
                        </div>
                      </div>
                    </FadeInUp>

                    {/* Card 3 - Wide (spans 3 cols) */}
                    <FadeInUp delay={0.3} className="md:col-span-3 group">
                      <div className="relative bg-[#0a0a0a] rounded-[28px] p-8 md:p-10 border border-white/5 h-full overflow-hidden hover:border-white/15 transition-all duration-500">
                        <div className="absolute -top-20 -left-20 w-60 h-60 bg-sky-500/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"></div>
                        <div className="relative z-10">
                          <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                              <Zap className="w-5 h-5 text-sky-400" />
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest text-gray-500">Étape 03</span>
                          </div>
                          <h3 className="text-2xl md:text-3xl font-bold text-white mb-4 tracking-tight">Exécution instantanée</h3>
                          <p className="text-gray-400 font-medium leading-relaxed max-w-md text-base">Validez en un clic. L'architecture technique se déploie sans aucun code ni intervention de votre part.</p>
                        </div>
                      </div>
                    </FadeInUp>

                    {/* Card 4 - Accent (spans 3 cols) */}
                    <FadeInUp delay={0.4} className="md:col-span-3 group">
                      <div className="relative bg-gradient-to-br from-white/5 to-white/[0.02] rounded-[28px] p-8 md:p-10 border border-white/10 h-full overflow-hidden hover:border-white/20 transition-all duration-500">
                        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center gap-6">
                          <div className="flex-1">
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-3">Résultat</p>
                            <p className="text-xl md:text-2xl font-bold text-white leading-snug">Un système autonome qui optimise vos marges <span className="text-zinc-400">24h/24</span>, pendant que vous dormez.</p>
                          </div>
                          <ButtonColorful onClick={() => {
                            trackEvent('Bento_CTA_Clicked', { location: 'comment_ca_marche' });
                            scrollToId('calendly');
                          }} className="flex-shrink-0">
                            Commencer <ArrowRight className="w-4 h-4" />
                          </ButtonColorful>
                        </div>
                      </div>
                    </FadeInUp>

                  </div>
                </div>
              </section>

              {/* 4. SECTION IMPACT MASSIF - PROOF */}
              <section id="proof" className="py-24 bg-transparent px-6 relative z-10">
                <div className="max-w-6xl mx-auto">

                  {/* XXL Metrics */}
                  <FadeInUp className="text-center mb-16">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-0 max-w-4xl mx-auto">
                      {[
                        { value: 120, prefix: '+', suffix: 'h', label: 'Temps gagné / mois', color: 'text-white' },
                        { value: 18, prefix: '+', suffix: '%', label: 'Hausse Conversion', color: 'text-zinc-300' },
                        { value: 100, prefix: '', suffix: '%', label: 'Autonome', color: 'text-white' }
                      ].map((stat, i) => (
                        <div key={i} className={`flex flex-col items-center justify-center py-6 ${i < 2 ? 'md:border-r border-white/5' : ''}`}>
                          <ScrollCounter value={stat.value} prefix={stat.prefix} suffix={stat.suffix} className={`text-6xl lg:text-[5rem] font-bold tracking-tighter ${stat.color} mb-2 leading-none`} />
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{stat.label}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-sm font-semibold text-gray-400 mt-12 uppercase tracking-wide">Résultats moyens observés chez nos clients E-commerce.</p>
                  </FadeInUp>

                  {/* Premium Case Study Card */}
                  <ScaleIn className="max-w-4xl mx-auto">
                    <div className="bg-[#030303] rounded-[32px] p-8 md:p-12 border border-white/10 shadow-xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-zinc-800 rounded-full blur-3xl opacity-50 -mr-40 -mt-40 transition-transform duration-700 group-hover:scale-110"></div>

                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-10">
                          <div className="px-3 py-1 bg-[#0a0a0a] border border-white/5 rounded-full text-xs font-bold uppercase tracking-widest text-zinc-300 shadow-sm">Étude de Cas</div>
                          <span className="text-white font-bold">Marque DNVB (Beauté)</span>
                        </div>

                        <div className="grid md:grid-cols-2 gap-12 items-center">
                          <div className="space-y-8">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Architecture déployée</p>
                              <p className="text-xl font-bold text-white leading-tight">Moteur de recommandation post-achat avec SMS dynamiques (Klaviyo + Shopify).</p>
                            </div>
                            <div className="flex gap-12">
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">AOV Avant</p>
                                <p className="text-2xl font-bold text-gray-400 line-through">65 €</p>
                              </div>
                              <div>
                                <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-1">AOV Après</p>
                                <p className="text-3xl font-bold text-white tracking-tight">82 €</p>
                              </div>
                            </div>
                          </div>

                          <div className="bg-[#0a0a0a] rounded-3xl p-8 border border-white/5 shadow-[0_10px_40px_rgba(0,0,0,0.04)] text-center">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Revenus nets générés en 30 jours</p>
                            <p className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 to-emerald-700 tracking-tighter mb-6">+ 12 400 €</p>
                            <button onClick={() => scrollToId('calendly')} className="text-sm font-bold text-white border-b-2 border-transparent hover:border-gray-900 transition-colors pb-0.5 inline-flex items-center gap-1">Je veux le même plan <ArrowRight className="w-3 h-3" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </ScaleIn>

                </div>
              </section>

              {/* 5. SECTION COMPARAISON (POSITIONNEMENT) */}
              <section className="py-24 bg-transparent border-t border-white/10 px-6 relative z-10">
                <div className="max-w-4xl mx-auto">
                  <FadeInUp className="text-center mb-16">
                    <h2 className="text-4xl md:text-5xl font-bold tracking-tighter text-white mb-6 leading-tight">Ce n'est pas un outil.<br />C'est une <span className="text-zinc-300">infrastructure.</span></h2>
                  </FadeInUp>

                  <SlideInLeft className="bg-[#0a0a0a] rounded-[32px] border border-white/10 overflow-hidden shadow-sm">
                    <div className="grid grid-cols-2 md:grid-cols-2 border-b border-white/5 bg-white/5/50">
                      <div className="p-6 md:p-8 border-r border-white/5">
                        <p className="text-lg font-bold tracking-tight text-gray-400 line-through decoration-gray-300">Make / Zapier</p>
                      </div>
                      <div className="p-6 md:p-8">
                        <p className="text-xl font-bold tracking-tight text-zinc-300 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse"></span>Actero</p>
                      </div>
                    </div>

                    <div className="divide-y divide-gray-100">
                      {[
                        { old: "Création manuelle des flux", new: "Déploiement Autonome piloté par l'IA" },
                        { old: "Focalisé sur la technique (API, Webhooks)", new: "Focalisé sur le Business (Marges, AOV, LTV)" },
                        { old: "Maintenance constante en cas de bug", new: "Monitoring intelligent et auto-réparation" },
                        { old: "Aucun suivi du ROI chiffré", new: "Impact financier mesuré sur chaque workflow" },
                      ].map((row, i) => (
                        <div key={i} className="grid grid-cols-2 group hover:bg-white/5/30 transition-colors">
                          <div className="p-6 md:p-8 border-r border-white/5 flex items-center">
                            <p className="text-[15px] font-medium text-gray-400">{row.old}</p>
                          </div>
                          <div className="p-6 md:p-8 flex items-center">
                            <p className="text-[15px] font-bold text-white">{row.new}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SlideInLeft>
                </div>
              </section>


              {/* 7. FAQ */}
              <section id="faq" className="py-24 bg-transparent px-6 relative z-10">
                <div className="max-w-3xl mx-auto">
                  <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-bold tracking-tighter text-white mb-6">Questions fréquentes.</h2>
                  </div>
                  <div className="space-y-4">
                    {[
                      { q: "Est-ce que je dois savoir coder pour utiliser Actero ?", a: "Absolument pas. Actero est une plateforme 'Done-for-you' en arrière-plan. Vous validez simplement les recommandations de notre IA depuis votre interface, et nos ingénieurs (ou nos scripts) s'occupent du déploiement technique." },
                      { q: "Combien de temps prend l'intégration avec ma boutique ?", a: "Moins de 5 minutes. Une fois votre compte créé, il suffit d'accorder les permissions Shopify/Klaviyo. Le premier audit de vos flux prend environ 24 heures." },
                      { q: "Et si ça casse mon site existant ?", a: "Impossible. Nous opérons en aval via API. Nos automatisations ne modifient pas le code frontal de votre site (Liquid/React), mais optimisent le traitement des données dans vos outils marketing et logistiques." },
                      { q: "Puis-je annuler à tout moment ?", a: "Oui, nos plans Starter et Growth sont sans engagement. Vous pouvez annuler d'un simple clic depuis vos paramètres." }
                    ].map((faq, i) => (
                      <div key={i} className="border border-white/10 rounded-2xl bg-[#030303] overflow-hidden transition-all duration-300">
                        <button
                          onClick={() => setOpenFaqIndex(openFaqIndex === i ? null : i)}
                          className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none"
                        >
                          <span className="font-bold text-white text-lg">{faq.q}</span>
                          <div className={`w-8 h-8 rounded-full border flex items-center justify-center flex-shrink-0 transition-transform duration-300 ${openFaqIndex === i ? 'bg-zinc-300 border-zinc-300 text-white rotate-180' : 'bg-[#0a0a0a] border-white/10 text-gray-400'}`}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                          </div>
                        </button>
                        <div className={`px-6 overflow-hidden transition-all duration-500 ease-in-out ${openFaqIndex === i ? 'max-h-96 pb-6 opacity-100' : 'max-h-0 opacity-0'}`}>
                          <p className="text-gray-400 font-medium leading-relaxed">{faq.a}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* 9. APPEL STRATEGIQUE (CALENDLY) */}
              <section id="calendly" className="py-24 bg-transparent px-6 relative overflow-hidden border-t border-white/10 z-10">
                <div className="max-w-5xl mx-auto">
                  <div className="grid lg:grid-cols-2 gap-16 items-center">

                    {/* Left Context */}
                    <div className="space-y-10">
                      <div>
                        <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-white mb-6 leading-[1.1]">Audit stratégique offert.</h2>
                        <p className="text-xl text-gray-400 font-medium leading-relaxed">15 minutes pour identifier précisément où vous perdez de la marge, sans aucun engagement.</p>
                      </div>

                      <div className="bg-[#0a0a0a] rounded-[24px] border border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] p-8">
                        <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-6">Pendant cet appel vous recevrez :</p>
                        <ul className="space-y-4">
                          {[
                            "Estimation ROI personnalisée",
                            "3 workflows prioritaires à activer",
                            "Plan d'architecture technique recommandé",
                            "Projection de croissance sur 90 jours"
                          ].map((item, i) => (
                            <li key={i} className="flex items-center gap-3">
                              <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 flex-shrink-0"><Zap className="w-3 h-3" /></div>
                              <span className="text-gray-300 font-medium">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-900/20 border border-red-500/30 text-xs font-bold text-red-400">
                        <Clock className="w-3.5 h-3.5" />
                        3 créneaux restants cette semaine
                      </div>
                    </div>

                    {/* Right Calendly */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-zinc-400/5 blur-3xl transform scale-110 rounded-full"></div>
                      <div className="bg-[#0a0a0a] rounded-[32px] border border-white/10 shadow-2xl relative overflow-hidden h-[700px] flex justify-center w-full">
                        <iframe
                          src="https://calendly.com/jc6pablo2/30min?embed_domain=actero.io&embed_type=Inline"
                          width="100%"
                          height="100%"
                          frameBorder="0"
                          title="Calendly Scheduling"
                          className="bg-[#0a0a0a] absolute inset-0 w-full h-full"
                        ></iframe>
                      </div>
                    </div>

                  </div>
                </div>
              </section>

            </div> {/* Close relative z-10 w-full content wrapper */}
          </div> {/* Close relative w-full z-10 dotted surface wrapper */}
        </main>
        {/* STICKY CTA */}
        <div className="fixed bottom-0 left-0 right-0 p-4 z-50 pointer-events-none flex justify-center md:hidden">
          <div className="bg-[#0a0a0a]/90 backdrop-blur-xl border border-white/10/80 shadow-[0_-10px_40px_rgba(0,0,0,0.08)] p-2 rounded-2xl w-full max-w-md pointer-events-auto flex items-center justify-between gap-4">
            <span className="text-[13px] font-bold text-white ml-2">Prêt à automatiser<br />votre croissance ?</span>
            <ButtonColorful onClick={() => {
              trackEvent('StickyFooter_CTA_Clicked', { location: 'mobile_footer' });
              scrollToId('calendly');
            }}>
              Réserver un audit
            </ButtonColorful>
          </div>
        </div>
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none hidden md:flex">
          <div className="bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/10/50 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] rounded-full px-4 py-3 pointer-events-auto flex items-center gap-6 hover:-translate-y-1 transition-transform duration-300">
            <span className="text-sm font-bold text-white pl-2">Prêt à automatiser votre croissance ?</span>
            <ButtonColorful onClick={() => {
              trackEvent('StickyFooter_CTA_Clicked', { location: 'desktop_footer' });
              scrollToId('calendly');
            }}>
              Réserver mon audit stratégique
            </ButtonColorful>
          </div>
        </div>

        {/* Modal Lead IA */}
        {
          isModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity" onClick={!isSubmitting ? closeModal : undefined}></div>
              <div className="relative bg-[#0a0a0a] rounded-2xl p-8 max-w-md w-full shadow-2xl animate-fade-in-up z-10 border border-white/5">
                <button onClick={closeModal} disabled={isSubmitting} className="absolute top-6 right-6 text-gray-400 hover:text-gray-400 transition-colors disabled:opacity-50">
                  <X className="w-5 h-5" />
                </button>
                <h3 className="text-2xl font-semibold text-white mb-2 tracking-tight">Dernière étape</h3>
                <p className="text-gray-400 font-medium text-sm mb-6">Laissez-nous vos coordonnées pour générer votre architecture cible personnalisée.</p>

                <form onSubmit={handleModalSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Nom de l'entreprise <span className="text-emerald-500">*</span></label>
                    <input
                      required
                      minLength={2}
                      value={brandName}
                      onChange={e => setBrandName(e.target.value)}
                      disabled={isSubmitting}
                      type="text"
                      className="w-full bg-[#030303] border border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-zinc-300 focus:border-zinc-300 transition-all font-medium text-white placeholder:text-gray-400"
                      placeholder="Ex: Actero"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">Email professionnel <span className="text-emerald-500">*</span></label>
                    <input
                      required
                      pattern="^\S+@\S+\.\S+$"
                      value={contactEmail}
                      onChange={e => setContactEmail(e.target.value)}
                      disabled={isSubmitting}
                      type="email"
                      className="w-full bg-[#030303] border border-white/10 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-zinc-300 focus:border-zinc-300 transition-all font-medium text-white placeholder:text-gray-400"
                      placeholder="nom@entreprise.com"
                    />
                  </div>
                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button type="button" onClick={closeModal} disabled={isSubmitting} className="px-5 py-3 rounded-xl font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50">
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || brandName.trim().length < 2 || !/^\S+@\S+\.\S+$/.test(contactEmail)}
                      className="bg-zinc-300 text-white px-6 py-3 rounded-xl font-semibold hover:bg-zinc-400 disabled:opacity-50 transition-colors shadow-sm inline-flex items-center justify-center gap-2 min-w-[140px]"
                    >
                      {isSubmitting ? <><svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Génération...</> : "Voir l'audit"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )
        }

        {/* FOOTER */}
        <footer className="bg-[#0a0a0a] border-t border-white/5 py-16 px-6 relative z-10">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-col items-center md:items-start gap-2">
              <div className="flex items-center gap-2">
                <Logo light={false} className="w-6 h-6" />
                <span className="font-bold tracking-tight text-white text-lg">Actero</span>
              </div>
              <p className="text-sm font-medium text-gray-400">L'infrastructure autopilotée des E-commerçants.</p>
            </div>

            <div className="flex flex-wrap justify-center gap-8 text-sm font-bold text-gray-400">
              <button onClick={() => onNavigate('/cas-client')} className="hover:text-emerald-400 transition-colors flex items-center gap-1"><Database className="w-3.5 h-3.5" /> Cas Clients</button>
              <button onClick={() => alert("Page à venir prochainement !")} className="hover:text-white transition-colors">Contact</button>
              <button onClick={() => alert("Page à venir prochainement !")} className="hover:text-white transition-colors">Mentions légales</button>
              <button onClick={() => alert("Page à venir prochainement !")} className="hover:text-white transition-colors">Confidentialité</button>
            </div>

            <div className="text-center md:text-right">
              <p className="text-xs font-semibold text-gray-400">
                © {new Date().getFullYear()} Actero. All rights reserved.
              </p>
            </div>
          </div>
        </footer>

        {/* --- AIAuditScannerModal --- */}
        <AIAuditScannerModal
          isOpen={isAuditScannerOpen}
          onClose={() => setIsAuditScannerOpen(false)}
        />
      </div>
    </div>
  );
};
// === LANDING IOS26 END ===

// ==========================================
// 5. APPLICATION MAIN ROUTER
// ==========================================
function ResetPasswordPage({ onNavigate }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password.length < 8) return setError("Mot de passe trop court (8 caractères min).");
    if (password !== confirm) return setError("Les mots de passe ne correspondent pas.");

    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      setSuccess("✅ Mot de passe mis à jour. Tu peux te connecter.");
      setTimeout(() => onNavigate("/login"), 800);
    } catch (e) {
      setError("Erreur pendant la mise à jour. Réessaie via le lien du mail.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <h2 className="text-3xl font-bold tracking-tight text-white">Nouveau mot de passe</h2>
        <p className="mt-2 text-sm text-zinc-500 font-medium">Choisis un nouveau mot de passe.</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#0a0a0a] py-8 px-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/10 sm:rounded-3xl sm:px-10">
          <form className="space-y-6" onSubmit={handleUpdate}>
            {error && <div className="p-4 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-100">{error}</div>}
            {success && <div className="p-4 bg-emerald-50 text-emerald-600 text-sm font-medium rounded-xl border border-emerald-100">{success}</div>}

            <div>
              <label className="block text-sm font-bold text-white mb-2">Nouveau mot de passe</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400 sm:text-sm outline-none transition-all text-white placeholder:text-gray-500"
                placeholder="••••••••"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-white mb-2">Confirmer</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="block w-full px-4 py-3 bg-[#0a0a0a] border border-white/10 rounded-xl focus:ring-2 focus:ring-zinc-400 focus:border-zinc-400 sm:text-sm outline-none transition-all text-white placeholder:text-gray-500"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3.5 px-4 rounded-xl shadow-sm text-sm font-bold text-black bg-white hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              {loading ? "Mise à jour..." : "Changer le mot de passe"}
            </button>

            <button
              type="button"
              onClick={() => onNavigate("/login")}
              className="w-full text-center text-sm text-zinc-500 hover:text-white font-medium mt-2"
            >
              Retour à la connexion
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// TENANT BINDING (DFY) - CONTEXT & GATE
// ==========================================
export const TenantContext = createContext(null);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within a TenantContext.Provider");
  }
  return context;
};

const DashboardGate = ({ onNavigate, onLogout, currentRoute }) => {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [clientId, setClientId] = useState(null);
  const [role, setRole] = useState(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [tenantError, setTenantError] = useState(null);

  // Debug mode: accessible via "?debug=1" in the URL or the DEBUG_AUTH flag below.
  const isDebug = window.location.search.includes('debug=1') || DEBUG_AUTH;
  const dLog = (...args) => { if (isDebug) console.log("[DASHBOARD_GATE]", ...args); };

  useEffect(() => {
    let mounted = true;

    // Helper: Retry execution wrapper
    const fetchWithRetry = async (fn, maxRetries = 3, delayMs = 1500) => {
      let attempts = 0;
      while (attempts < maxRetries) {
        try {
          return await fn();
        } catch (error) {
          attempts++;
          dLog(`Attempt ${attempts} failed:`, error.message);
          if (attempts >= maxRetries) throw error;
          await new Promise(r => setTimeout(r, delayMs * attempts)); // Backoff
        }
      }
    };

    const checkTenant = async () => {
      try {
        dLog(`Initiating Tenant Check... (Current Route: ${currentRoute})`);
        if (!isSupabaseConfigured || !supabase) {
          throw new Error("Base de données non configurée.");
        }

        const { data: { session: activeSession }, error: authError } = await supabase.auth.getSession();

        if (authError) throw authError;

        if (!activeSession) {
          dLog("Session status: Unauthenticated, redirecting to login.");
          if (mounted) onNavigate('/login');
          return;
        }

        dLog("Session status: Authenticated", { userId: activeSession.user.id });
        dLog("Supabase target:", SUPABASE_URL); // Scrubbed via variable reference

        if (mounted) {
          setSession(activeSession);
          setUser(activeSession.user);
        }

        // 1. ADMIN CHECK
        dLog(`Checking 'admin_users' for user_id: ${activeSession.user.id}`);
        const isAdminCheck = await fetchWithRetry(async () => {
          const { data, error } = await supabase
            .from('admin_users')
            .select('user_id')
            .eq('user_id', activeSession.user.id)
            .maybeSingle();

          if (error) throw error;
          return !!data;
        });

        dLog(`Admin Status: ${isAdminCheck ? "TRUE" : "FALSE"}`);

        if (isAdminCheck) {
          if (mounted) {
            setRole('admin');
            setClientId('ADMIN_BYPASS'); // Admins don't strictly bind to one tenant visually right now.
            if (currentRoute !== '/admin') {
              dLog(`Admin User found on ${currentRoute}, redirecting to /admin`);
              onNavigate('/admin');
            }
          }
        } else {
          // 2. CLIENT CHECK
          if (currentRoute === '/admin') {
            dLog(`Non-Admin User attempting to access /admin, redirecting to /app`);
            if (mounted) onNavigate('/app');
            // Allow state check to fall through seamlessly since we just issued a navigation order (it will re-render)
          }

          dLog(`Fetching 'client_users' for user_id: ${activeSession.user.id}`);
          const mappingResult = await fetchWithRetry(async () => {
            const { data, error, status } = await supabase
              .from('client_users')
              .select('client_id, role')
              .eq('user_id', activeSession.user.id)
              .maybeSingle();

            dLog("Query resolve:", { status, data, error });

            if (error) {
              // Hard errors shouldn't be cast as "no tenant"
              throw error;
            }
            return data;
          });

          // Resolve state
          if (mounted) {
            if (mappingResult) {
              dLog("Tenant Mapping successful:", mappingResult);
              setClientId(mappingResult.client_id);
              setRole(mappingResult.role || 'client');
            } else {
              dLog("No mapping found (data is null). Explicitly setting NO TENANT block.");
              setClientId(null);
            }
          }
        }
      } catch (err) {
        dLog("FATAL Gate Error:", err);
        if (mounted) setTenantError("Nous n'avons pas pu valider votre environnement (Erreur DB). Veuillez réessayer ou contacter le support.");
      } finally {
        if (mounted) setLoadingTenant(false);
      }
    };

    checkTenant();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      if (!currentSession) {
        if (mounted) {
          setSession(null);
          setUser(null);
          setClientId(null);
          setRole(null);
          onNavigate('/login');
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [onNavigate, currentRoute]);

  if (tenantError) {
    return (
      <div className="min-h-screen bg-[#030303] flex flex-col justify-center items-center py-12 px-6 font-sans text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-6" />
        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Erreur de connexion</h2>
        <p className="text-gray-400 font-medium max-w-sm mb-8">{tenantError}</p>
        <button onClick={() => window.location.reload()} className="bg-[#0a0a0a] border border-white/10 text-gray-300 px-6 py-3 rounded-xl font-bold text-sm shadow-sm hover:bg-white/5 transition-colors">Réessayer</button>
      </div>
    );
  }

  return (
    <TenantContext.Provider value={{ session, user, clientId, role, loadingTenant }}>
      {role === 'admin' ? (
        <AdminDashboard onNavigate={onNavigate} onLogout={onLogout} />
      ) : (
        <ClientDashboard onNavigate={onNavigate} onLogout={onLogout} />
      )}
    </TenantContext.Provider>
  );
};

// ==========================================
// SUPABASE AUTH CALLBACK ROUTE
// ==========================================
// This route is hit when clicking an invite email or magic link.
// It gives Supabase time to decode the URL hash and exchange it for a session.

const DEBUG_AUTH = false;
const logger = (...args) => { if (DEBUG_AUTH) console.log("[AUTH CALLBACK]", ...args); };

function AuthCallbackPage({ onNavigate }) {
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    logger("Mounted. Checking for session...");

    let mounted = true;

    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        logger("Initial getSession result:", session ? "Session Found" : "No Session", error);

        if (error) throw error;
        if (session && mounted) {
          logger("Session existante ! Routing to /app");
          onNavigate('/app');
        }
      } catch (err) {
        if (mounted) setErrorMsg(err.message || "Erreur lors de la récupération de la session.");
      }
    };

    // First check
    checkSession();

    // Listen for the hash resolution
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      logger("onAuthStateChange emitted:", event, session ? "Session Active" : "No Session");
      if (session && mounted) {
        logger("Session caught via listener. Routing to /app");
        onNavigate('/app');
      }
    });

    // 8s timeout fallback if something gets stuck
    const timeout = setTimeout(() => {
      if (mounted) {
        logger("Timeout reached. No session resolved.");
        setErrorMsg("Le lien a expiré ou est invalide. Veuillez réessayer.");
      }
    }, 8000);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [onNavigate]);

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#030303] flex flex-col justify-center items-center py-12 px-6 font-sans text-center">
        <div className="w-20 h-20 bg-[#0a0a0a] rounded-3xl border border-white/5 shadow-sm flex items-center justify-center mb-6">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Lien invalide</h2>
        <p className="text-gray-400 font-medium max-w-sm mb-10 leading-relaxed">{errorMsg}</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <button onClick={() => onNavigate('/login')} className="bg-zinc-300 text-white px-8 py-3.5 rounded-xl font-bold shadow-md hover:bg-zinc-400 transition-colors">
            Revenir à la connexion
          </button>
          <button onClick={() => window.location.replace('/')} className="bg-[#0a0a0a] border border-white/10 text-gray-300 px-8 py-3.5 rounded-xl font-bold shadow-sm hover:bg-white/5 transition-colors">
            Retour accueil
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030303] flex flex-col justify-center items-center py-12 font-sans">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-zinc-400/20 blur-xl rounded-full"></div>
        <div className="w-20 h-20 bg-[#0a0a0a] rounded-3xl border border-white/5 shadow-xl flex items-center justify-center relative z-10">
          <ShieldCheck className="w-8 h-8 text-zinc-300" />
        </div>
      </div>
      <Loader2 className="w-6 h-6 text-zinc-300 animate-spin mb-4" />
      <h2 className="text-xl font-bold tracking-tight text-white mb-1">Authentification sécurisée</h2>
      <p className="text-sm font-semibold text-gray-400 uppercase tracking-widest animate-pulse">Validation du lien en cours...</p>
    </div>
  );
}

// ==========================================
// 8. CASE STUDIES PAGE
// ==========================================
const CaseStudiesPage = ({ onNavigate }) => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] text-white font-sans selection:bg-white/20">

      {/* Navigation Bar */}
      <nav className="fixed w-full z-50 transition-all duration-300 backdrop-blur-md bg-[#0a0a0a]/80 border-b border-white/5 py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center gap-12">
              <div
                className="flex items-center gap-2 cursor-pointer group"
                onClick={() => onNavigate('/')}
              >
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:scale-105 transition-transform duration-300">
                  <Logo light className="w-6 h-6 text-white" />
                </div>
                <span className="font-bold text-xl tracking-tight hidden sm:block group-hover:text-gray-300 transition-colors">Actero</span>
              </div>
              <div className="hidden md:flex gap-8">
                <button onClick={() => onNavigate('/')} className="text-sm font-medium text-gray-400 hover:text-white transition-colors">Accueil</button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => onNavigate('/login')} className="hidden sm:block text-sm font-medium text-gray-300 hover:text-white px-4 py-2 transition-colors">
                Connexion
              </button>
              <button onClick={() => onNavigate('/login')} className="text-sm font-bold bg-white text-black px-5 py-2.5 rounded-xl hover:scale-105 transition-transform shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                Espace Client
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-20 px-6 max-w-5xl mx-auto">

        {/* Hero Section */}
        <div className="text-center mb-24 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-sm font-bold text-gray-300 mb-6">
            <Database className="w-4 h-4 text-emerald-400" /> Cas Client
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-6">
            Maison Lumina
          </h1>
          <p className="text-xl md:text-2xl text-zinc-400 font-medium max-w-3xl mx-auto leading-relaxed">
            Comment une marque DNVB a automatisé 98% de son support de niveau 1 et augmenté son taux de réachat de 18% avec Actero OS.
          </p>
        </div>

        {/* Key Metrics Dashboard Snapshot */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-24">
          <StatCard
            title="Temps sauvé / mois"
            value={<AnimatedNumber end={42} suffix="h" />}
            icon={Clock}
            color="emerald"
            subtitleItems={["Support technique", "Saisie manuelle"]}
          />
          <StatCard
            title="Requêtes automatisées"
            value={<AnimatedNumber end={98} suffix="%" />}
            icon={CheckCircle}
            color="amber"
            subtitleItems={["Résolution < 2min", "Sans humain"]}
          />
          <StatCard
            title="Taux de réachat"
            value={<><span className="text-zinc-500 mr-1">+</span><AnimatedNumber end={18} suffix="%" /></>}
            icon={TrendingUp}
            color="zinc"
            subtitleItems={["Segmentation dynamique", "Klaviyo"]}
          />
        </div>

        {/* the Story */}
        <div className="grid md:grid-cols-2 gap-16 mb-24">

          {/* Le Problème */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Target className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight">Le défi</h2>
            </div>

            <p className="text-lg text-zinc-400 leading-relaxed font-medium">
              L'équipe support de Maison Lumina (3 personnes) était noyée sous un volume massif de tickets redondants, principalement : <strong className="text-white">"Où est ma commande ?"</strong> et la gestion des retours produits.
            </p>
            <p className="text-lg text-zinc-400 leading-relaxed font-medium">
              En parallèle, les commerciaux perdaient près de 15h par semaine à extraire manuellement les données de Shopify pour segmenter les clients "VIP" dans Klaviyo, freinant l'efficacité des campagnes de rétention.
            </p>
          </div>

          {/* La Solution */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <BrainCircuit className="w-6 h-6 text-emerald-400" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight">L'Architecture Actero</h2>
            </div>

            <div className="bg-[#0a0a0a] border border-white/10 p-6 rounded-2xl space-y-4 shadow-xl">
              <div className="flex items-start gap-4">
                <div className="mt-1"><Bot className="w-5 h-5 text-zinc-300" /></div>
                <div>
                  <h4 className="font-bold text-white mb-1">Agent Support Niveau 1</h4>
                  <p className="text-sm text-zinc-400">Connecté par API à Shopify et aux transporteurs, l'IA lit l'historique de commande et répond en temps réel aux clients avec le ton de la marque.</p>
                </div>
              </div>
              <div className="w-full h-px bg-white/5"></div>
              <div className="flex items-start gap-4">
                <div className="mt-1"><Repeat className="w-5 h-5 text-emerald-400" /></div>
                <div>
                  <h4 className="font-bold text-white mb-1">Enrichissement CRM (Make)</h4>
                  <p className="text-sm text-zinc-400">Chaque nouvel achat déclenche un workflow qui analyse le profil de l'acheteur (panier moyen, fréquence) et applique dynamiquement les tags VIP dans Klaviyo.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Integration Stack */}
        <div className="text-center mb-24">
          <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-6">Infrastructures connectées</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <span className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-white flex items-center gap-2"><ShoppingCart className="w-5 h-5" /> Shopify</span>
            <span className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-white flex items-center gap-2"><RefreshCw className="w-5 h-5" /> Make</span>
            <span className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-white flex items-center gap-2"><Mail className="w-5 h-5" /> Klaviyo</span>
            <span className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 font-bold text-white flex items-center gap-2"><MessageSquare className="w-5 h-5" /> Gorgias</span>
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-20 text-center bg-gradient-to-b from-[#0a0a0a] to-[#030303] border border-white/10 rounded-3xl p-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px]"></div>
          <h2 className="text-3xl font-bold tracking-tight mb-4 relative z-10">Passez vous aussi à l'infrastructure autonome</h2>
          <p className="text-zinc-500 font-medium mb-8 max-w-lg mx-auto relative z-10">Réservez un audit stratégique gratuit pour identifier les goulots d'étranglement de vos opérations.</p>
          <button onClick={() => onNavigate('/')} className="bg-white text-black px-8 py-4 rounded-xl font-bold hover:scale-105 transition-transform shadow-[0_0_30px_rgba(255,255,255,0.1)] relative z-10">
            Réserver mon audit
          </button>
        </div>

      </main>

      {/* FOOTER */}
      <footer className="bg-[#0a0a0a] border-t border-white/5 py-16 px-6 relative z-10 w-full mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col items-center md:items-start gap-2">
            <div className="flex items-center gap-2">
              <Logo light={false} className="w-6 h-6" />
              <span className="font-bold tracking-tight text-white text-lg">Actero</span>
            </div>
            <p className="text-sm font-medium text-gray-400">L'infrastructure autopilotée des E-commerçants.</p>
          </div>

          <div className="flex flex-wrap justify-center gap-8 text-sm font-bold text-gray-400">
            <button onClick={() => onNavigate('/cas-client')} className="hover:text-emerald-400 transition-colors flex items-center gap-1"><Database className="w-3.5 h-3.5" /> Cas Clients</button>
            <button onClick={() => alert("Page à venir prochainement !")} className="hover:text-white transition-colors">Contact</button>
            <button onClick={() => alert("Page à venir prochainement !")} className="hover:text-white transition-colors">Mentions légales</button>
            <button onClick={() => alert("Page à venir prochainement !")} className="hover:text-white transition-colors">Confidentialité</button>
          </div>

          <div className="text-center md:text-right">
            <p className="text-xs font-semibold text-gray-400">
              © {new Date().getFullYear()} Actero. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

function MainRouter() {
  const [currentRoute, setCurrentRoute] = useState('/');
  const [isRouting, setIsRouting] = useState(true);

  useEffect(() => {
    const path = window.location.pathname;
    const hash = window.location.hash;

    logger("MainRouter Mounted. Path:", path, "Hash:", hash);

    if (hash.includes("type=recovery")) {
      logger("Recovery hash found, routing to /reset-password");
      setCurrentRoute("/reset-password");
    } else if (path === '/auth/callback' || hash.includes("access_token=")) {
      // Catch Supabase magic links or invite links that drop tokens in the hash
      logger("Auth hash or callback path found, routing to /auth/callback");
      setCurrentRoute("/auth/callback");
    } else if (path !== '/') {
      // Very basic sync for manual URL entry if needed (optional, just safety)
      logger("Manual path entry:", path);
      setCurrentRoute(path);
    }

    setIsRouting(false);
  }, []);

  const handleLogout = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setCurrentRoute('/');
    // Clear hash and path visually
    window.history.replaceState({}, document.title, "/");
  };

  if (isRouting) return null; // Prevent flash of wrong content

  if (currentRoute === '/') {
    return <LandingPage onNavigate={setCurrentRoute} />;
  }

  if (currentRoute === '/login') {
    return <LoginPage onNavigate={setCurrentRoute} />;
  }

  if (currentRoute === '/reset-password') {
    return <ResetPasswordPage onNavigate={setCurrentRoute} />;
  }

  if (currentRoute === '/auth/callback') {
    return <AuthCallbackPage onNavigate={setCurrentRoute} />;
  }

  if (currentRoute === '/cas-client') {
    return <CaseStudiesPage onNavigate={setCurrentRoute} />;
  }

  if (currentRoute === '/app' || currentRoute === '/admin') {
    return <DashboardGate currentRoute={currentRoute} onNavigate={setCurrentRoute} onLogout={handleLogout} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white/5 font-sans">
      <div className="text-center p-8 bg-[#0a0a0a] border border-white/10 rounded-3xl shadow-sm">
        <AlertCircle className="w-12 h-12 text-zinc-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Page introuvable</h2>
        <button onClick={() => setCurrentRoute('/')} className="bg-white text-zinc-900 px-6 py-3 rounded-xl font-bold hover:bg-zinc-800 transition-colors mt-6">Retour à l'accueil</button>
      </div>
    </div>
  );
}

// ==========================================
// LOAD SUPABASE DYNAMICALLY
// ==========================================

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setIsReady(true);
      return;
    }

    if (window.supabase) {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      setIsReady(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.onload = () => {
      supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      setIsReady(true);
    };
    script.onerror = () => {
      console.error("Impossible de charger le script Supabase.");
      setIsReady(true);
    };
    document.head.appendChild(script);
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white/5 gap-4 font-sans">
        <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-zinc-500 font-bold">Connexion sécurisée en cours...</p>
      </div>
    );
  }

  return (
    <>
      <MainRouter />
      <Analytics />
    </>
  );
}