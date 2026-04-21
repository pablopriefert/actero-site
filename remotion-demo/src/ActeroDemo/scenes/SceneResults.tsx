import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { COLORS } from '../constants'
import { Eyebrow } from '../components/Eyebrow'

/**
 * Scene 5 — RESULTS (8s)
 *
 * Les 3 KPIs business de la landing apparaissent un par un, chiffre
 * animé avec compteur qui grimpe. Miroir exact de HeroKpiRow côté web.
 */
export const SceneResults: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  const headlineY = interpolate(frame, [0, 30], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const headlineOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const kpis = [
    {
      value: 60,
      suffix: '%',
      label: 'de résolutions automatiques',
      sub: 'Agent SAV — Email, chat, helpdesk',
      startFrame: 40,
    },
    {
      value: 15,
      suffix: 'min',
      label: "pour installer l'agent",
      sub: 'OAuth Shopify 1-clic · sans code',
      startFrame: 90,
    },
    {
      value: 15,
      suffix: '%',
      prefix: '+',
      label: 'de paniers récupérés',
      sub: '3 relances IA personnalisées',
      startFrame: 140,
    },
  ]

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.cream,
        padding: 80,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          transform: `translateY(${headlineY}px)`,
          opacity: headlineOpacity,
          textAlign: 'center',
          marginBottom: 80,
        }}
      >
        <Eyebrow delay={0}>Résultats mesurés</Eyebrow>
        <div
          style={{
            fontFamily: 'Instrument Serif, Georgia, serif',
            fontSize: 96,
            color: COLORS.ink,
            letterSpacing: '-0.03em',
            lineHeight: 0.95,
            fontWeight: 400,
          }}
        >
          3 chiffres,{' '}
          <span style={{ fontStyle: 'italic', color: COLORS.inkMuted }}>
             1 produit.
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 32,
          maxWidth: 1500,
          width: '100%',
        }}
      >
        {kpis.map((k, i) => (
          <KpiCard
            key={i}
            value={k.value}
            suffix={k.suffix}
            prefix={k.prefix}
            label={k.label}
            sub={k.sub}
            startFrame={k.startFrame}
            fps={fps}
            frame={frame}
          />
        ))}
      </div>
    </AbsoluteFill>
  )
}

const KpiCard: React.FC<{
  value: number
  suffix: string
  prefix?: string
  label: string
  sub: string
  startFrame: number
  fps: number
  frame: number
}> = ({ value, suffix, prefix = '', label, sub, startFrame, fps, frame }) => {
  const rel = frame - startFrame

  const springVal = spring({
    fps,
    frame: Math.max(0, rel),
    config: { damping: 18, mass: 0.9, stiffness: 90 },
  })

  const countValue = Math.round(
    interpolate(rel, [0, 40], [0, value], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  )

  const opacity = interpolate(rel, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const translateY = interpolate(rel, [0, 20], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px) scale(${springVal * 0.05 + 0.95})`,
        background: COLORS.white,
        padding: '44px 36px',
        borderRadius: 24,
        border: `1px solid ${COLORS.creamBorder}`,
        boxShadow: '0 20px 40px -15px rgba(0, 55, 37, 0.1)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          fontFamily: 'Instrument Serif, Georgia, serif',
          fontSize: 128,
          color: COLORS.ink,
          letterSpacing: '-0.04em',
          lineHeight: 0.9,
          fontWeight: 400,
          fontVariantNumeric: 'tabular-nums',
          display: 'flex',
          alignItems: 'baseline',
        }}
      >
        <span>
          {prefix}
          {countValue}
        </span>
        <span
          style={{
            fontSize: 56,
            color: COLORS.inkMuted,
            marginLeft: 4,
            fontWeight: 500,
          }}
        >
          {suffix}
        </span>
      </div>
      <div
        style={{
          marginTop: 20,
          fontFamily: 'Inter, sans-serif',
          fontSize: 20,
          fontWeight: 700,
          color: COLORS.ink,
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          fontFamily: 'Inter, sans-serif',
          fontSize: 15,
          color: COLORS.inkMuted,
          lineHeight: 1.4,
        }}
      >
        {sub}
      </div>
    </div>
  )
}
