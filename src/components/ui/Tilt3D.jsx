import React, { useRef } from 'react'
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
} from 'framer-motion'

/**
 * Tilt3D — wrapper that applies mouse-tracking 3D perspective tilt.
 *
 * Props:
 *   intensity  — max rotation in degrees (default 10)
 *   glare      — show a radial light glare on hover (default true)
 *   className  — applied to the outer perspective container
 */
export const Tilt3D = ({ children, className = '', intensity = 10, glare = true }) => {
  const ref = useRef(null)

  // Raw motion values (–0.5 → +0.5 normalised mouse position)
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const sc = useMotionValue(1)

  // Springy versions for smooth deceleration
  const mxSpring = useSpring(mx, { stiffness: 120, damping: 22 })
  const mySpring = useSpring(my, { stiffness: 120, damping: 22 })
  const scSpring = useSpring(sc, { stiffness: 200, damping: 26 })

  // Map normalised position → rotation angles
  const rotateX = useTransform(mySpring, [-0.5, 0.5], [intensity, -intensity])
  const rotateY = useTransform(mxSpring, [-0.5, 0.5], [-intensity, intensity])

  // Glare spotlight position + opacity
  const glareX = useTransform(mxSpring, [-0.5, 0.5], ['15%', '85%'])
  const glareY = useTransform(mySpring, [-0.5, 0.5], ['15%', '85%'])
  const glareOpacity = useTransform(scSpring, [1, 1.025], [0, 1])
  const glareBg = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.07) 0%, transparent 60%)`

  const onMove = (e) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    mx.set((e.clientX - rect.left) / rect.width - 0.5)
    my.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  const onEnter = () => sc.set(1.025)

  const onLeave = () => {
    mx.set(0)
    my.set(0)
    sc.set(1)
  }

  return (
    <div style={{ perspective: '1100px' }} className={className}>
      <motion.div
        ref={ref}
        style={{
          rotateX,
          rotateY,
          scale: scSpring,
          transformStyle: 'preserve-3d',
        }}
        onMouseMove={onMove}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        className="relative w-full h-full"
      >
        {children}

        {/* Glare overlay */}
        {glare && (
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-[inherit]"
            style={{ background: glareBg, opacity: glareOpacity }}
          />
        )}
      </motion.div>
    </div>
  )
}
