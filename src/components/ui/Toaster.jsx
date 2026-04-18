import React from 'react'
import { Toaster as SonnerToaster } from 'sonner'

/**
 * Global Toaster for Actero.
 * - Position: bottom-right
 * - Theme: system (light/dark aware)
 * - Default duration: 5s, 8s for undo/action toasts (set per-call)
 * - Max 3 visible, rest collapse
 * - Rounded-xl, subtle slide-in
 *
 * Mount once near the root (App.jsx already wraps everything).
 */
export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      theme="system"
      duration={5000}
      visibleToasts={3}
      closeButton={false}
      richColors={false}
      expand={false}
      gap={8}
      offset={24}
      toastOptions={{
        classNames: {
          toast: 'actero-toast group pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg text-sm font-medium bg-white dark:bg-[#1a1a1a] border-[#e5e5e5] dark:border-[#2a2a2a] text-[#1a1a1a] dark:text-white',
          title: 'text-sm font-medium leading-tight',
          description: 'text-xs text-[#71717a] dark:text-[#a1a1aa] mt-0.5',
          actionButton: 'actero-toast-action ml-auto text-xs font-semibold text-cta dark:text-emerald-400 hover:underline underline-offset-2 transition-colors bg-transparent border-0 cursor-pointer px-2 py-1',
          cancelButton: 'text-xs font-medium text-[#71717a] hover:text-[#1a1a1a] dark:hover:text-white bg-transparent border-0 cursor-pointer',
          success: 'actero-toast-success border-cta/20',
          error: 'actero-toast-error border-red-200 dark:border-red-900',
          warning: 'actero-toast-warning border-amber-200 dark:border-amber-900',
          info: 'actero-toast-info border-blue-200 dark:border-blue-900',
          closeButton: 'text-[#71717a] hover:text-[#1a1a1a]',
        },
      }}
    />
  )
}

export default Toaster
