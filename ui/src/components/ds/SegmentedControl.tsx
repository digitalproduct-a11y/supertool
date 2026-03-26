interface Option<T extends string> { value: T; label: string }
interface SegmentedControlProps<T extends string> {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  disabled?: boolean
}

export function SegmentedControl<T extends string>({
  options, value, onChange, disabled
}: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex gap-1 bg-neutral-5 rounded-ds-md p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={[
            'px-ds-md py-ds-xs rounded-ds-sm text-ds-label2 font-mulish font-bold transition-colors',
            value === opt.value
              ? 'bg-surface-default text-fg-default shadow-ds-sm'
              : 'text-fg-strong hover:text-fg-default',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
