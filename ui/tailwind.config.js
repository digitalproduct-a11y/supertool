/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      animation: {
        'shimmer': 'shimmer 1.8s ease-in-out infinite',
        'blob': 'blob-drift 18s ease-in-out infinite',
        'stripe-grow': 'stripe-grow 0.6s cubic-bezier(0.25, 1, 0.5, 1) 0.2s both',
      },
      keyframes: {
        shimmer: {
          'from': { backgroundPosition: '-200% center' },
          'to':   { backgroundPosition: '200% center' },
        },
        'blob-drift': {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '33%':       { transform: 'translate(30px, -20px) scale(1.05)' },
          '66%':       { transform: 'translate(-20px, 15px) scale(0.97)' },
        },
        'stripe-grow': {
          'from': { width: '0', opacity: '0' },
          'to':   { width: '96px', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
