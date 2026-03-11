import React from 'react'
import { Sparkles } from 'lucide-react'

export const GptBadge = () => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-0.5 align-middle whitespace-nowrap">
    <Sparkles className="w-2.5 h-2.5 fill-amber-500/80" /> Powered by GPT 5.4 Thinking
  </span>
);
