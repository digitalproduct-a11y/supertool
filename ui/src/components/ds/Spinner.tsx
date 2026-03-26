interface SpinnerProps { size?: 'sm' | 'md' | 'lg'; inverse?: boolean }
const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }

export function Spinner({ size = 'md', inverse = false }: SpinnerProps) {
  return (
    <div
      className={`${sizes[size]} rounded-full border-4 animate-spin ${
        inverse
          ? 'border-white/20 border-t-white'
          : 'border-neutral-10 border-t-surface-active'
      }`}
    />
  )
}
