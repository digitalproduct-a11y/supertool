import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'inverse-primary' | 'inverse-secondary' | 'destructive'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  loading?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-surface-active text-fg-on-active hover:bg-surface-hover disabled:bg-surface-disabled disabled:text-fg-disabled',
  secondary:
    'bg-transparent border border-border-active text-fg-default hover:bg-neutral-5 disabled:border-border-default disabled:text-fg-disabled',
  tertiary:
    'bg-transparent text-fg-default hover:bg-neutral-5 disabled:text-fg-disabled',
  'inverse-primary':
    'bg-fg-on-active text-surface-active hover:bg-neutral-5 disabled:bg-neutral-10 disabled:text-fg-disabled',
  'inverse-secondary':
    'bg-transparent border border-fg-on-active text-fg-on-active hover:bg-white/10 disabled:border-fg-disabled disabled:text-fg-disabled',
  destructive:
    'bg-surface-error border border-border-error text-fg-on-error hover:bg-red-50 disabled:opacity-50',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-ds-md py-ds-xs text-ds-label2 rounded-ds-md',
  md: 'px-ds-lg py-ds-sm text-ds-label1 rounded-ds-md',
  lg: 'px-ds-xl py-ds-md text-ds-body1-strong rounded-ds-lg',
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2 font-mulish font-bold transition-colors active:scale-[0.98]',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? 'w-full' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {loading ? (
        <>
          <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          {children}
        </>
      ) : (
        children
      )}
    </button>
  )
}
