import React, { useEffect, useRef } from 'react'

/**
 * CursorGlow — Premium mouse-following gradient spotlight.
 * Renders a large radial gradient that tracks the cursor across the page.
 * Pure CSS + JS, zero dependencies beyond React.
 */
export const CursorGlow = ({
  color = "rgba(16, 185, 129, 0.15)",
  size = 600,
  blur = 120
}) => {
  const glowRef = useRef(null);
  const posRef = useRef({ x: -1000, y: -1000 });
  const rafRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      posRef.current = { x: e.clientX, y: e.clientY };
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          if (glowRef.current) {
            glowRef.current.style.transform = `translate(${posRef.current.x - size / 2}px, ${posRef.current.y - size / 2}px)`;
            glowRef.current.style.opacity = '1';
          }
          rafRef.current = null;
        });
      }
    };

    const handleMouseLeave = () => {
      if (glowRef.current) {
        glowRef.current.style.opacity = '0';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [size]);

  return (
    <div
      ref={glowRef}
      className="fixed top-0 left-0 pointer-events-none z-[9999] transition-opacity duration-500"
      style={{
        width: size,
        height: size,
        opacity: 0,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        filter: `blur(${blur}px)`,
        willChange: 'transform',
      }}
    />
  );
};
