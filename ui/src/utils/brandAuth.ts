// Brand-passcode unlock flag. Persisted in localStorage (shared across tabs + browser
// restarts) with a 24h expiry, so entering a brand passcode once keeps that brand
// unlocked on this device for the window. Shared by the normal flow (BrandLayout /
// BrandSelectionPage / BrandPasscodeModal) and the CMS flow (CmsPostPage), keyed by the
// brandToSlug slug so an unlock in either flow carries over.
//
// NOTE: this is the brand *access* gate only. The FB scheduling passcode is a separate
// mechanism in utils/fbCredentials.ts (key `fb_passcode_<brand>`) and is not affected.

const PREFIX = 'kult_brand_auth_'
const TTL_MS = 24 * 60 * 60 * 1000 // 24h

// Stored value is the expiry timestamp (ms) as a string.
export function isBrandUnlocked(slug: string): boolean {
  const raw = localStorage.getItem(PREFIX + slug)
  if (!raw) return false
  const exp = Number(raw)
  if (!Number.isFinite(exp) || Date.now() >= exp) {
    localStorage.removeItem(PREFIX + slug) // expired → clean up
    return false
  }
  return true
}

export function setBrandUnlocked(slug: string): void {
  localStorage.setItem(PREFIX + slug, String(Date.now() + TTL_MS))
}

export function clearAllBrandAuth(): void {
  Object.keys(localStorage)
    .filter(k => k.startsWith(PREFIX))
    .forEach(k => localStorage.removeItem(k))
}
