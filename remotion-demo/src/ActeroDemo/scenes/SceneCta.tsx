import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { COLORS } from '../constants'
import { ActeroLogo } from '../components/Logo'

/**
 * Scene 6 — CTA (8s)
 *
 * Dark background (forest), titre italic leaf, deux CTA pills, URL
 * cal.com/actero/demo + actero.fr. Tagline finale.
 */
export const SceneCta: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Background expands from previous scene (simulated fade)
  const bgOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Logo mark
  const logoSpring = spring({
    fps,
    frame: Math.max(0, frame - 20),
    config: { damping: 14, stiffness: 100 },
  })

  // Headline
  const headlineY = interpolate(frame, [40, 75], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const headlineOpacity = interpolate(frame, [40, 75], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // CTAs
  const ctaOpacity = interpolate(frame, [90, 120], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const ctaY = interpolate(frame, [90, 120], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // URL reveal
  const urlOpacity = interpolate(frame, [130, 160], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Subtle pulse on primary CTA
  const pulse = Math.sin(frame * 0.15) * 0.02 + 1

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.forest,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        padding: 80,
      }}
    >
      {/* Ambient dot grid overlay */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          opacity: bgOpacity * 0.15,
          backgroundImage: `radial-gradient(circle at 1px 1px, ${COLORS.leaf} 1px, transparent 0)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Logo */}
      <div
        style={{
          opacity: logoSpring,
          transform: `scale(${logoSpring})`,
          marginBottom: 36,
          position: 'relative',
        }}
      >
        <ActeroLogo size={88} color={COLORS.leaf} strokeWidth={2.4} />
      </div>

      {/* Headline */}
      <div
        style={{
          transform: `translateY(${headlineY}px)`,
          opacity: headlineOpacity,
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <div
          style={{
            fontFamily: 'Instrument Serif, Georgia, serif',
            fontSize: 108,
            color: COLORS.creamDeep,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            fontWeight: 400,
          }}
        >
          Essayez Actero gratuitement —
          <br />
          <span style={{ fontStyle: 'italic', color: COLORS.leaf }}>
            agent prêt en 15 minutes.
          </span>
        </div>
      </div>

      {/* CTAs */}
      <div
        style={{
          opacity: ctaOpacity,
          transform: `translateY(${ctaY}px)`,
          display: 'flex',
          gap: 18,
          marginTop: 56,
          position: 'relative',
        }}
      >
        <div
          style={{
            background: COLORS.creamDeep,
            color: COLORS.forest,
            padding: '22px 44px',
            borderRadius: 999,
            fontFamily: 'Inter, sans-serif',
            fontSize: 24,
            fontWeight: 700,
            transform: `scale(${pulse})`,
            boxShadow: `0 20px 40px -10px ${COLORS.leaf}70`,
          }}
        >
          Démarrer l'essai gratuit →
        </div>
        <div
          style={{
            background: 'transparent',
            color: COLORS.creamDeep,
            padding: '22px 44px',
            borderRadius: 999,
            fontFamily: 'Inter, sans-serif',
            fontSize: 24,
            fontWeight: 600,
            border: `1.5px solid ${COLORS.creamDeep}40`,
          }}
        >
          📅 Réserver une démo
        </div>
      </div>

      {/* URL */}
      <div
        style={{
          opacity: urlOpacity,
          marginTop: 56,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 26,
          color: COLORS.leaf,
          display: 'flex',
          gap: 36,
          position: 'relative',
        }}
      >
        <span>actero.fr</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>cal.com/actero/demo</span>
      </div>

      {/* Bottom tagline */}
      <div
        style={{
          opacity: urlOpacity,
          position: 'absolute',
          bottom: 80,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: 'Inter, sans-serif',
          fontSize: 16,
          color: `${COLORS.creamDeep}80`,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}
      >
        Sans carte bancaire · Résiliation en 1 clic · Garantie 30 jours
      </div>
    </AbsoluteFill>
  )
}
