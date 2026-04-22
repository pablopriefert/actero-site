import React from 'react'
import { Download } from 'lucide-react'

/**
 * Small reusable "Export CSV" button.
 *
 * Usage:
 *   <ExportCsvButton
 *     filename="clients"
 *     rows={clients}
 *     columns={[
 *       { key: 'brand_name', label: 'Brand' },
 *       { key: 'plan', label: 'Plan' },
 *       { key: 'created_at', label: 'Created', format: (v) => new Date(v).toISOString() },
 *     ]}
 *   />
 *
 * Handles basic CSV escaping (quotes, commas, newlines) and triggers a
 * browser download without touching the server.
 */
function escapeCell(value) {
  if (value === null || value === undefined) return ''
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

export function buildCsv(rows, columns) {
  const header = columns.map((c) => escapeCell(c.label ?? c.key)).join(',')
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const raw = row?.[c.key]
          const formatted = c.format ? c.format(raw, row) : raw
          return escapeCell(formatted)
        })
        .join(','),
    )
    .join('\n')
  return header + '\n' + body + '\n'
}

export function ExportCsvButton({
  filename = 'export',
  rows = [],
  columns = [],
  label = 'Exporter CSV',
  className = '',
  disabled = false,
}) {
  const handleExport = () => {
    const csv = buildCsv(rows, columns)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}-${ts}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 250)
  }

  const isDisabled = disabled || rows.length === 0

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={isDisabled}
      className={
        className ||
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#f0f0f0] bg-white text-[12px] font-semibold text-[#1a1a1a] hover:bg-[#fafafa] disabled:opacity-40 disabled:cursor-not-allowed transition'
      }
      title={isDisabled ? 'Aucune donnée à exporter' : `Exporter ${rows.length} ligne(s)`}
    >
      <Download className="w-3.5 h-3.5" />
      {label}
    </button>
  )
}
