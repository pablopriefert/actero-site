import React from 'react'
import { motion } from 'framer-motion'
import { ShoppingCart, BrainCircuit, Mail, Database } from 'lucide-react'

export const InfrastructureNodeMap = ({ theme = "dark" }) => {
  const isLight = theme === "light";
  return (
    <div
      className={`rounded-3xl border p-8 shadow-sm relative overflow-hidden h-[400px] flex items-center justify-center transition-colors duration-300 ${isLight ? "bg-white border-slate-200" : "bg-[#0a0a0a] border-white/10"
        }`}
    >
      {/* Background grid */}
      <div
        className={`absolute inset-0 ${isLight
          ? "bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)]"
          : "bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]"
          } bg-[size:40px_40px]`}
      ></div>

      {/* Animated Pulses */}
      <motion.div
        animate={{ x: [0, 600] }}
        transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
        className={`absolute top-[40%] left-[-100px] w-20 h-1 blur-sm ${isLight
          ? "bg-gradient-to-r from-transparent via-blue-500 to-transparent"
          : "bg-gradient-to-r from-transparent via-emerald-500 to-transparent"
          }`}
      ></motion.div>

      {/* Nodes */}
      <div className="relative z-10 flex items-center gap-12 lg:gap-24 w-full justify-center">
        {/* Source Node */}
        <div className="flex flex-col items-center gap-3">
          <div
            className={`w-16 h-16 border rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-md relative group ${isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"
              }`}
          >
            <ShoppingCart
              className={`w-8 h-8 ${isLight ? "text-blue-600" : "text-indigo-400"}`}
            />
          </div>
          <span
            className={`text-xs font-bold uppercase tracking-widest ${isLight ? "text-slate-400" : "text-gray-400"}`}
          >
            Shopify
          </span>
        </div>

        {/* Brain Node (Actero) */}
        <div className="flex flex-col items-center gap-3">
          <div
            className={`w-20 h-20 border rounded-full flex items-center justify-center relative ${isLight
              ? "bg-slate-900 border-slate-800 shadow-xl"
              : "bg-zinc-900 border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.1)]"
              }`}
          >
            <div
              className={`absolute inset-[-10px] border rounded-full animate-ping [animation-duration:3s] ${isLight ? "border-blue-500/20" : "border-emerald-500/20"
                }`}
            ></div>
            <BrainCircuit
              className={`w-10 h-10 ${isLight ? "text-blue-400" : "text-emerald-400"}`}
            />
          </div>
          <span
            className={`text-xs font-bold uppercase tracking-widest ${isLight ? "text-slate-900" : "text-emerald-500"
              }`}
          >
            Actero OS
          </span>
        </div>

        {/* Dest Nodes */}
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-3">
            <div
              className={`w-16 h-16 border rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-md relative group ${isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"
                }`}
            >
              <Mail
                className={`w-8 h-8 ${isLight ? "text-amber-600" : "text-amber-400"}`}
              />
            </div>
            <span
              className={`text-xs font-bold uppercase tracking-widest ${isLight ? "text-slate-400" : "text-gray-400"}`}
            >
              Klaviyo
            </span>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div
              className={`w-16 h-16 border rounded-2xl flex items-center justify-center shadow-lg backdrop-blur-md relative group ${isLight ? "bg-slate-50 border-slate-200" : "bg-white/5 border-white/10"
                }`}
            >
              <Database
                className={`w-8 h-8 ${isLight ? "text-blue-600" : "text-blue-400"}`}
              />
            </div>
            <span
              className={`text-xs font-bold uppercase tracking-widest ${isLight ? "text-slate-400" : "text-gray-400"}`}
            >
              Make
            </span>
          </div>
        </div>
      </div>

      {/* SVG Lines */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <line
          x1="30%"
          y1="50%"
          x2="50%"
          y2="50%"
          stroke={isLight ? "#3b82f633" : "#10b98133"}
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <line
          x1="50%"
          y1="50%"
          x2="70%"
          y2="30%"
          stroke={isLight ? "#3b82f633" : "#10b98133"}
          strokeWidth="2"
          strokeDasharray="4 4"
        />
        <line
          x1="50%"
          y1="50%"
          x2="70%"
          y2="70%"
          stroke={isLight ? "#3b82f633" : "#10b98133"}
          strokeWidth="2"
          strokeDasharray="4 4"
        />
      </svg>
    </div>
  );
};
