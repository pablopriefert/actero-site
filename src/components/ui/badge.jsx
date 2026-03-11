import React from 'react'

export const Badge = ({ children, variant = "gray", className = "" }) => {
  const variants = {
    gray: "bg-white/5 text-gray-400 border-white/5",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  };

  return (
    <span
      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${variants[variant] || variants.gray} ${className}`}
    >
      {children}
    </span>
  );
};
