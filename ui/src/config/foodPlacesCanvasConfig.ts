import { getBrandHex, BRAND_LOGO_IDS, type BrandName } from '../constants/brands'

export interface FoodPlacesCanvasConfig {
  width: number
  height: number
  accentColor: string
  logoPublicId: string | null
  fontFamily: {
    display: string
    body: string
    mono: string
  }
}

const FALLBACK_ACCENT = '#ff3fbf'

export function getFoodPlacesCanvasConfig(brand: string): FoodPlacesCanvasConfig {
  const brandHex = getBrandHex(brand)
  // Brands with #000000 fall back to the mockup's pink accent so place pills
  // don't disappear into the dark gradient overlay.
  const accentColor = brandHex === '#000000' ? FALLBACK_ACCENT : brandHex
  const logoPublicId = (BRAND_LOGO_IDS as Record<string, string>)[brand] ?? null

  return {
    width: 1080,
    height: 1350,
    accentColor,
    logoPublicId,
    fontFamily: {
      display: 'Space Grotesk',
      body: 'Inter',
      mono: 'JetBrains Mono',
    },
  }
}

export type { BrandName }
