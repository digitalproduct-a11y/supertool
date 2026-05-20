import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { BRANDS } from '../constants/brands'
import type { BrandName } from '../constants/brands'

export type BrandValue = BrandName | 'Admin' | null

interface BrandContextType {
  selectedBrand: BrandValue
  setSelectedBrand: (brand: BrandValue) => void
  clearBrand: () => void
  isAdmin: boolean
}

const BrandContext = createContext<BrandContextType | undefined>(undefined)

const STORAGE_KEY = 'kult_selected_brand'

function initializeBrand(): BrandValue {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null

    // Admin is session-only — never restore from localStorage
    if (stored === 'Admin') return null
    const isValid = BRANDS.includes(stored as BrandName)
    return isValid ? (stored as BrandValue) : null
  } catch {
    return null
  }
}

export function BrandProvider({ children }: { children: ReactNode }) {
  const [selectedBrand, setSelectedBrandState] = useState<BrandValue>(initializeBrand)

  const setSelectedBrand = (brand: BrandValue) => {
    setSelectedBrandState(brand)
    if (brand === null) {
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // silently fail if localStorage is unavailable
      }
    } else {
      // Admin is session-only — never persist to localStorage
      if (brand === 'Admin') return
      // Validate brand before writing to localStorage
      const isValid = BRANDS.includes(brand as BrandName)
      if (isValid) {
        try {
          localStorage.setItem(STORAGE_KEY, brand)
        } catch {
          // silently fail if localStorage is unavailable
        }
      }
      // If invalid, skip localStorage write but still update state
    }
  }

  const clearBrand = () => {
    setSelectedBrand(null)
  }

  const isAdmin = selectedBrand === 'Admin'

  return (
    <BrandContext.Provider
      value={{
        selectedBrand,
        setSelectedBrand,
        clearBrand,
        isAdmin,
      }}
    >
      {children}
    </BrandContext.Provider>
  )
}

export function useBrand(): BrandContextType {
  const context = useContext(BrandContext)
  if (context === undefined) {
    throw new Error('useBrand must be used within a BrandProvider')
  }
  return context
}
