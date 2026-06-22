import { useEffect, useRef, useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { type AccountInfo } from '@azure/msal-browser'
import { loginRequest } from '../auth/msalConfig'

type SessionState = 'idle' | 'minting' | 'ready' | 'failed'

const SNAPSHOT_ENABLED = import.meta.env.VITE_USE_DASHBOARD_SNAPSHOT === 'true'

// account: pass the MSAL AccountInfo when MSAL is ready, null otherwise.
// On mount, first checks GET /api/auth/session — if the existing cookie is
// still valid the user skips acquireTokenSilent entirely (avoids iframe silent
// auth failures from third-party cookie restrictions in modern browsers).
export function useSession(account: AccountInfo | null): { state: SessionState; mint: () => Promise<void> } {
  const { instance } = useMsal()
  const [state, setState] = useState<SessionState>(SNAPSHOT_ENABLED ? 'idle' : 'ready')
  const startedRef = useRef(false)

  // Only updated when account is non-null — survives momentary MSAL cache gaps.
  const lastAccountRef = useRef<AccountInfo | null>(null)
  if (account !== null) lastAccountRef.current = account

  const mint = async () => {
    setState('minting')
    try {
      // Fast path: existing session cookie is still valid — skip MSAL entirely.
      const check = await fetch('/api/auth/session', { method: 'GET', credentials: 'include' })
      if (check.ok) {
        setState('ready')
        return
      }
    } catch {
      // Network error — fall through to full mint
    }

    // Cookie missing or expired — acquire a fresh MSAL id_token and mint.
    try {
      const acc = lastAccountRef.current
      if (!acc) {
        setState('failed')
        return
      }
      const tokenResult = await instance.acquireTokenSilent({ ...loginRequest, account: acc })
      const resp = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenResult.idToken}` },
        credentials: 'include',
      })
      if (resp.ok) {
        setState('ready')
      } else {
        setState('failed')
      }
    } catch {
      // Silent acquisition failed (expired refresh token, iframe blocked by
      // third-party cookie policy, etc.). Redirect to Microsoft — the user is
      // already signed in so the redirect comes back instantly with fresh tokens.
      try {
        await instance.loginRedirect(loginRequest)
      } catch {
        setState('failed')
      }
    }
  }

  const hasAccount = account !== null
  useEffect(() => {
    if (!hasAccount) return
    if (!SNAPSHOT_ENABLED) return
    if (startedRef.current) return
    startedRef.current = true
    void mint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccount])

  return { state, mint }
}
