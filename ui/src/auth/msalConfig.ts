import { PublicClientApplication, type Configuration, LogLevel } from '@azure/msal-browser'

export const msalConfig: Configuration = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'localStorage',
  },
  system: {
    // MSAL v5 default iframe timeout is 10s; raise to 20s so slower iframe boots
    // on Vercel preview deployments don't time out before silent token completes.
    iframeBridgeTimeout: 20000,
    loggerOptions: {
      loggerCallback: (_level, message, containsPii) => {
        if (containsPii || import.meta.env.PROD) return
        console.debug('[MSAL]', message)
      },
      piiLoggingEnabled: false,
      logLevel: LogLevel.Warning,
    },
  },
}

export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
}

// Single shared instance so non-React modules (e.g. services/historyLog.ts) can read the
// signed-in account without the useMsal() hook. main.tsx initialize()s this same object.
// IMPORTANT: this is constructed but NOT yet initialized. Callers must not invoke async
// MSAL APIs until main.tsx has resolved initialize(). Synchronous reads such as
// getActiveAccount()/getAllAccounts() are safe (they return empty before sign-in).
export const msalInstance = new PublicClientApplication(msalConfig)
