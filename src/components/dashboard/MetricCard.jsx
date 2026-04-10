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
  const colors = {
    zinc: { iconBg: "bg-gray-100", iconText: "text-[#716D5C]", val: "text-[#262626]" },
    emerald: { iconBg: "bg-emerald-50", iconText: "text-emerald-600", val: "text-[#262626]" },
    amber: { iconBg: "bg-amber-50", iconText: "text-amber-600", val: "text-[#262626]" },
    blue: { iconBg: "bg-blue-50", iconText: "text-blue-600", val: "text-[#262626]" },
    violet: { iconBg: "bg-violet-50", iconText: "text-violet-600", val: "text-[#262626]" },
  };

  const c = colors[color] || colors.zinc;
  const isLoading = value === null || value === undefined;

  return (
    <div
      className={`group bg-white rounded-2xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition-all duration-300 ${className}`}
      aria-busy={isLoading || undefined}
    >
      {/* Header: title left, icon right */}
      <div className="flex items-start justify-between mb-4">
        <p className="text-[11px] font-semibold text-[#716D5C] uppercase tracking-wider">
          {title}
        </p>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl ${c.iconBg} flex items-center justify-center`}>
            <Icon className={`w-4.5 h-4.5 ${c.iconText}`} />
          </div>
        )}
      </div>

      {/* Value (or skeleton) */}
      {isLoading ? (
        <div
          role="status"
          aria-label="Chargement de la valeur"
          className="h-8 w-24 rounded-md bg-gray-100 animate-pulse mb-1"
        />
      ) : (
        <p className={`text-3xl font-bold tracking-tight ${c.val} mb-1`}>
          {value}
        </p>
      )}

      {/* Variation */}
      {variation !== null && variation !== undefined && variation !== "—" ? (
        <div className={`flex items-center gap-1 text-xs font-medium ${
          variation > 0 ? "text-emerald-600" : variation < 0 ? "text-rose-500" : "text-[#716D5C]"
        }`}>
          {variation > 0 && <TrendingUp className="w-3.5 h-3.5" />}
          {variation < 0 && <TrendingDown className="w-3.5 h-3.5" />}
          <span>{variation > 0 ? `+${variation}%` : `${variation}%`}</span>
          <span className="text-[#716D5C] font-normal ml-1">vs 7j precedents</span>
        </div>
      ) : variation === "—" ? (
        <p className="text-xs text-[#716D5C]">— pas de donnees</p>
      ) : null}

      {/* Subtitle items */}
      {subtitleItems.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
          {subtitleItems.map((item, idx) => (
            <span key={idx} className="text-[10px] font-medium text-[#716D5C] uppercase tracking-wider">
              {item}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
