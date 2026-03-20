import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  FileText,
  Download,
  Sparkles,
  Loader2,
  Calendar,
  Clock,
  DollarSign,
  Activity,
  TrendingUp,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react'

// ============================================================
// REPORT SECTION
// ============================================================
const ReportSection = ({ title, children, theme }) => {
  const isLight = theme === 'light'
  return (
    <div className="space-y-3">
      <h4 className={`text-[10px] font-bold uppercase tracking-widest ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
        {title}
      </h4>
      {children}
    </div>
  )
}

// ============================================================
// MAIN COMPONENT
// ============================================================
export const ReportsView = ({ client, metrics, periodStats, dailyMetrics, events, supabase, theme }) => {
  const isLight = theme === 'light'
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const generateReport = async () => {
    if (!client?.id) return
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: client.id }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erreur')
      setReport(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const clientType = client?.client_type || 'ecommerce'
  const now = new Date()
  const monthName = now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in-up">
      <div>
        <h2 className={`text-3xl font-bold mb-2 tracking-tight ${isLight ? 'text-slate-900' : 'text-white'}`}>
          Rapports
        </h2>
        <p className={`font-medium text-lg ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
          Rapports de performance générés par l'IA à partir de vos données réelles.
        </p>
      </div>

      {/* Quick stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Temps économisé', value: `${periodStats?.time_saved || 0}h`, icon: Clock, color: 'emerald' },
          { label: 'ROI généré', value: `${(periodStats?.roi || 0).toLocaleString()}€`, icon: DollarSign, color: 'amber' },
          { label: 'Actions IA', value: periodStats?.tasks_executed || 0, icon: Activity, color: 'blue' },
          { label: 'Variation ROI', value: `${periodStats?.roi_var > 0 ? '+' : ''}${periodStats?.roi_var || 0}%`, icon: TrendingUp, color: 'violet' },
        ].map((stat, i) => {
          const colorMap = {
            emerald: isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
            amber: isLight ? 'bg-amber-50 border-amber-200 text-amber-600' : 'bg-amber-500/10 border-amber-500/20 text-amber-400',
            blue: isLight ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-blue-500/10 border-blue-500/20 text-blue-400',
            violet: isLight ? 'bg-violet-50 border-violet-200 text-violet-600' : 'bg-violet-500/10 border-violet-500/20 text-violet-400',
          }
          return (
            <div key={i} className={`p-4 rounded-2xl border ${isLight ? 'bg-white border-slate-200' : 'bg-[#0a0a0a] border-white/10'}`}>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 border ${colorMap[stat.color]}`}>
                <stat.icon className="w-4 h-4" />
              </div>
              <p className={`text-xl font-bold font-mono tracking-tighter ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {stat.value}
              </p>
              <p className={`text-[10px] font-bold uppercase tracking-widest mt-1 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
                {stat.label}
              </p>
            </div>
          )
        })}
      </div>

      {/* Generate report CTA */}
      <div className={`rounded-3xl border overflow-hidden ${isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-[#0a0a0a] border-white/10'}`}>
        <div className={`px-6 py-5 border-b flex items-center justify-between ${isLight ? 'border-slate-100' : 'border-white/5'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isLight ? 'bg-violet-50 border border-violet-200' : 'bg-violet-500/10 border border-violet-500/20'
            }`}>
              <Sparkles className={`w-5 h-5 ${isLight ? 'text-violet-600' : 'text-violet-400'}`} />
            </div>
            <div>
              <h3 className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Rapport IA — {monthName}
              </h3>
              <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
                Analyse complète générée par Actero Copilot
              </p>
            </div>
          </div>
          <button
            onClick={generateReport}
            disabled={loading}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all ${
              loading ? 'bg-violet-600/50 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-500 hover:shadow-lg'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Génération...
              </>
            ) : report ? (
              <>
                <RefreshCw className="w-4 h-4" />
                Regénérer
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Générer le rapport
              </>
            )}
          </button>
        </div>

        <div className="px-6 py-6">
          {error && (
            <div className={`p-4 rounded-xl mb-6 ${isLight ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!report && !loading && (
            <div className="text-center py-12">
              <FileText className={`w-12 h-12 mx-auto mb-4 ${isLight ? 'text-slate-300' : 'text-zinc-700'}`} />
              <p className={`text-sm font-bold mb-1 ${isLight ? 'text-slate-500' : 'text-zinc-500'}`}>
                Aucun rapport généré
              </p>
              <p className={`text-xs ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
                Cliquez sur "Générer le rapport" pour obtenir une analyse IA complète de vos performances.
              </p>
            </div>
          )}

          {loading && !report && (
            <div className="text-center py-12">
              <Loader2 className={`w-8 h-8 mx-auto mb-4 animate-spin ${isLight ? 'text-violet-500' : 'text-violet-400'}`} />
              <p className={`text-sm font-bold ${isLight ? 'text-slate-500' : 'text-zinc-400'}`}>
                Analyse de vos données en cours...
              </p>
              <p className={`text-xs mt-1 ${isLight ? 'text-slate-400' : 'text-zinc-600'}`}>
                L'IA compile votre rapport personnalisé.
              </p>
            </div>
          )}

          {report && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Executive Summary */}
              <ReportSection title="Résumé exécutif" theme={theme}>
                <div className={`p-5 rounded-2xl ${isLight ? 'bg-gradient-to-r from-violet-50 to-indigo-50 border border-violet-100' : 'bg-gradient-to-r from-violet-500/[0.06] to-indigo-500/[0.04] border border-violet-500/10'}`}>
                  <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>
                    {report.executive_summary}
                  </p>
                </div>
              </ReportSection>

              {/* Key Insights */}
              <ReportSection title="Points clés" theme={theme}>
                <div className="space-y-2">
                  {(report.key_insights || []).map((insight, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}`}>
                      <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${isLight ? 'text-emerald-500' : 'text-emerald-400'}`} />
                      <p className={`text-sm ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>{insight}</p>
                    </div>
                  ))}
                </div>
              </ReportSection>

              {/* Recommendations */}
              <ReportSection title="Recommandations" theme={theme}>
                <div className="space-y-2">
                  {(report.recommendations || []).map((rec, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-xl ${isLight ? 'bg-slate-50' : 'bg-white/[0.02]'}`}>
                      <TrendingUp className={`w-4 h-4 mt-0.5 shrink-0 ${isLight ? 'text-violet-500' : 'text-violet-400'}`} />
                      <p className={`text-sm ${isLight ? 'text-slate-700' : 'text-zinc-300'}`}>{rec}</p>
                    </div>
                  ))}
                </div>
              </ReportSection>

              {/* Outlook */}
              {report.outlook && (
                <ReportSection title="Perspectives" theme={theme}>
                  <div className={`p-5 rounded-2xl ${isLight ? 'bg-emerald-50 border border-emerald-100' : 'bg-emerald-500/5 border border-emerald-500/10'}`}>
                    <p className={`text-sm leading-relaxed ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>
                      {report.outlook}
                    </p>
                  </div>
                </ReportSection>
              )}

              {/* Generated timestamp */}
              <p className={`text-center text-[10px] pt-4 ${isLight ? 'text-slate-400' : 'text-zinc-700'}`}>
                Rapport généré le {new Date(report.generated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
