/**
 * Actero theme toggle — light / dark / system.
 *
 * Persists user preference in localStorage, respects OS preference as default,
 * applies the class on <html> so Tailwind v4 dark: variants + our
 * CSS vars (html.dark block in index.css) both activate.
 *
 * Usage:
 *   import { useTheme } from '@/lib/theme'
 *   const { theme, setTheme } = useTheme()
 *   <button onClick={() => setTheme('dark')}>Dark</button>
 *
 * Note: individual component dark:* classes must be added progressively —
 * the token vars carry most of the lift but specific layouts may still need
 * conditional padding / elevation tweaks.
 */
import { useEffect, useState, useCallback } from 'react'

export type Theme = 'light' | 'dark' | 'system'
const STORAGE_KEY = 'actero-theme'

function getSystemPref(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  const resolved = theme === 'system' ? getSystemPref() : theme
  if (resolved === 'dark') document.documentElement.classList.add('dark')
  else document.documentElement.classList.remove('dark')
}

/** Reads the persisted theme preference, defaults to 'system'. */
export function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

/** Sets + persists the theme, then applies it. */
export function setStoredTheme(theme: Theme) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, theme)
  }
  applyTheme(theme)
}

/** Initializes the theme on app boot — call once from main.jsx. */
export function initTheme() {
  const theme = getStoredTheme()
  applyTheme(theme)
  // Watch for system preference changes when user picked 'system'.
  if (typeof window !== 'undefined') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', () => {
      if (getStoredTheme() === 'system') applyTheme('system')
    })
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme)
  const setTheme = useCallback((next: Theme) => {
    setStoredTheme(next)
    setThemeState(next)
  }, [])
  useEffect(() => {
    applyTheme(theme)
  }, [theme])
  const resolved = theme === 'system' ? getSystemPref() : theme
  return { theme, resolved, setTheme }
}
