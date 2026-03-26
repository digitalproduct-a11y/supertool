interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'lg'
}

export function Modal({ open, onClose, title, children, size = 'sm' }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-neutral-100/40 backdrop-blur-sm flex items-center justify-center z-50 p-ds-lg" onClick={onClose}>
      <div
        className={`bg-surface-default rounded-ds-xl shadow-ds-lg w-full ${size === 'lg' ? 'max-w-2xl' : 'max-w-sm'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-ds-xl pt-ds-xl pb-ds-lg border-b border-border-default">
          <h2 className="text-ds-body1-strong font-mulish text-fg-default">{title}</h2>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg-default transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-ds-xl py-ds-lg">{children}</div>
      </div>
    </div>
  )
}
