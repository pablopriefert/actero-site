import React from 'react'
import { interpolate, useCurrentFrame } from 'remotion'
import { COLORS } from '../constants'

/**
 * Eyebrow — petit label uppercase tracking-large au-dessus des H1 de
 * scène. Reprend le style des pages Actero (src/components/landing/*).
 */
export const Eyebrow: React.FC<{ children: React.ReactNode; delay?: number }> = ({
  children,
  delay = 0,
}) => {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [delay, delay + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <div
      style={{
        opacity,
        color: COLORS.forestCta,
        fontFamily: 'Inter, sans-serif',
        fontWeight: 700,
        fontSize: 18,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
        marginBottom: 18,
      }}
    >
      {children}
    </div>
  )
}
