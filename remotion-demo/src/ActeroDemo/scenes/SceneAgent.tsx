import React from 'react'
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { COLORS } from '../constants'
import { Eyebrow } from '../components/Eyebrow'

/**
 * Scene 4 — AGENT (8s)
 *
 * Simule une conversation chat entre un client et l'agent Actero, côte
 * à côte avec un compteur "Résolutions auto" qui grimpe en temps réel.
 */
export const SceneAgent: React.FC = () => {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  // Headline
  const headlineOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  // Chat bubbles sequenced
  const bubble1 = spring({ fps, frame: Math.max(0, frame - 25), config: { damping: 18, stiffness: 100 } })
  const bubble2 = spring({ fps, frame: Math.max(0, frame - 70), config: { damping: 18, stiffness: 100 } })
  const bubble3 = spring({ fps, frame: Math.max(0, frame - 130), config: { damping: 18, stiffness: 100 } })

  // Typing indicator before bubble 2 and bubble 3
  const typing1 = frame > 45 && frame < 75
  const typing2 = frame > 110 && frame < 135

  // Counter
  const counter = Math.round(
    interpolate(frame, [30, 235], [0, 1847], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  )
  const counterOpacity = interpolate(frame, [25, 50], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.creamDeep,
        padding: 80,
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ opacity: headlineOpacity, textAlign: 'center', marginBottom: 50 }}>
        <Eyebrow delay={0}>Votre agent en action</Eyebrow>
        <div
          style={{
            fontFamily: 'Instrument Serif, Georgia, serif',
            fontSize: 72,
            color: COLORS.ink,
            letterSpacing: '-0.03em',
            fontWeight: 400,
            lineHeight: 1.05,
          }}
        >
          Il répond au client,{' '}
          <span style={{ fontStyle: 'italic', color: COLORS.inkMuted }}>
            vous dormez.
          </span>
        </div>
      </div>

      {/* Chat card + counter side by side */}
      <div
        style={{
          display: 'flex',
          gap: 40,
          alignItems: 'flex-start',
          maxWidth: 1520,
          width: '100%',
          justifyContent: 'center',
        }}
      >
        {/* Chat window */}
        <div
          style={{
            flex: '0 0 820px',
            background: COLORS.white,
            borderRadius: 24,
            border: `1px solid ${COLORS.creamBorder}`,
            boxShadow: '0 30px 60px -20px rgba(0, 55, 37, 0.12)',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '16px 24px',
              background: COLORS.cream,
              borderBottom: `1px solid ${COLORS.creamBorder}`,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 999,
                background: COLORS.success,
              }}
            />
            <div
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 14,
                fontWeight: 600,
                color: COLORS.ink,
              }}
            >
              Agent Actero
            </div>
            <div
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 12,
                color: COLORS.inkMuted,
              }}
            >
              #WISMO-2847
            </div>
          </div>

          {/* Messages */}
          <div style={{ padding: '28px 32px', minHeight: 440, display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Customer */}
            <Bubble
              side="left"
              name="Claire Martin"
              subtitle="il y a 12 sec"
              text="Bonjour, où en est ma commande #4512 svp ? Je l'ai passée lundi 😥"
              scale={bubble1}
              isCustomer
            />

            {/* Typing 1 */}
            {typing1 && <Typing />}

            {/* Agent */}
            {frame > 70 && (
              <Bubble
                side="right"
                name="Actero"
                subtitle="répond en 1,8 sec"
                text="Bonjour Claire, votre commande #4512 est expédiée 📦 — elle sera livrée demain entre 9h et 12h par Chronopost. Voici le suivi : chronopost.fr/XY123. Bonne journée !"
                scale={bubble2}
              />
            )}

            {/* Typing 2 */}
            {typing2 && <Typing />}

            {/* Customer reply */}
            {frame > 130 && (
              <Bubble
                side="left"
                name="Claire Martin"
                subtitle="il y a 2 sec"
                text="Génial, merci beaucoup ! 💚"
                scale={bubble3}
                isCustomer
              />
            )}
          </div>
        </div>

        {/* Counter card */}
        <div
          style={{
            opacity: counterOpacity,
            flex: '0 0 380px',
            padding: 32,
            background: COLORS.white,
            borderRadius: 24,
            border: `1px solid ${COLORS.creamBorder}`,
            boxShadow: '0 20px 40px -15px rgba(0, 55, 37, 0.08)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'Inter, sans-serif',
              fontSize: 12,
              fontWeight: 700,
              color: COLORS.forestCta,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: COLORS.forestCta,
                animation: 'pulse 1.5s infinite',
              }}
            />
            Live · 30 derniers jours
          </div>
          <div
            style={{
              fontFamily: 'Instrument Serif, Georgia, serif',
              fontSize: 96,
              color: COLORS.ink,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {counter.toLocaleString('fr-FR')}
          </div>
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 18,
              color: COLORS.inkMuted,
              marginTop: 8,
              fontWeight: 500,
            }}
          >
            résolutions livrées
            <br />
            sans intervention humaine
          </div>

          {/* Mini bar chart */}
          <div
            style={{
              marginTop: 28,
              display: 'flex',
              alignItems: 'flex-end',
              gap: 4,
              height: 60,
            }}
          >
            {Array.from({ length: 20 }).map((_, i) => {
              const h = 20 + Math.sin(i * 0.7) * 18 + (i % 3) * 6
              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: h,
                    background: COLORS.forestCta,
                    borderRadius: 2,
                    opacity: interpolate(frame, [50 + i * 3, 80 + i * 3], [0, 1], {
                      extrapolateLeft: 'clamp',
                      extrapolateRight: 'clamp',
                    }),
                  }}
                />
              )
            })}
          </div>
          <div
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 12,
              color: COLORS.inkMuted,
              marginTop: 8,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontWeight: 600,
            }}
          >
            Résolutions par jour
          </div>
        </div>
      </div>
    </AbsoluteFill>
  )
}

