import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * FadeInUp — section scroll-reveal with expo-out easing.
 * TASK 5: y:30 amplitude, 600ms, expo-out [0.16, 1, 0.3, 1].
 * Respects prefers-reduced-motion (collapses to instant reveal).
 */
export const FadeInUp = ({ children, delay = 0, className = "" }) => {
    const prefersReducedMotion = useReducedMotion();
    return (
        <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={
                prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.6, ease: [0.16, 1, 0.3, 1], delay }
            }
            className={className}
        >
            {children}
        </motion.div>
    );
};

export const SlideInRight = ({ children, delay = 0, className = "" }) => {
    const prefersReducedMotion = useReducedMotion();
    return (
        <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={
                prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.6, ease: 'easeOut', delay }
            }
            className={className}
        >
            {children}
        </motion.div>
    );
};

export const SlideInLeft = ({ children, delay = 0, className = "" }) => {
    const prefersReducedMotion = useReducedMotion();
    return (
        <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={
                prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.6, ease: 'easeOut', delay }
            }
            className={className}
        >
            {children}
        </motion.div>
    );
};

export const StaggerContainer = ({ children, className = "" }) => {
    const prefersReducedMotion = useReducedMotion();
    const containerVariants = {
        hidden: { opacity: prefersReducedMotion ? 1 : 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: prefersReducedMotion ? 0 : 0.2,
            }
        }
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.2 }}
            className={className}
        >
            {children}
        </motion.div>
    );
};

export const StaggerItem = ({ children, className = "" }) => {
    const prefersReducedMotion = useReducedMotion();
    const itemVariants = {
        hidden: { opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 20 },
        visible: {
            opacity: 1,
            y: 0,
            transition: { duration: prefersReducedMotion ? 0 : 0.5, ease: 'easeOut' }
        }
    };

    return (
        <motion.div variants={itemVariants} className={className}>
            {children}
        </motion.div>
    );
};

export const ScaleIn = ({ children, delay = 0, className = "" }) => {
    const prefersReducedMotion = useReducedMotion();
    return (
        <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={
                prefersReducedMotion
                    ? { duration: 0 }
                    : { duration: 0.6, ease: 'easeOut', delay }
            }
            className={className}
        >
            {children}
        </motion.div>
    );
};
