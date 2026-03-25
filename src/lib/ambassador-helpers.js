// ─── Ambassador Status Labels & Colors ───

export const LEAD_STATUS_MAP = {
  submitted: { label: 'Soumis', color: 'bg-gray-500/20 text-gray-400', border: 'border-gray-500/20', dot: 'bg-gray-400' },
  contacted: { label: 'Contact\u00e9', color: 'bg-blue-500/20 text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-400' },
  qualified: { label: 'Qualifi\u00e9', color: 'bg-purple-500/20 text-purple-400', border: 'border-purple-500/20', dot: 'bg-purple-400' },
  audit_booked: { label: 'Audit planifi\u00e9', color: 'bg-indigo-500/20 text-indigo-400', border: 'border-indigo-500/20', dot: 'bg-indigo-400' },
  audit_done: { label: 'Audit r\u00e9alis\u00e9', color: 'bg-cyan-500/20 text-cyan-400', border: 'border-cyan-500/20', dot: 'bg-cyan-400' },
  closing_in_progress: { label: 'Closing en cours', color: 'bg-amber-500/20 text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-400' },
  won: { label: 'Gagn\u00e9', color: 'bg-green-500/20 text-green-400', border: 'border-green-500/20', dot: 'bg-green-400' },
  lost: { label: 'Perdu', color: 'bg-red-500/20 text-red-400', border: 'border-red-500/20', dot: 'bg-red-400' },
}

export const COMMISSION_STATUS_MAP = {
  pending: { label: 'En attente', color: 'bg-gray-500/20 text-gray-400', border: 'border-gray-500/20', dot: 'bg-gray-400' },
  waiting_30_days: { label: 'D\u00e9lai J+30', color: 'bg-amber-500/20 text-amber-400', border: 'border-amber-500/20', dot: 'bg-amber-400' },
  eligible: { label: '\u00c9ligible', color: 'bg-blue-500/20 text-blue-400', border: 'border-blue-500/20', dot: 'bg-blue-400' },
  approved: { label: 'Valid\u00e9e', color: 'bg-green-500/20 text-green-400', border: 'border-green-500/20', dot: 'bg-green-400' },
  paid: { label: 'Pay\u00e9e', color: 'bg-emerald-500/20 text-emerald-400', border: 'border-emerald-500/20', dot: 'bg-emerald-400' },
  cancelled: { label: 'Annul\u00e9e', color: 'bg-red-500/20 text-red-400', border: 'border-red-500/20', dot: 'bg-red-400' },
}

export const AMBASSADOR_STATUS_MAP = {
  pending: { label: 'En attente', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  active: { label: 'Actif', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  suspended: { label: 'Suspendu', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
  inactive: { label: 'Inactif', color: 'text-gray-400 bg-gray-400/10 border-gray-400/20' },
}

export const APPLICATION_STATUS_MAP = {
  new: { label: 'Nouveau', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  reviewed: { label: 'Examin\u00e9', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' },
  approved: { label: 'Approuv\u00e9', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' },
  rejected: { label: 'Rejet\u00e9', color: 'text-red-400 bg-red-400/10 border-red-400/20' },
}

// Lead event type labels for timeline
export const LEAD_EVENT_LABELS = {
  submitted: 'Lead soumis',
  contacted: 'Contact \u00e9tabli',
  qualified: 'Lead qualifi\u00e9',
  audit_booked: 'Audit planifi\u00e9',
  audit_done: 'Audit r\u00e9alis\u00e9',
  closing: 'Closing en cours',
  won: 'Lead gagn\u00e9',
  lost: 'Lead perdu',
  note_added: 'Note ajout\u00e9e',
}

export const COMMISSION_EVENT_LABELS = {
  created: 'Commission cr\u00e9\u00e9e',
  client_paid: 'Client a pay\u00e9',
  j30_started: 'D\u00e9lai J+30 d\u00e9marr\u00e9',
  eligible: 'Commission \u00e9ligible',
  approved: 'Commission approuv\u00e9e',
  paid: 'Commission pay\u00e9e',
  cancelled: 'Commission annul\u00e9e',
  note_added: 'Note ajout\u00e9e',
}

// Lead status pipeline order for progress display
export const LEAD_PIPELINE = [
  'submitted', 'contacted', 'qualified', 'audit_booked', 'audit_done', 'closing_in_progress', 'won',
]

/**
 * Calculate J+30 countdown info
 * @param {string} eligibilityDate - ISO date string
 * @returns {{ daysLeft: number, isEligible: boolean, label: string }}
 */
export function getJ30Countdown(eligibilityDate) {
  if (!eligibilityDate) return { daysLeft: null, isEligible: false, label: 'Date non d\u00e9finie' }
  const now = new Date()
  const target = new Date(eligibilityDate)
  const diff = target - now
  const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (daysLeft <= 0) return { daysLeft: 0, isEligible: true, label: '\u00c9ligible' }
  return { daysLeft, isEligible: false, label: `J-${daysLeft}` }
}

/**
 * Validate email format
 */
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * Validate phone format (loose)
 */
export function isValidPhone(phone) {
  if (!phone) return true
  return /^[+\d\s()-]{6,20}$/.test(phone)
}
