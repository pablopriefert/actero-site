import React from 'react'
import { motion } from 'framer-motion'
import { Award } from 'lucide-react'
import { Badge } from '../ui/badge'

export const MilestoneBadge = ({ hoursSaved, theme = "dark" }) => {
  if (!hoursSaved || hoursSaved < 100) return null;
  const isLight = theme === "light";

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`rounded-2xl p-6 mb-8 flex items-center justify-between border transition-colors duration-300 ${isLight
        ? "bg-slate-900 text-white border-slate-800 shadow-lg"
        : "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/30"
        }`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isLight ? "bg-white/10" : "bg-amber-500/20"}`}
        >
          <Award
            className={`w-6 h-6 ${isLight ? "text-amber-400" : "text-amber-500"}`}
          />
        </div>
        <div>
          <h4 className="font-bold text-lg leading-tight">
            Pionnier de l'Automatisation
          </h4>
          <p
            className={`text-sm ${isLight ? "text-slate-400" : "text-amber-200/60"}`}
          >
            Vous avez libéré plus de <strong>{hoursSaved}h</strong> ce mois-ci.
          </p>
        </div>
      </div>
      <Badge variant="blue">Badge Or</Badge>
    </motion.div>
  );
};
