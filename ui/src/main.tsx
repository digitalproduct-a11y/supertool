import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { PublicClientApplication } from '@azure/msal-browser'
import { MsalProvider } from '@azure/msal-react'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { BrandProvider } from './context/BrandContext'
import { AuthGate } from './components/AuthGate.tsx'
import { msalConfig } from './auth/msalConfig.ts'

const msalInstance = new PublicClientApplication(msalConfig)
const router = createBrowserRouter([{ path: '*', element: <App /> }])

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
