const SESSION_KEY = 'kult_admin_auth_token'

export function saveAdminToken(token: string): void {
  sessionStorage.setItem(SESSION_KEY, token)
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(SESSION_KEY)
}

/** Returns true if a valid, non-expired token is present */
export function isAdminAuthed(): boolean {
  const token = sessionStorage.getItem(SESSION_KEY)
  if (!token) return false
  const [expiresAtStr] = token.split('.')
  const expiresAt = Number(expiresAtStr)
  return !isNaN(expiresAt) && Date.now() < expiresAt
}
