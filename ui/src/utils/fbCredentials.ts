const keyFor = (brand: string) => `fb_passcode_${brand.toLowerCase()}`

export interface FBCredentials {
  passcode: string
}

export function getCredentials(brand: string): FBCredentials | null {
  const raw = localStorage.getItem(keyFor(brand))
  if (!raw) return null
  try {
    return JSON.parse(raw) as FBCredentials
  } catch {
    return null
  }
}

export function saveCredentials(brand: string, passcode: string): void {
  localStorage.setItem(keyFor(brand), JSON.stringify({ passcode }))
}

export function clearCredentials(brand: string): void {
  localStorage.removeItem(keyFor(brand))
}
