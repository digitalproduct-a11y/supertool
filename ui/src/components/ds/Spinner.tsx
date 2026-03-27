interface SpinnerProps { size?: 'sm' | 'md' | 'lg'; inverse?: boolean }

const sizes = {
  sm: { outer: 'w-4 h-4', inner: 'inset-[3px]' },
  md: { outer: 'w-8 h-8', inner: 'inset-[5px]' },
  lg: { outer: 'w-12 h-12', inner: 'inset-[7px]' },
}

export function Spinner({ size = 'md', inverse = false }: SpinnerProps) {
  const { outer, inner } = sizes[size]
  return (
    <div
      className={`relative ${outer} rounded-full animate-spin flex-shrink-0`}
      style={{ background: 'conic-gradient(from 0deg, #FF3FBF, #00E5D4, #0055EE, #F05A35, transparent 75%)' }}
    >
      <div
        className={`absolute ${inner} rounded-full ${inverse ? 'bg-zinc-900' : 'bg-[#f0eeeb]'}`}
      />
    </div>
  )
}
