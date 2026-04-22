const keyFor = (brand: string) => `fb_passcode_${brand.toLowerCase()}`

export interface FBCredentials {
  passcode: string
}

export function getCredentials(brand: string): FBCredentials | null {
  const raw = sessionStorage.getItem(keyFor(brand))
  if (!raw) return null
  try {
    return JSON.parse(raw) as FBCredentials
  } catch {
    return null
  }
}

export function saveCredentials(brand: string, passcode: string): void {
  sessionStorage.setItem(keyFor(brand), JSON.stringify({ passcode }))
}

export function clearCredentials(brand: string): void {
  sessionStorage.removeItem(keyFor(brand))
}
