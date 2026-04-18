import React from 'react'

/**
 * Skeleton — shimmer placeholder that matches final content dimensions.
 *
 * Why: ui-ux-pro-max priority 3 `progressive-loading` — skeleton screens
 * outperform spinners for >300ms loads because they preserve layout (no CLS)
 * and convey "something is coming" vs "it's stuck".
 *
 * Usage:
 *   {isLoading ? <Skeleton className="h-4 w-24" /> : <span>{value}</span>}
 *
 * Variants (presets for the most common layouts):
 *   <SkeletonStat />        — single KPI card
 *   <SkeletonStatRow n={4}/>— 4-up KPI grid (matches ClientDashboard)
 *   <SkeletonCard />        — generic card with header + body
 *   <SkeletonList n={5} />  — list of rows (activity feed, etc.)
 *
 * All variants respect prefers-reduced-motion via the `animate-pulse` class
 * which Tailwind already disables when reduce-motion is ON.
 */

export function Skeleton({ className = '', ...rest }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-[#f0f0f0] ${className}`}
      aria-hidden="true"
      {...rest}
    />
  )
}

/** Single KPI card placeholder — label + big number + sublabel. */
export function SkeletonStat({ className = '' }) {
  return (
    <div className={`px-5 py-5 ${className}`}>
      <Skeleton className="h-3 w-3/4 mb-3" />
      <Skeleton className="h-7 w-20 mb-2" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  )
}

/** 4-up KPI row matching ClientDashboard overview. */
export function SkeletonStatRow({ n = 4 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-0 bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] overflow-hidden mb-8">
      {Array.from({ length: n }).map((_, i) => (
        <SkeletonStat key={i} className={i < n - 1 ? 'border-r border-[#f0f0f0]' : ''} />
      ))}
    </div>
  )
}

/** Generic card with optional header + body rows. */
export function SkeletonCard({ rows = 3, showHeader = true, className = '' }) {
  return (
    <div className={`bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-[#f0f0f0] p-6 ${className}`}>
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-16" />
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  )
}

/** List of rows — for activity feed, tickets, etc. */
export function SkeletonList({ n = 5, rowClass = '' }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className={`flex items-center gap-3 p-3 bg-white rounded-xl border border-[#f0f0f0] ${rowClass}`}
        >
          <Skeleton className="w-8 h-8 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-2.5 w-1/2" />
          </div>
          <Skeleton className="h-3 w-12 flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}
