import React from 'react'
import { motion } from 'framer-motion'

// Simple seeded pseudo-random for deterministic heatmap data
const seededRandom = (seed) => {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
};

export const AdminActivityHeatmap = () => {
  // Generate 30 days of deterministic mock data
  const days = Array.from({ length: 30 }, (_, i) => {
    const isWeekend = i % 7 === 0 || i % 7 === 6;
    const intensity = isWeekend
      ? Math.floor(seededRandom(i) * 2)
      : Math.floor(seededRandom(i) * 5); // 0-4
    return { id: i, intensity };
  });

  const getColor = (intensity) => {
    switch (intensity) {
      case 0:
        return "bg-white/5 border-white/5";
      case 1:
        return "bg-emerald-900/40 border-emerald-800/50";
      case 2:
        return "bg-emerald-700/60 border-emerald-600/50";
      case 3:
        return "bg-emerald-500/80 border-emerald-400/50";
      case 4:
        return "bg-emerald-400 border-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.4)]";
      default:
        return "bg-white/5 border-white/5";
    }
  };

  return (
    <div className="bg-[#0a0a0a] rounded-2xl border border-white/10 p-6 shadow-sm mt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            Activité Globale
          </h3>
          <p className="text-xs text-zinc-500 mt-1">
            Intensité d'exécution des workflows par les clients (30 derniers jours)
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-medium">
          Moins{" "}
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((v) => (
              <div
                key={v}
                className={`w-3 h-3 rounded-sm border ${getColor(v)}`}
              ></div>
            ))}
          </div>{" "}
          Plus
        </div>
      </div>
      <div className="flex gap-2 justify-between items-end">
        {days.map((day) => (
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
