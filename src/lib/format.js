/**
 * Shared fr-FR display formatters for the client dashboard.
 *
 * Use these for any value a merchant reads (KPI cards, tables, summaries).
 * Do NOT use for API payloads, logs, or internal debug strings.
 */

const currencyFmt = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
})

const numberFmt = new Intl.NumberFormat('fr-FR')

/** 1234.5 → "1 234,50 €" */
export function formatCurrency(n) {
  return currencyFmt.format(Number(n) || 0)
}

/** 1234567 → "1 234 567" */
export function formatNumber(n) {
  return numberFmt.format(Number(n) || 0)
}

/**
 * "à l'instant" / "il y a 3 min" / "il y a 2 h" / "il y a 4 j",
 * falling back to a fr-FR date beyond ~7 days.
 *
 * Supabase returns `timestamp without time zone` stored as UTC; if the
 * string has no timezone suffix we append 'Z' so it parses as UTC.
 */
export function formatRelativeTime(date) {
  if (!date) return ''
  const dateStr =
    typeof date === 'string' && !date.endsWith('Z') && !date.includes('+')
      ? date + 'Z'
      : date
  const parsed = new Date(dateStr)
  if (Number.isNaN(parsed.getTime())) return ''

  const seconds = Math.floor((Date.now() - parsed.getTime()) / 1000)
  if (seconds < 0 || seconds < 60) return "à l'instant"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `il y a ${days} j`
  return parsed.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}
