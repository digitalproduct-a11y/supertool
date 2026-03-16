import { useEffect, useState, useRef } from 'react'
import { PROGRESS_STEPS } from '../types'

interface ProgressStepsProps {
  isComplete: boolean
}

export function ProgressSteps({ isComplete }: ProgressStepsProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isComplete) {
      setCurrentStep(PROGRESS_STEPS.length)
      return
    }

    function advance(step: number) {
      if (step >= PROGRESS_STEPS.length - 1) return
      timerRef.current = setTimeout(() => {
        setCurrentStep(step + 1)
        advance(step + 1)
      }, PROGRESS_STEPS[step].duration)
    }

    advance(0)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isComplete])

  return (
    <div className="space-y-3 py-2">
      {PROGRESS_STEPS.map((step, i) => {
        const isDone = i < currentStep || isComplete
        const isActive = i === currentStep && !isComplete

        return (
          <div key={step.label} className="flex items-center gap-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-500 ${
              isDone
                ? 'bg-green-500 text-white'
                : isActive
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-400'
            }`}>
              {isDone ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              ) : isActive ? (
                <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
              ) : (
                <div className="w-2 h-2 rounded-full bg-gray-300" />
              )}
            </div>
            <span className={`text-sm font-medium transition-colors ${
              isDone ? 'text-green-600' : isActive ? 'text-indigo-700' : 'text-gray-400'
            }`}>
              {step.label}
              {isActive && <span className="ml-1 animate-pulse">...</span>}
            </span>
          </div>
        )
      })}
    </div>
  )
}
