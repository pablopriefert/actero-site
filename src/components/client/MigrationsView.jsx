import React, { useEffect, useState, useCallback } from 'react'
import {
  Upload,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Database,
  ArrowRight,
  Clock,
  X,
  Info,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

/**
 * MigrationsView — UI to import historical tickets from competitors
 * (Gorgias / Zendesk / Intercom) into Actero's ai_conversations.
 *
 * Backend: POST /api/jobs/migrate-tickets — runs in an E2B sandbox.
 * Status:  GET /api/jobs/:id every 5s.
 */

const PROVIDERS = [
  {
    key: 'gorgias',
    label: 'Gorgias',
    description: 'Importe vos tickets historiques Gorgias en un seul run.',
    fields: [
      { key: 'gorgias_subdomain', label: 'Sous-domaine Gorgias', placeholder: 'monshop', help: 'Visible dans votre URL : <span>monshop</span>.gorgias.com' },
      { key: 'gorgias_email', label: 'Email du compte', placeholder: 'admin@monshop.com', type: 'email' },
      { key: 'gorgias_api_key', label: 'Clé API', placeholder: 'gxxxxxxxx', type: 'password', help: 'Settings → REST API → Generate API key' },
    ],
  },
  {
    key: 'zendesk',
    label: 'Zendesk',
    description: 'Migration via API Zendesk Support v2 (Token-based auth).',
    fields: [
      { key: 'zendesk_subdomain', label: 'Sous-domaine Zendesk', placeholder: 'monshop', help: 'monshop.zendesk.com' },
      { key: 'zendesk_email', label: 'Email du compte', placeholder: 'admin@monshop.com', type: 'email' },
      { key: 'zendesk_api_token', label: 'API token', placeholder: 'xxxxxxxx', type: 'password', help: 'Admin Center → Apps and integrations → Zendesk API → Add API token' },
    ],
  },
  {
    key: 'intercom',
    label: 'Intercom',
    description: 'Importe vos conversations Intercom (API v2.11).',
    fields: [
      { key: 'intercom_token', label: 'Access token', placeholder: 'dGVzd...', type: 'password', help: 'Developer Hub → Your apps → Authentication → Access token' },
    ],
  },
]

export function MigrationsView({ clientId, theme: _theme = 'light' }) {
  const [provider, setProvider] = useState('gorgias')
  const [credentials, setCredentials] = useState({})
  const [since, setSince] = useState('') // ISO date YYYY-MM-DD
  const [limit, setLimit] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])
  const [activeJob, setActiveJob] = useState(null)

  const currentProvider = PROVIDERS.find((p) => p.key === provider) || PROVIDERS[0]

  const loadHistory = useCallback(async () => {
    if (!clientId) return
    const { data } = await supabase
      .from('e2b_jobs')
      .select('*')
      .eq('client_id', clientId)
      .like('job_type', 'migrate_%')
      .order('created_at', { ascending: false })
      .limit(20)
    setHistory(data || [])
    const running = (data || []).find((j) => ['queued', 'running'].includes(j.status))
    setActiveJob(running || null)
  }, [clientId])

  useEffect(() => {
    loadHistory()
    const id = setInterval(loadHistory, 5000)
    return () => clearInterval(id)
  }, [loadHistory])

  const handleField = (key) => (e) => {
    setCredentials((prev) => ({ ...prev, [key]: e.target.value }))
  }

  const handleProviderChange = (newKey) => {
    setProvider(newKey)
    setCredentials({})
    setError(null)
  }

  const submit = async (e) => {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const { data: session } = await supabase.auth.getSession()
      const token = session?.session?.access_token
      if (!token) throw new Error('Session expirée. Reconnectez-vous.')

      const body = {
        clientId,
        provider,
        credentials,
        options: {
          since: since ? new Date(since).toISOString() : undefined,
          limit: limit ? Number(limit) : undefined,
          trainAi: true,
        },
      }

      const res = await fetch('/api/jobs/migrate-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)

      setCredentials({})
      setSince('')
      setLimit('')
      await loadHistory()
    } catch (err) {
      setError(err.message || 'Erreur inconnue')
    } finally {
      setSubmitting(false)
    }
  }

  const cancelJob = async (jobId) => {
    const { data: session } = await supabase.auth.getSession()
    const token = session?.session?.access_token
    if (!token) return
    await fetch(`/api/jobs/${jobId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    await loadHistory()
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-cta/10 flex items-center justify-center">
            <Upload className="w-5 h-5 text-cta" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-[#1a1a1a]">Migration de tickets</h1>
            <p className="text-[13px] text-[#6b6b6b]">
              Importez votre historique Gorgias / Zendesk / Intercom pour briefer l'engine IA en quelques heures.
            </p>
          </div>
        </div>
      </header>

      {/* Active job banner */}
      {activeJob && (
        <ActiveJobBanner job={activeJob} onCancel={() => cancelJob(activeJob.id)} />
      )}

      {/* Form card */}
      <form onSubmit={submit} className="rounded-2xl border border-[#E5E2D7] bg-white p-6 space-y-6">
        <div>
          <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#6b6b6b] mb-2">
            Source à importer
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handleProviderChange(p.key)}
                className={`px-4 py-3 rounded-xl border text-left transition-colors ${
                  provider === p.key
                    ? 'border-cta bg-cta/5 text-[#1a1a1a]'
                    : 'border-[#E5E2D7] hover:border-[#1a1a1a]/30 text-[#1a1a1a]'
                }`}
              >
                <div className="text-[13px] font-semibold">{p.label}</div>
                <div className="text-[11px] text-[#6b6b6b] mt-0.5 leading-snug">
                  {p.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {currentProvider.fields.map((f) => (
            <div key={f.key}>
              <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-1">
                {f.label}
              </label>
              <input
                type={f.type || 'text'}
                placeholder={f.placeholder}
                value={credentials[f.key] || ''}
                onChange={handleField(f.key)}
                required
                autoComplete={f.type === 'password' ? 'new-password' : 'off'}
                className="w-full px-3 py-2.5 rounded-lg border border-[#E5E2D7] bg-[#FAF9F4] text-[14px] text-[#1a1a1a] placeholder-[#9ca3af] focus:outline-none focus:ring-2 focus:ring-cta/30 focus:border-cta"
              />
              {f.help && (
                <p className="mt-1 text-[11px] text-[#6b6b6b]">{f.help}</p>
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-1">
              Importer depuis
            </label>
            <input
              type="date"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[#E5E2D7] bg-[#FAF9F4] text-[14px]"
            />
            <p className="mt-1 text-[11px] text-[#6b6b6b]">Laissez vide pour tout importer</p>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-[#1a1a1a] mb-1">
              Limite (optionnel)
            </label>
            <input
              type="number"
              min={1}
              max={100000}
              placeholder="Ex: 5000"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-[#E5E2D7] bg-[#FAF9F4] text-[14px]"
            />
            <p className="mt-1 text-[11px] text-[#6b6b6b]">Nombre max de tickets à importer</p>
          </div>
        </div>

        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[#FAF9F4] border border-[#E5E2D7]">
          <Info className="w-4 h-4 text-[#6b6b6b] flex-shrink-0 mt-0.5" />
          <p className="text-[12px] text-[#6b6b6b] leading-relaxed">
            Vos identifiants ne sont jamais stockés en base. Ils transitent uniquement
            dans le sandbox de migration et sont détruits à la fin du job.
          </p>
        </div>

        {error && (
          <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !!activeJob}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#1a1a1a] text-white font-semibold text-[14px] hover:bg-[#000] transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Lancement…
            </>
          ) : activeJob ? (
            <>
              <Clock className="w-4 h-4" />
              Une migration est déjà en cours
            </>
          ) : (
            <>
              <Database className="w-4 h-4" />
              Lancer la migration
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* History */}
      <section>
        <h2 className="text-[14px] font-bold text-[#1a1a1a] mb-3">Migrations récentes</h2>
        {history.length === 0 ? (
          <p className="text-[13px] text-[#6b6b6b]">Aucune migration n'a encore été lancée.</p>
        ) : (
          <div className="space-y-2">
            {history.map((job) => (
              <HistoryItem key={job.id} job={job} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ActiveJobBanner({ job, onCancel }) {
  const progress = Math.max(0, Math.min(100, job.progress || 0))
  const message = job.progress_message || 'Préparation…'
  const provider = (job.job_type || '').replace('migrate_', '')

  return (
    <div className="rounded-2xl border border-cta/30 bg-cta/5 p-5">
      <div className="flex items-start gap-3">
        <Loader2 className="w-5 h-5 text-cta animate-spin flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-[14px] font-semibold text-[#1a1a1a]">
                Migration {provider} en cours
              </div>
              <div className="text-[12px] text-[#6b6b6b] mt-0.5">{message}</div>
            </div>
            <button
              type="button"
              onClick={onCancel}
              className="text-[12px] font-medium text-[#6b6b6b] hover:text-red-600 inline-flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Annuler
            </button>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-white overflow-hidden">
            <div
              className="h-full bg-cta transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="mt-1 text-[11px] text-[#6b6b6b]">{progress}%</div>
        </div>
      </div>
    </div>
  )
}

function HistoryItem({ job }) {
  const provider = (job.job_type || '').replace('migrate_', '')
  const { icon, color } = STATUS_META[job.status] || STATUS_META.queued

  const formatted = new Date(job.created_at).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const summary = job.result?.imported
    ? `${job.result.imported} tickets importés${job.result.skipped ? ` · ${job.result.skipped} ignorés` : ''}`
    : job.error || job.progress_message

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-[#E5E2D7] bg-white">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color.bg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[#1a1a1a] capitalize">
          {provider} · {STATUS_LABEL[job.status] || job.status}
        </div>
        <div className="text-[11px] text-[#6b6b6b] truncate">
          {formatted}{summary ? ` · ${summary}` : ''}
        </div>
      </div>
      {job.progress > 0 && job.progress < 100 && ['queued', 'running'].includes(job.status) && (
        <div className="text-[11px] font-mono text-[#1a1a1a]">{job.progress}%</div>
      )}
    </div>
  )
}

const STATUS_LABEL = {
  queued: 'En file',
  running: 'En cours',
  completed: 'Terminée',
  failed: 'Échouée',
  timeout: 'Délai dépassé',
  cancelled: 'Annulée',
}

const STATUS_META = {
  queued: { icon: <Clock className="w-4 h-4 text-[#6b6b6b]" />, color: { bg: 'bg-[#FAF9F4]' } },
  running: { icon: <Loader2 className="w-4 h-4 text-cta animate-spin" />, color: { bg: 'bg-cta/10' } },
  completed: { icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, color: { bg: 'bg-emerald-50' } },
  failed: { icon: <AlertTriangle className="w-4 h-4 text-red-500" />, color: { bg: 'bg-red-50' } },
  timeout: { icon: <AlertTriangle className="w-4 h-4 text-amber-500" />, color: { bg: 'bg-amber-50' } },
  cancelled: { icon: <X className="w-4 h-4 text-[#6b6b6b]" />, color: { bg: 'bg-[#FAF9F4]' } },
}

export default MigrationsView
