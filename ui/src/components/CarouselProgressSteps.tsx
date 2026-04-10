import { useEffect, useState, useRef } from 'react'
import { CAROUSEL_PROGRESS_STEPS } from '../types'

interface CarouselProgressStepsProps {
  isComplete: boolean
}

export function CarouselProgressSteps({ isComplete }: CarouselProgressStepsProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isComplete) {
      setCurrentStep(CAROUSEL_PROGRESS_STEPS.length)
      return
    }

    function advance(step: number) {
      if (step >= CAROUSEL_PROGRESS_STEPS.length - 1) return
      timerRef.current = setTimeout(() => {
        setCurrentStep(step + 1)
        advance(step + 1)
      }, CAROUSEL_PROGRESS_STEPS[step].duration)
    }

    advance(0)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isComplete])

  return (
    <div className="space-y-3 py-2">
      {CAROUSEL_PROGRESS_STEPS.map((step, i) => {
        const isDone = i < currentStep || isComplete
        const isActive = i === currentStep && !isComplete

        return (
          <div
            key={step.label}
            className="flex items-start gap-3 animate-step-enter"
            style={{ animationDelay: `${i * 90}ms` }}
          >
            <div
              className={`w-6 h-6 mt-0.5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
                isDone
                  ? 'bg-green-500 text-white'
                  : isActive
                  ? 'text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
              style={isActive ? { background: 'linear-gradient(135deg, #FF3FBF, #0055EE, #00E5D4)', boxShadow: '0 0 8px rgba(0,85,238,0.4)' } : undefined}
            >
              {isDone ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : isActive ? (
                <div className="w-2 h-2 rounded-full bg-white animate-pulse shadow-[0_0_4px_rgba(255,255,255,0.9)]" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-gray-300" />
              )}
            </div>
            <div>
              <span className={`text-sm font-medium transition-colors ${
                isDone ? 'text-green-600' : isActive ? 'text-rainbow' : 'text-gray-400'
              }`}>
                {step.label}
                {isActive && <span className="ml-1 animate-pulse-strong">…</span>}
              </span>
              {isActive && 'subtitle' in step && (
                <p className="text-xs text-gray-400 mt-0.5 animate-slide-down">{step.subtitle}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
