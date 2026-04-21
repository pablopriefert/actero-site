import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { COLORS } from '../constants'
import { Eyebrow } from '../components/Eyebrow'

/**
 * Scene 3 — SETUP (6s)
 *
 * Montre l'installation OAuth Shopify en 1 clic + un compte à rebours
 * "15 minutes" qui tombe. L'eyebrow annonce "Installation".
 */
export const SceneSetup: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Headline slide
  const headlineY = interpolate(frame, [15, 45], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const headlineOpacity = interpolate(frame, [15, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // OAuth card appears
  const cardSpring = spring({
    fps,
    frame: Math.max(0, frame - 40),
    config: { damping: 18, mass: 0.8, stiffness: 90 },
  })

  // Button "click" effect around frame 100
  const btnScale = interpolate(
    frame,
    [95, 100, 108, 120],
    [1, 0.95, 1.02, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  )

  // Check mark appears after the click
  const checkOpacity = interpolate(frame, [120, 140], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const checkScale = spring({
    fps,
    frame: Math.max(0, frame - 118),
    config: { damping: 12, mass: 0.7, stiffness: 120 },
  })

  // 15 min label after the check
  const timerOpacity = interpolate(frame, [140, 170], [0, 1], {
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
      }}
    >
      {/* Headline */}
      <div
        style={{
          transform: `translateY(${headlineY}px)`,
          opacity: headlineOpacity,
          textAlign: 'center',
          marginBottom: 60,
        }}
      >
        <Eyebrow delay={5}>Installation</Eyebrow>
        <div
          style={{
            fontFamily: 'Instrument Serif, Georgia, serif',
            fontSize: 86,
            color: COLORS.ink,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            fontWeight: 400,
          }}
        >
          Connectez Shopify.{' '}
          <span style={{ fontStyle: 'italic', color: COLORS.inkMuted }}>
            C'est tout.
          </span>
        </div>
      </div>

      {/* OAuth Card */}
      <div
        style={{
          transform: `scale(${cardSpring})`,
          background: COLORS.white,
          borderRadius: 24,
          padding: '40px 56px',
          boxShadow: '0 40px 80px -20px rgba(0, 55, 37, 0.18)',
          border: `1px solid ${COLORS.creamBorder}`,
          display: 'flex',
          alignItems: 'center',
          gap: 32,
          minWidth: 720,
        }}
      >
        {/* Shopify green bag icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: '#95BF47',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 40,
          }}
        >
          🛍️
        </div>

        {/* Text */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 22,
              fontWeight: 700,
              color: COLORS.ink,
            }}
          >
            Installer Actero sur votre boutique
          </div>
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 16,
              color: COLORS.inkMuted,
              marginTop: 4,
            }}
          >
            OAuth officiel · aucune API key à manipuler
          </div>
        </div>

        {/* CTA button */}
        <div
          style={{
            transform: `scale(${btnScale})`,
            background: COLORS.forestCta,
            color: COLORS.white,
            padding: '16px 32px',
            borderRadius: 999,
            fontFamily: 'Inter, sans-serif',
            fontSize: 18,
            fontWeight: 600,
            boxShadow: '0 8px 24px -8px rgba(14, 101, 58, 0.5)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          Installer
          {checkOpacity > 0.1 ? (
            <span
              style={{
                display: 'inline-flex',
                width: 24,
                height: 24,
                borderRadius: 999,
                background: COLORS.leaf,
                color: COLORS.forest,
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                opacity: checkOpacity,
                transform: `scale(${checkScale})`,
                fontWeight: 800,
              }}
            >
              ✓
            </span>
          ) : (
            <span style={{ fontSize: 18 }}>→</span>
          )}
        </div>
      </div>

      {/* Timer below */}
      <div
        style={{
          opacity: timerOpacity,
          marginTop: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontFamily: 'Inter, sans-serif',
          fontSize: 22,
          color: COLORS.inkMuted,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: 999,
            background: COLORS.success,
          }}
        />
        Prêt à répondre à vos clients —{' '}
        <strong style={{ color: COLORS.forest, fontWeight: 700 }}>
          en 15 minutes
        </strong>
      </div>
    </AbsoluteFill>
  )
}
