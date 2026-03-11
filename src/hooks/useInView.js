import { useState, useEffect, useRef, useMemo } from 'react'

/**
 * Hook to detect when an element is in view.
 * @param {IntersectionObserverInit} options - The options for the IntersectionObserver.
 * @returns {[React.RefObject, boolean]} - The ref and the in-view status.
 */
export function useInView(options = {}) {
  const ref = useRef(null)
  const [isInView, setIsInView] = useState(false)

  // Mémorisation des options primitives pour éviter les boucles infinies
  const rootMargin = options.rootMargin || '0px'
  const threshold = options.threshold || 0
  const root = options.root || null

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsInView(true)
        // Auto-unobserve after first intersection as per existing logic (mostly)
        // or just keep tracking if needed. The original logic had observer.unobserve(entry.target);
        // so I'll keep it for compatibility but allow it to be configurable if needed.
        observer.unobserve(entry.target)
      }
    }, { root, rootMargin, threshold })

    const currentRef = ref.current
    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [rootMargin, threshold, root])

  return [ref, isInView]
}
