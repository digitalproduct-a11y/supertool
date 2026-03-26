import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  success?: string
  trailingAction?: React.ReactNode
}

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

const baseInput =
  'w-full px-ds-lg py-ds-sm font-mulish text-ds-body1 text-fg-default bg-surface-default border border-border-default rounded-ds-md placeholder:text-fg-subtle focus:outline-none focus:border-border-active focus:ring-1 focus:ring-border-active disabled:bg-surface-disabled disabled:text-fg-disabled transition-colors'

export function TextField({ label, hint, error, success, trailingAction, className = '', ...props }: TextFieldProps) {
  return (
    <div className="space-y-ds-xs">
      {label && <label className="block text-ds-label1 text-fg-default font-mulish">{label}</label>}
      <div className="relative">
        <input
          className={[
            baseInput,
            error ? 'border-border-error focus:ring-border-error' : '',
            trailingAction ? 'pr-10' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          {...props}
        />
        {trailingAction && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">{trailingAction}</div>
        )}
      </div>
      {error && <p className="text-ds-caption text-fg-on-error">{error}</p>}
      {success && !error && <p className="text-ds-caption text-fg-on-success">{success}</p>}
      {hint && !error && !success && <p className="text-ds-caption text-fg-subtle">{hint}</p>}
    </div>
  )
}

export function TextAreaField({ label, hint, error, className = '', ...props }: TextAreaFieldProps) {
  return (
    <div className="space-y-ds-xs">
      {label && <label className="block text-ds-label1 text-fg-default font-mulish">{label}</label>}
      <textarea
        className={[
          baseInput,
          'resize-none',
          error ? 'border-border-error focus:ring-border-error' : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...props}
      />
      {error && <p className="text-ds-caption text-fg-on-error">{error}</p>}
      {hint && !error && <p className="text-ds-caption text-fg-subtle">{hint}</p>}
    </div>
  )
}
