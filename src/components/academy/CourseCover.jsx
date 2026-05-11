import React from "react";
import { PlayCircle } from "lucide-react";

// eslint-disable-next-line react-refresh/only-export-components
export const GRADIENT_MAP = {
  emerald: ["#064e3b", "#10b981"],
  teal: ["#134e4a", "#14b8a6"],
  green: ["#14532d", "#22c55e"],
  lime: ["#3f6212", "#84cc16"],
  cyan: ["#164e63", "#06b6d4"],
  blue: ["#1e3a8a", "#3b82f6"],
  indigo: ["#312e81", "#6366f1"],
  violet: ["#4c1d95", "#8b5cf6"],
  purple: ["#581c87", "#a855f7"],
  fuchsia: ["#701a75", "#d946ef"],
  pink: ["#831843", "#ec4899"],
  rose: ["#881337", "#f43f5e"],
  amber: ["#78350f", "#f59e0b"],
  orange: ["#7c2d12", "#f97316"],
  red: ["#7f1d1d", "#ef4444"],
};

// eslint-disable-next-line react-refresh/only-export-components
export function resolveGradient(cover) {
  const key = (cover || "").startsWith("gradient:") ? cover.split(":")[1] : "emerald";
  const [from, to] = GRADIENT_MAP[key] || GRADIENT_MAP.emerald;
  return { from, to };
}

export function CourseCover({ cover, title, className = "", showPlayIcon = true }) {
  const { from, to } = resolveGradient(cover);
  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_60%)]" />
      {showPlayIcon && (
        <div className="absolute inset-0 flex items-center justify-center p-6">
          <PlayCircle className="w-16 h-16 text-white/90 drop-shadow-lg" />
        </div>
      )}
      {title && (
        <div className="absolute bottom-4 left-5 right-5 text-white/95 text-sm font-bold line-clamp-2">
          {title}
        </div>
      )}
    </div>
  );
}
