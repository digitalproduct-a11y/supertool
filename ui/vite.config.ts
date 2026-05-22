import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHmac } from 'crypto'

// Mirrors ui/api/admin-auth.ts (Vercel serverless) for local dev so the
// Admin Access modal works under `vite dev` — same token shape so the
// client-side token verifier keeps working across envs.
function adminAuthDevPlugin(env: Record<string, string>): Plugin {
  const TOKEN_TTL_MS = 8 * 60 * 60 * 1000
  return {
    name: 'admin-auth-dev',
    configureServer(server) {
      server.middlewares.use('/api/admin-auth', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        const secret = env.ADMIN_PASSCODE
        const devSecret = env.DEV_ADMIN_PASSCODE
        res.setHeader('content-type', 'application/json')
        if (!secret) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Server misconfigured' }))
          return
        }
        let body = ''
        for await (const chunk of req) body += chunk
        let passcode = ''
        try {
          passcode = (JSON.parse(body || '{}') as { passcode?: string }).passcode ?? ''
        } catch {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Invalid body' }))
          return
        }
        if (!passcode) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Passcode required' }))
          return
        }
        if (passcode !== secret && !(devSecret && passcode === devSecret)) {
          res.statusCode = 401
          res.end(JSON.stringify({ error: 'Incorrect passcode' }))
          return
        }
        const expiresAt = String(Date.now() + TOKEN_TTL_MS)
        const sig = createHmac('sha256', secret).update(expiresAt).digest('hex')
        res.end(JSON.stringify({ token: `${expiresAt}.${sig}` }))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env vars (not just VITE_*) so server-side proxies can read
  // secrets like ZERNIO_API_KEY from .env.local without exposing them to the
  // client bundle.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), adminAuthDevPlugin(env)],
    server: {
      watch: {
        usePolling: true,
        interval: 100,
      },
      hmr: {
        host: 'localhost',
        protocol: 'ws',
      },
      proxy: {
        '/webhook': {
          target: 'https://astroproduct.app.n8n.cloud',
          changeOrigin: true,
          secure: true,
        },
        '/webhook-test': {
          target: 'https://astroproduct.app.n8n.cloud',
          changeOrigin: true,
          secure: true,
        },
        // Mirror api/zernio.ts (Vercel serverless) for local dev: rewrite
        // /api/zernio/:path* → https://zernio.com/api/v1/:path* and inject the
        // Bearer token from .env.local.
        '/api/zernio': {
          target: 'https://zernio.com',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/zernio/, '/api/v1'),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (env.ZERNIO_API_KEY) {
                proxyReq.setHeader('Authorization', `Bearer ${env.ZERNIO_API_KEY}`)
              }
            })
          },
        },
      },
    },
  }
})
