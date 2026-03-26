type AlertVariant = 'neutral' | 'warning' | 'negative' | 'positive' | 'info'

interface AlertProps {
  variant?: AlertVariant
  title?: string
  message: string
  action?: React.ReactNode
}

const config: Record<AlertVariant, { surface: string; text: string; icon: string }> = {
  neutral: { surface: 'bg-surface-subtle border-border-default', text: 'text-fg-default', icon: 'text-fg-strong' },
  warning: { surface: 'bg-surface-warning border-orange-200', text: 'text-fg-on-warning', icon: 'text-fg-on-warning' },
  negative: { surface: 'bg-surface-error border-border-error', text: 'text-fg-on-error', icon: 'text-fg-on-error' },
  positive: { surface: 'bg-surface-success border-border-success', text: 'text-fg-on-success', icon: 'text-fg-on-success' },
  info: { surface: 'bg-surface-info border-blue-200', text: 'text-blue-700', icon: 'text-blue-600' },
}

export function Alert({ variant = 'neutral', title, message, action }: AlertProps) {
  const c = config[variant]
  return (
    <div className={`flex gap-ds-md p-ds-lg rounded-ds-lg border ${c.surface}`}>
      <div className="flex-1">
        {title && <p className={`text-ds-body2-strong font-mulish ${c.text} mb-1`}>{title}</p>}
        <p className={`text-ds-body2 font-mulish ${c.text}`}>{message}</p>
        {action && <div className="mt-ds-sm">{action}</div>}
      </div>
    </div>
  )
}
