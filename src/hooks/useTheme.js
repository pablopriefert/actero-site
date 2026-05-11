import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'actero-theme';
const VALID_THEMES = ['light', 'dark', 'system'];

/**
 * useTheme — gestion du thème light/dark/system pour Actero.
 *
 * - State : 'light' | 'dark' | 'system'
 * - Persiste dans localStorage sous la clé 'actero-theme'
 * - Écoute prefers-color-scheme quand mode = 'system'
 * - Applique la classe 'dark' sur document.documentElement
 */
export function useTheme() {
  // Lire la préférence initiale de manière sûre (SSR-friendly + fallback)
  const getInitialTheme = () => {
    if (typeof window === 'undefined') return 'system';
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && VALID_THEMES.includes(stored)) return stored;
    } catch {
      // localStorage inaccessible (ex: Safari privé)
    }
    return 'system';
  };

  const [theme, setThemeState] = useState(getInitialTheme);

  // Calcule le thème résolu (dark/light) en tenant compte de 'system'
  const getResolvedTheme = useCallback((t) => {
    if (t === 'system') {
      if (typeof window === 'undefined') return 'light';
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return t;
  }, []);

  const [resolvedTheme, setResolvedTheme] = useState(() => getResolvedTheme(theme));

  // Sync resolvedTheme during render when theme changes (no effect needed)
  const resolved = getResolvedTheme(theme);
  if (resolved !== resolvedTheme) {
    setResolvedTheme(resolved);
  }

  // Applique la classe 'dark' sur <html> via DOM side-effect
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const r = getResolvedTheme(theme);
    const root = document.documentElement;
    if (r === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme, getResolvedTheme]);

  // Effet : écoute les changements système quand mode = 'system'
  useEffect(() => {
    if (theme !== 'system' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const newResolved = getResolvedTheme('system');
      setResolvedTheme(newResolved);
      if (typeof document !== 'undefined') {
        const root = document.documentElement;
        if (newResolved === 'dark') root.classList.add('dark');
        else root.classList.remove('dark');
      }
    };
    // addEventListener est standard ; fallback addListener pour vieux Safari
    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, [theme, getResolvedTheme]);

  // Setter public qui persiste
  const setTheme = useCallback((newTheme) => {
    if (!VALID_THEMES.includes(newTheme)) return;
    try {
      localStorage.setItem(STORAGE_KEY, newTheme);
    } catch {
      // ignore
    }
    setThemeState(newTheme);
  }, []);

  return { theme, setTheme, resolvedTheme };
}
