import { useState } from 'react'
import { IconHelpCircle } from '@tabler/icons-react'
import { Modal } from './Modal'

interface GuideModalProps {
  title: string
  children: React.ReactNode
}

export function GuideModal({ title, children }: GuideModalProps) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900 transition-colors border border-neutral-200 hover:border-neutral-400 rounded-lg px-3 py-1.5 shrink-0 bg-neutral-50 hover:bg-neutral-100"
        title="View guide"
      >
        <IconHelpCircle size={18} />
        Guide
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} size="lg">
        {children}
      </Modal>
    </>
  )
}
