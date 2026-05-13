import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Star,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  ArrowRight,
  TrendingUp,
  Shield,
  MessageSquare,
  BarChart3,
} from 'lucide-react'
import { Navbar } from '../components/layout/Navbar'
import { Footer } from '../components/layout/Footer'
import { SEO } from '../components/SEO'

// ── Score gauge ──────────────────────────────────────────────────────

function ScoreGauge({ score }) {
  const color = score >= 70 ? '#16a34a' : score >= 40 ? '#d97706' : '#dc2626'
  const label = score >= 70 ? 'Bon' : score >= 40 ? 'Moyen' : 'Critique'
  const circumference = 2 * Math.PI * 54
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="relative w-40 h-40 mx-auto">
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r="54" fill="none" stroke="#f0f0f0" strokeWidth="8" />
        <motion.circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold" style={{ color }}>{score}</span>
        <span className="text-sm text-[#71717a] font-medium">{label}</span>
      </div>
    </div>
  )
}

// ── Severity badge ───────────────────────────────────────────────────

function SeverityBadge({ severity }) {
  const styles = {
    critical: 'bg-red-50 text-red-600 border-red-200',
    high: 'bg-amber-50 text-amber-600 border-amber-200',
    medium: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${styles[severity] || styles.medium}`}>
      {severity === 'critical' ? 'Critique' : severity === 'high' ? 'Important' : 'Modéré'}
    </span>
  )
}

// ── Main page ────────────────────────────────────────────────────────

export const AuditReportPage = ({ onNavigate }) => {
  const [audit, setAudit] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Extract token from URL path: /audit-report/:token
  const token = window.location.pathname.split('/audit-report/')[1]

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
    if (!token) {
      setError('Lien invalide')
      setLoading(false)
      return
    }

    fetch(`/api/leads/audit-report?token=${encodeURIComponent(token)}`)
      .then((r) => {
        if (!r.ok) throw new Error('Rapport introuvable')
        return r.json()
      })
      .then(setAudit)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        >
          <Zap className="w-8 h-8 text-[#003725]" />
        </motion.div>
      </div>
    )
  }

  if (error || !audit) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <Navbar onNavigate={onNavigate} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-[#71717a] mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-[#262626] mb-2">Rapport introuvable</h1>
            <p className="text-[#71717a]">{error || 'Ce lien n\'est plus valide.'}</p>
          </div>
        </div>
        <Footer onNavigate={onNavigate} />
      </div>
    )
  }

  const analysis = audit.analysis || {}
  const savings = analysis.estimated_savings || {}

  return (
    <>
      <SEO
        title={`Audit Support ${audit.store_name} — Score ${audit.support_score}/100 | Actero`}
        description={`Rapport d'audit du support client de ${audit.store_name}. Score: ${audit.support_score}/100.`}
        canonical={`/audit-report/${token}`}
      />
      <div className="min-h-screen bg-white text-[#262626] font-sans flex flex-col">
        <Navbar onNavigate={onNavigate} onAuditOpen={() => onNavigate('/audit')} />

        <main className="flex-grow pt-32 pb-24 px-6">
          <div className="max-w-3xl mx-auto">

            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#003725]/5 border border-[#003725]/10 text-xs font-bold text-[#003725] mb-6">
                <BarChart3 className="w-3.5 h-3.5" />
                Rapport d'audit automatisé
              </div>
              <h1
                className="text-3xl md:text-4xl font-bold tracking-tight mb-4"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Audit Support de {audit.store_name}
              </h1>
              <p className="text-[#716D5C] text-lg">
                Basé sur {audit.total_reviews} avis clients · Note moyenne {audit.average_rating}/5
              </p>
              <p className="text-xs text-[#71717a] mt-2">
                Généré le {new Date(audit.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </motion.div>

            {/* Score gauge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-[#F9F7F1] rounded-3xl border border-gray-200 p-8 mb-8 text-center"
            >
              <div className="text-xs font-bold text-[#716D5C] uppercase tracking-widest mb-4">Score de support client</div>
              <ScoreGauge score={audit.support_score || 0} />
              {analysis.summary && (
                <p className="mt-6 text-[#262626] text-sm leading-relaxed max-w-lg mx-auto">
                  {analysis.summary}
                </p>
              )}
            </motion.div>

            {/* Top issues */}
            {analysis.top_issues?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mb-8"
              >
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  Problèmes identifiés
                </h2>
                <div className="space-y-3">
                  {analysis.top_issues.map((issue, i) => (
                    <div
                      key={i}
                      className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-gray-300 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-[#262626]">{issue.category}</h3>
                        <SeverityBadge severity={issue.severity} />
                      </div>
                      <p className="text-sm text-[#716D5C] mb-2">{issue.description}</p>
                      {issue.percentage > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${
                                issue.severity === 'critical' ? 'bg-red-400' : issue.severity === 'high' ? 'bg-amber-400' : 'bg-emerald-400'
                              }`}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(issue.percentage, 100)}%` }}
                              transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                            />
                          </div>
                          <span className="text-xs font-medium text-[#71717a] w-10 text-right">
                            {issue.percentage}%
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Savings */}
            {(savings.hours_per_month || savings.tickets_automatable) && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-gradient-to-br from-[#003725] to-[#005c3d] rounded-3xl p-8 mb-8 text-white"
              >
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5" />
                  Ce qu'Actero pourrait changer
                </h2>
                <div className="grid grid-cols-3 gap-6 text-center">
                  {savings.hours_per_month && (
                    <div>
                      <div className="text-3xl font-bold">{savings.hours_per_month}h</div>
                      <div className="text-xs opacity-70 mt-1">gagnées par mois</div>
                    </div>
                  )}
                  {savings.tickets_automatable && (
                    <div>
                      <div className="text-3xl font-bold">{savings.tickets_automatable}%</div>
                      <div className="text-xs opacity-70 mt-1">des tickets automatisables</div>
                    </div>
                  )}
                  {savings.response_time_improvement && (
                    <div>
                      <div className="text-3xl font-bold">{savings.response_time_improvement}</div>
                      <div className="text-xs opacity-70 mt-1">temps de réponse</div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* Recommendations */}
            {analysis.recommendations?.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mb-8"
              >
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  Recommandations
                </h2>
                <div className="space-y-3">
                  {analysis.recommendations.map((rec, i) => (
                    <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                          rec.impact === 'high' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                        }`}>
                          <Zap className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-[#262626] mb-1">{rec.title}</h3>
                          <p className="text-sm text-[#716D5C]">{rec.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-[#F9F7F1] rounded-3xl border border-gray-200 p-8 text-center"
            >
              <Shield className="w-10 h-10 text-[#003725] mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-3" style={{ fontFamily: 'var(--font-display)' }}>
                Envie de résoudre ces problèmes ?
              </h2>
              <p className="text-[#716D5C] mb-6 max-w-md mx-auto">
                Actero est un agent IA qui automatise votre support client e-commerce. Réponse instantanée, 24/7, dans le ton de votre marque.
              </p>
              <a
                href="/audit"
                onClick={(e) => { e.preventDefault(); onNavigate('/audit') }}
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#003725] text-white rounded-xl font-semibold hover:bg-[#004d33] transition-colors"
              >
                Réserver un audit gratuit
                <ArrowRight className="w-4 h-4" />
              </a>
            </motion.div>
          </div>
        </main>

        <Footer onNavigate={onNavigate} />
      </div>
    </>
  )
}
