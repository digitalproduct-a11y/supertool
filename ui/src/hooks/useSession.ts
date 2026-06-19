import { useEffect, useRef, useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { loginRequest } from '../auth/msalConfig'

type SessionState = 'idle' | 'minting' | 'ready' | 'failed'

// Mints the astro_session cookie once per app load. Returns the current state so
// AuthGate can hold the UI until the cookie is in place before rendering protected
// routes. Idempotent — subsequent renders no-op when the cookie has been minted.
export function useSession(): { state: SessionState; mint: () => Promise<void> } {
  const { instance } = useMsal()
  const [state, setState] = useState<SessionState>('idle')
  const startedRef = useRef(false)

  const mint = async () => {
    setState('minting')
    try {
      const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0]
      if (!account) {
        setState('failed')
        return
      }
      const tokenResult = await instance.acquireTokenSilent({ ...loginRequest, account })
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
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        await instance.loginRedirect(loginRequest)
      } else {
        setState('failed')
      }
    }
  }

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    if (import.meta.env.VITE_USE_DASHBOARD_SNAPSHOT !== 'true') {
      setState('ready')
      return
    }
    void mint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { state, mint }
}