const Bubble: React.FC<{
  side: 'left' | 'right'
  name: string
  subtitle: string
  text: string
  scale: number
  isCustomer?: boolean
}> = ({ side, name, subtitle, text, scale, isCustomer }) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: side === 'right' ? 'flex-end' : 'flex-start',
        transform: `scale(${scale})`,
        transformOrigin: side === 'right' ? 'right top' : 'left top',
        opacity: scale,
        maxWidth: '88%',
        alignSelf: side === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 4,
          fontFamily: 'Inter, sans-serif',
          fontSize: 11,
          color: COLORS.inkMuted,
          fontWeight: 600,
        }}
      >
        <span>{name}</span>
        <span style={{ opacity: 0.5 }}>·</span>
        <span style={{ fontWeight: 500 }}>{subtitle}</span>
      </div>
      <div
        style={{
          padding: '14px 20px',
          borderRadius: 18,
          background: isCustomer ? COLORS.cream : COLORS.forest,
          color: isCustomer ? COLORS.ink : COLORS.creamDeep,
          fontFamily: 'Inter, sans-serif',
          fontSize: 18,
          lineHeight: 1.45,
          maxWidth: 680,
          border: isCustomer ? `1px solid ${COLORS.creamBorder}` : 'none',
        }}
      >
        {text}
      </div>
    </div>
  )
}

const Typing: React.FC = () => (
  <div
    style={{
      alignSelf: 'flex-end',
      display: 'flex',
      gap: 4,
      padding: '12px 16px',
      background: COLORS.forest,
      borderRadius: 18,
    }}
  >
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: COLORS.leaf,
          opacity: 0.85,
          animation: `bounce 1.2s ${i * 0.15}s infinite ease-in-out`,
        }}
      />
    ))}
  </div>
)
