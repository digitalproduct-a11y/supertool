import { useIsAuthenticated, useMsal } from '@azure/msal-react'
import { InteractionStatus } from '@azure/msal-browser'
import { loginRequest } from '../auth/msalConfig'

const ALLOWED_DOMAIN = import.meta.env.VITE_AZURE_ALLOWED_DOMAIN ?? 'astro.com.my'

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { instance, inProgress } = useMsal()
  const isAuthenticated = useIsAuthenticated()

  // MSAL is initializing or handling the redirect callback
  if (inProgress !== InteractionStatus.None) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Signing you in…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold text-white tracking-tight">KULT Digital Kit</span>
            <span className="text-gray-400 text-sm">Internal tool · Astro</span>
          </div>
          <p className="text-gray-400 text-sm text-center leading-relaxed">
            Sign in with your Astro Microsoft account to continue.
          </p>
          <button
            onClick={() => instance.loginRedirect(loginRequest)}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-gray-900 font-medium text-sm rounded-lg px-4 py-3 transition-colors"
          >
            <MicrosoftLogo />
            Sign in with Microsoft
          </button>
        </div>
      </div>
    )
  }

  const account = instance.getActiveAccount() ?? instance.getAllAccounts()[0]
  const email = account?.username ?? ''

  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm flex flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <span className="text-2xl font-bold text-white tracking-tight">Access Denied</span>
            <span className="text-gray-400 text-sm">KULT Digital Kit · Astro</span>
          </div>
          <p className="text-gray-400 text-sm text-center leading-relaxed">
            <span className="text-white font-medium">{email}</span> is not authorised to use this tool.
            <br />
            Please sign in with your <span className="text-white">@{ALLOWED_DOMAIN}</span> account.
          </p>
          <button
            onClick={() => instance.logoutRedirect()}
            className="w-full bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-lg px-4 py-3 transition-colors"
          >
            Sign out and try again
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  )
}
