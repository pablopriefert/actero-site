import React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

export const MetricCard = ({
  title,
  value,
  icon: Icon,
  color = "zinc",
  subtitleItems = [],
  className = "",
  theme = "dark",
  variation = null,
}) => {
  const isLight = theme === "light";
  const colors = {
    zinc: {
      bg: isLight ? "bg-slate-100" : "bg-zinc-800",
      border: isLight ? "border-slate-200" : "border-zinc-700",
      text: isLight ? "text-slate-500" : "text-zinc-300",
      val: isLight ? "text-slate-900" : "text-zinc-300",
      hover: isLight ? "group-hover:bg-slate-200/50" : "group-hover:bg-zinc-400/10",
    },
    emerald: {
      bg: isLight ? "bg-emerald-50" : "bg-emerald-500/10",
      border: isLight ? "border-emerald-100" : "border-emerald-500/20",
      text: "text-emerald-600",
      val: isLight ? "text-emerald-700" : "text-emerald-500",
      hover: isLight ? "group-hover:bg-emerald-100/50" : "group-hover:bg-emerald-500/20",
    },
    amber: {
      bg: isLight ? "bg-amber-50" : "bg-amber-500/10",
      border: isLight ? "border-amber-100" : "border-amber-500/20",
      text: "text-amber-600",
      val: isLight ? "text-amber-700" : "text-amber-500",
      hover: isLight ? "group-hover:bg-amber-100/50" : "group-hover:bg-amber-500/20",
    },
    blue: {
      bg: isLight ? "bg-blue-50" : "bg-blue-500/10",
      border: isLight ? "border-blue-100" : "border-blue-500/20",
      text: "text-blue-600",
      val: isLight ? "text-blue-700" : "text-blue-500",
      hover: isLight ? "group-hover:bg-blue-100/50" : "group-hover:bg-blue-500/20",
    },
  };

  const c = colors[color] || colors.zinc;

  const renderVariation = () => {
    if (variation === null || variation === undefined) return null;
    if (variation === "—") {
      return (
        <span className="text-[10px] font-bold text-gray-500 mt-2 block">
          — pas de données
        </span>
      );
    }

    const isPos = variation > 0;
    const isNeg = variation < 0;
    const isNeut = variation === 0;

    return (
      <div className={`flex items-center gap-1 mt-2 text-[10px] font-bold ${isPos ? "text-emerald-500" : isNeg ? "text-rose-500" : "text-gray-500"}`}>
        {isPos && <TrendingUp className="w-3 h-3" />}
        {isNeg && <TrendingDown className="w-3 h-3" />}
        {isNeut && <span className="mr-0.5">=</span>}
        <span>{variation > 0 ? `+${variation}` : variation}% vs mois dernier</span>
      </div>
    );
  };

  return (
    <div
      className={`group p-6 rounded-2xl border transition-all duration-300 ${isLight
        ? "bg-white border-slate-200 shadow-sm hover:shadow-md"
        : "bg-[#0a0a0a] border-white/10 hover:border-white/20"
        } ${className}`}
    >
      <div className="flex items-center gap-3 mb-6">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${c.bg} ${c.border} ${c.hover}`}
        >
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
        <h4
          className={`text-xs font-bold uppercase tracking-widest ${isLight ? "text-slate-500" : "text-zinc-500"
            }`}
        >
          {title}
        </h4>
      </div>

      <div className="flex flex-col">
        <span className={`text-4xl font-bold tracking-tight mb-1 ${c.val}`}>
          {value}
        </span>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {subtitleItems.map((item, idx) => (
            <span
              key={idx}
              className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? "text-slate-400" : "text-zinc-500"
                }`}
            >
              {item}
            </span>
          ))}
        </div>
        {renderVariation()}
      </div>
    </div>
  );
};
