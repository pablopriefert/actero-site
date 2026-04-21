import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { COLORS } from '../constants'
import { ActeroLogo } from '../components/Logo'

/**
 * Scene 2 — SOLUTION (6s)
 *
 * Grand logo Actero qui apparaît avec spring, puis la tagline s'écrit
 * en dessous. Bascule vers la scène Setup avec un fade out.
 */
export const SceneSolution: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Logo pops in
  const logoScale = spring({
    fps,
    frame,
    config: { damping: 14, mass: 0.8, stiffness: 110 },
  })
  const logoRotate = interpolate(frame, [0, 30], [-12, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Brand name slides in
  const nameY = interpolate(frame, [20, 50], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const nameOpacity = interpolate(frame, [20, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Tagline reveals
  const taglineY = interpolate(frame, [55, 85], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const taglineOpacity = interpolate(frame, [55, 85], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Badges wave
  const badgesOpacity = interpolate(frame, [95, 125], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Exit fade
  const exitOpacity = interpolate(frame, [155, 180], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.cream,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        opacity: exitOpacity,
      }}
    >
      {/* Logo mark */}
      <div
        style={{
          transform: `scale(${logoScale}) rotate(${logoRotate}deg)`,
          marginBottom: 32,
        }}
      >
        <ActeroLogo size={140} color={COLORS.forest} strokeWidth={2.5} />
      </div>

      {/* Brand name */}
      <div
        style={{
          transform: `translateY(${nameY}px)`,
          opacity: nameOpacity,
          fontFamily: 'Instrument Serif, Georgia, serif',
          fontSize: 180,
          color: COLORS.ink,
          letterSpacing: '-0.04em',
          lineHeight: 0.95,
          fontWeight: 400,
        }}
      >
        Actero
      </div>

      {/* Tagline */}
      <div
        style={{
          transform: `translateY(${taglineY}px)`,
          opacity: taglineOpacity,
          fontFamily: 'Instrument Serif, Georgia, serif',
          fontSize: 52,
          color: COLORS.inkMuted,
          marginTop: 20,
          textAlign: 'center',
          letterSpacing: '-0.01em',
          fontStyle: 'italic',
          maxWidth: 1100,
        }}
      >
        L'agent IA français qui prend en charge votre SAV Shopify.
      </div>

      {/* Compliance badges */}
      <div
        style={{
          opacity: badgesOpacity,
          display: 'flex',
          gap: 32,
          marginTop: 60,
          fontFamily: 'Inter, sans-serif',
          fontSize: 18,
          color: COLORS.inkMuted,
          fontWeight: 500,
        }}
      >
        <Badge>🇫🇷 Français natif</Badge>
        <Badge>🇪🇺 Hébergé en UE</Badge>
        <Badge>🔒 RGPD · Opt-out TDM</Badge>
      </div>
    </AbsoluteFill>
  )
}

const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      padding: '10px 20px',
      borderRadius: 999,
      background: COLORS.white,
      border: `1px solid ${COLORS.creamBorder}`,
    }}
  >
    {children}
  </div>
)
