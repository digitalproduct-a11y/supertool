import { BRANDS } from '../constants/brands'
import type { BrandName } from '../constants/brands'

export function brandToSlug(brand: string): string {
  return brand.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export function slugToBrand(slug: string): BrandName | 'Admin' | null {
  if (slug === 'admin') return 'Admin'
  const found = BRANDS.find(b => brandToSlug(b) === slug)
  return found ?? null
}
