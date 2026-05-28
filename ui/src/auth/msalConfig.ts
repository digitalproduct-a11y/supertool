import { type Configuration, LogLevel } from '@azure/msal-browser'

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
