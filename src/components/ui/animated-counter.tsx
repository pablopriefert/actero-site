'use client';

import React, { useEffect, useState, useRef } from 'react';

// Easing function: easeOutCubic
function easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
}

export type AnimatedCounterProps = {
    value: number;
    duration?: number; // in seconds, default to 1.2
    suffix?: string;
    className?: string;
};

export function AnimatedCounter({
    value,
    duration = 1.2,
    suffix = '',
    className = '',
}: AnimatedCounterProps) {
    const [displayValue, setDisplayValue] = useState<number>(0);
    const [hasAnimated, setHasAnimated] = useState<boolean>(false);
    const previousValueRef = useRef<number>(0);
    const startTimeRef = useRef<number | null>(null);
    const requestRef = useRef<number | null>(null);
    const elementRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        // Only run IntersectionObserver logic on client-side
        if (typeof window === 'undefined' || !elementRef.current) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setHasAnimated(true);
                observer.disconnect();
            }
        }, { threshold: 0.1 });

        observer.observe(elementRef.current);

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!hasAnimated) return;

        // If target value is directly 0 or we haven't started, we skip full animation logic
        if (value === 0 && previousValueRef.current === 0) {
            setDisplayValue(0);
            return;
        }

        const startValue = previousValueRef.current;
        const endValue = value;
        const durationMs = duration * 1000;

        const animate = (time: number) => {
            if (startTimeRef.current === null) {
                startTimeRef.current = time;
            }
            const progressMs = time - startTimeRef.current;
            const progressRatio = Math.min(progressMs / durationMs, 1);

            const easedProgress = easeOutCubic(progressRatio);
            const currentValue = startValue + (endValue - startValue) * easedProgress;

            setDisplayValue(currentValue);

            if (progressRatio < 1) {
                requestRef.current = requestAnimationFrame(animate);
            } else {
                setDisplayValue(endValue);
                previousValueRef.current = endValue;
                startTimeRef.current = null;
            }
        };

        if (startValue !== endValue) {
            startTimeRef.current = null;
            requestRef.current = requestAnimationFrame(animate);
        }

        return () => {
            if (requestRef.current !== null) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, [value, duration, hasAnimated]);

    // Use a heuristic for formatting based on the likely scale:
    // If the number is large enough, toLocaleString naturally adds the space/thousands separator
    const formattedValue = Math.round(displayValue).toLocaleString('fr-FR');

    return (
        <span ref={elementRef} className={className}>
            {formattedValue}
            {suffix && <span className="text-[0.6em] font-medium text-inherit ml-1 opacity-60 align-baseline">{suffix}</span>}
        </span>
    );
}
