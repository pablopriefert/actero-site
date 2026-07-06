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
                "inline-flex items-center justify-center h-12 px-8 rounded-full bg-[#1A1A1A] text-white font-semibold text-[15px] hover:bg-black transition-colors focus:outline-none focus:ring-2 focus:ring-black/40 focus:ring-offset-2 focus:ring-offset-white gap-2",
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}
