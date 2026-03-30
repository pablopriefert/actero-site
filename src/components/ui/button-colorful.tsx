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
            {/* Animated Conic Gradient Border — Lumenos slate/silver */}
            <span className="absolute inset-[-1000%] animate-[spin_4s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#0A0E1A_0%,#2E4068_10%,#5A7A8C_20%,#E8ECF0_30%,#5A7A8C_40%,#0A0E1A_50%,#0A0E1A_60%,#2E4068_70%,#5A7A8C_80%,#E8ECF0_90%,#0A0E1A_100%)]" />

            {/* Inner Pill — Lumenos style */}
            <span className="relative flex h-full w-full items-center justify-center rounded-full bg-[#111B2E] px-6 py-3 text-[15px] font-semibold text-[#E8ECF0] transition-colors group-hover:bg-[#152236] z-10 gap-2">
                {children}
            </span>
        </button>
    );
}
