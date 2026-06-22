import { useEffect, useRef, useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { InteractionRequiredAuthError } from '@azure/msal-browser'
import { loginRequest } from '../auth/msalConfig'

type SessionState = 'idle' | 'minting' | 'ready' | 'failed'

const SNAPSHOT_ENABLED = import.meta.env.VITE_USE_DASHBOARD_SNAPSHOT === 'true'

// Mints the astro_session cookie once MSAL is ready. Pass enabled=true only after
// isAuthenticated && inProgress === InteractionStatus.None so getAllAccounts() is populated.
export function useSession(enabled = false): { state: SessionState; mint: () => Promise<void> } {
  const { instance } = useMsal()
  const [state, setState] = useState<SessionState>(SNAPSHOT_ENABLED ? 'idle' : 'ready')
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
    if (!enabled) return
    if (!SNAPSHOT_ENABLED) return
    if (startedRef.current) return
    startedRef.current = true
    void mint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  return { state, mint }
}
