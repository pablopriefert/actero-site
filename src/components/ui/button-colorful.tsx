import React from "react";
import { cn } from "../../lib/utils";

interface ButtonColorfulProps extends React.ButtonHTMLAttributes<HTMLButtonElement> { }

export function ButtonColorful({
    className,
    children,
    ...props
}: ButtonColorfulProps) {
    return (
        <button
            className={cn(
                "relative inline-flex h-12 overflow-hidden rounded-full p-[2px] shadow-2xl group hover:scale-[1.02] transition-transform duration-300 focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-zinc-50",
                className
            )}
            {...props}
        >
            {/* Animated Conic Gradient Border */}
            <span className="absolute inset-[-1000%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#000_0%,#fff_5%,#f59e0b_10%,#ec4899_15%,#3b82f6_20%,#000_25%,#000_50%,#fff_55%,#f59e0b_60%,#ec4899_65%,#3b82f6_70%,#000_75%,#000_100%)]" />

            {/* Inner Pill */}
            <span className="relative flex h-full w-full items-center justify-center rounded-full bg-[#f4f4f5] px-6 py-3 text-[15px] font-bold text-zinc-900 transition-colors group-hover:bg-white z-10 gap-2">
                {children}
            </span>
        </button>
    );
}
