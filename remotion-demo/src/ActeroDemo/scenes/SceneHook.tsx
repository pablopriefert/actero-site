import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { COLORS } from '../constants'

/**
 * Scene 1 — HOOK (4s)
 *
 * "40 heures par semaine" — le pain point. Nombre qui pop-in avec
 * spring, compteur qui grimpe de 0 à 40, puis la sub-line fade-in.
 */
export const SceneHook: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const numberScale = spring({
    fps,
    frame,
    config: { damping: 16, mass: 0.9, stiffness: 90 },
  })

  const countValue = Math.round(
    interpolate(frame, [10, 60], [0, 40], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  )

  const subtitleOpacity = interpolate(frame, [55, 85], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const contextOpacity = interpolate(frame, [80, 110], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.cream,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          transform: `scale(${numberScale})`,
          fontFamily: 'Instrument Serif, Georgia, serif',
          fontSize: 360,
          lineHeight: 0.9,
          color: COLORS.ink,
          letterSpacing: '-0.04em',
          fontWeight: 400,
          display: 'flex',
          alignItems: 'baseline',
        }}
      >
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{countValue}</span>
        <span
          style={{
            fontSize: 160,
            color: COLORS.inkMuted,
            marginLeft: 18,
            fontStyle: 'italic',
          }}
        >
          h
        </span>
      </div>

      <div
        style={{
          opacity: subtitleOpacity,
          fontFamily: 'Instrument Serif, Georgia, serif',
          fontSize: 64,
          color: COLORS.ink,
          marginTop: 20,
          textAlign: 'center',
          letterSpacing: '-0.02em',
          lineHeight: 1.1,
        }}
      >
        par semaine à répondre à des{' '}
        <span style={{ fontStyle: 'italic', color: COLORS.inkMuted }}>
          « où est ma commande ? »
        </span>
      </div>

      <div
        style={{
          opacity: contextOpacity,
          fontFamily: 'Inter, sans-serif',
          fontSize: 22,
          color: COLORS.ink3,
          marginTop: 40,
          fontWeight: 500,
        }}
      >
        Le temps moyen qu'un e-commerçant Shopify passe sur le SAV répétitif.
      </div>
    </AbsoluteFill>
  )
}
