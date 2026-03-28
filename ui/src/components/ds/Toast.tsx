import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useToastStore, type ToastItem } from '../../hooks/useToast'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours() % 12 || 12
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM'
  return `Today ${h}:${m}${ampm}`
}

// ── Variants ─────────────────────────────────────────────────────────────────

const VARIANTS = {
  success: {
    icon: (
      <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      </div>
    ),
  },
  error: {
    icon: (
      <div className="w-9 h-9 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    ),
  },
  info: {
    icon: (
      <div className="w-9 h-9 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
        <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
    ),
  },
}

const AUTO_DISMISS_MS = 4000

// ── Single toast ─────────────────────────────────────────────────────────────

function Toast({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false)
  const { icon } = VARIANTS[item.variant]

  // Slide in
  useEffect(() => {
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    return () => cancelAnimationFrame(t)
  }, [])

  // Auto-dismiss
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(item.id), 300)
    }, AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [item.id, onDismiss])

  const handleClose = () => {
    setVisible(false)
    setTimeout(() => onDismiss(item.id), 300)
  }

  return (
    <div
      className={`flex items-center gap-3 bg-[#1e2d40] rounded-2xl px-4 py-3.5 min-w-[300px] max-w-[420px] pointer-events-auto transition-all duration-300 shadow-xl ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-3'
      }`}
    >
      {icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-snug truncate">{item.message}</p>
        <p className="text-xs text-slate-400 mt-0.5">{formatTime(item.createdAt)}</p>
      </div>
      <button
        onClick={handleClose}
        className="shrink-0 text-slate-500 hover:text-slate-300 transition-colors ml-1"
        aria-label="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

// ── Container ─────────────────────────────────────────────────────────────────

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore()

  return createPortal(
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((item) => (
        <Toast key={item.id} item={item} onDismiss={dismiss} />
      ))}
    </div>,
    document.body
  )
}
