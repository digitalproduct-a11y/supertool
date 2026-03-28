import { useState, useEffect } from 'react'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
  createdAt: number
}

type Listener = (toasts: ToastItem[]) => void

// Module-level singleton — works outside React components
let toasts: ToastItem[] = []
const listeners: Listener[] = []

function notify() {
  listeners.forEach((l) => l([...toasts]))
}

function add(message: string, variant: ToastVariant) {
  const id = crypto.randomUUID()
  toasts = [...toasts, { id, message, variant, createdAt: Date.now() }]
  notify()
  return id
}

function dismiss(id: string) {
  toasts = toasts.filter((t) => t.id !== id)
  notify()
}

export const toast = {
  success: (message: string) => add(message, 'success'),
  error: (message: string) => add(message, 'error'),
  info: (message: string) => add(message, 'info'),
}

export function useToastStore() {
  const [items, setItems] = useState<ToastItem[]>([...toasts])

  useEffect(() => {
    listeners.push(setItems)
    return () => {
      const idx = listeners.indexOf(setItems)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }, [])

  return { toasts: items, dismiss }
}
