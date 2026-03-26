type TagVariant = 'primary' | 'secondary' | 'status-positive' | 'status-negative' | 'status-warning' | 'status-neutral'

interface TagProps { variant?: TagVariant; children: React.ReactNode }

const tagClasses: Record<TagVariant, string> = {
  primary: 'bg-surface-active text-fg-on-active',
  secondary: 'bg-neutral-5 border border-border-default text-fg-strong',
  'status-positive': 'bg-surface-success text-fg-on-success',
  'status-negative': 'bg-surface-error text-fg-on-error',
  'status-warning': 'bg-surface-warning text-fg-on-warning',
  'status-neutral': 'bg-neutral-5 text-fg-strong',
}

export function Tag({ variant = 'secondary', children }: TagProps) {
  return (
    <span className={`inline-flex items-center px-ds-sm py-[2px] rounded-ds-sm text-ds-label2 font-mulish font-bold ${tagClasses[variant]}`}>
      {children}
    </span>
  )
}
