import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { MsalProvider } from '@azure/msal-react'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { BrandProvider } from './context/BrandContext'
import { AuthGate } from './components/AuthGate.tsx'
import { msalInstance } from './auth/msalConfig.ts'
const router = createBrowserRouter([{ path: '*', element: <App /> }])

// MSAL v3+ requires initialize() before any API call. Without it, silent
// iframe acquisition can hang because the broadcast-channel listener
// isn't fully set up. This matters for the silent-iframe app boot too.
msalInstance.initialize().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <MsalProvider instance={msalInstance}>
          <AuthGate>
            <BrandProvider>
              <RouterProvider router={router} />
              <SpeedInsights />
            </BrandProvider>
          </AuthGate>
        </MsalProvider>
      </ErrorBoundary>
    </StrictMode>,
  )
})
