import { useEffect, useRef, useState } from 'react'
import { useMsal } from '@azure/msal-react'
import { InteractionRequiredAuthError, type AccountInfo } from '@azure/msal-browser'
import { loginRequest } from '../auth/msalConfig'

type SessionState = 'idle' | 'minting' | 'ready' | 'failed'

const SNAPSHOT_ENABLED = import.meta.env.VITE_USE_DASHBOARD_SNAPSHOT === 'true'

// account: pass the MSAL AccountInfo when MSAL is ready, null otherwise.
// Minting fires once when account transitions null → non-null. The last
// non-null account is preserved in a ref so mint() never re-queries
// getAllAccounts() (which can be briefly empty during MSAL cache hydration).
export function useSession(account: AccountInfo | null): { state: SessionState; mint: () => Promise<void> } {
  const { instance } = useMsal()
  const [state, setState] = useState<SessionState>(SNAPSHOT_ENABLED ? 'idle' : 'ready')
  const startedRef = useRef(false)

  // Only updated when account is non-null — survives momentary MSAL cache gaps.
  const lastAccountRef = useRef<AccountInfo | null>(null)
  if (account !== null) lastAccountRef.current = account

  const mint = async () => {
    console.log('[useSession] mint()', { lastAccount: lastAccountRef.current?.username ?? null, allAccounts: instance.getAllAccounts().length })
    setState('minting')
    try {
      const acc = lastAccountRef.current
      if (!acc) {
        console.log('[useSession] no account → failed')
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
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        await instance.loginRedirect(loginRequest)
      } else {
        setState('failed')
      }
    }
  }

  const hasAccount = account !== null
  useEffect(() => {
    console.log('[useSession] effect', { hasAccount, started: startedRef.current, lastAccount: lastAccountRef.current?.username ?? null })
    if (!hasAccount) return
    if (!SNAPSHOT_ENABLED) return
    if (startedRef.current) return
    startedRef.current = true
    void mint()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAccount])

  return { state, mint }
}
