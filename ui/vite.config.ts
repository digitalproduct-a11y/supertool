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

// Mirrors ui/api/election-results.ts + ui/api/upload-to-blob.ts (Vercel
// serverless) for local dev so the Election Results tool works under
// `vite dev`. The election feed is CORS-locked to pru.astroawani.com, so the
// browser must go through a same-origin proxy in every environment.
function electionDevPlugin(env: Record<string, string>): Plugin {
  const FEED_HOST = 'data.pru.astroawani.com'
  return {
    name: 'election-dev',
    configureServer(server) {
      server.middlewares.use('/api/election-results', async (req, res) => {
        if (req.method !== 'GET') {
          res.statusCode = 405
          res.end()
          return
        }
        const season = (new URL(req.url || '', 'http://x').searchParams.get('season') || '16').replace(/[^\d]/g, '') || '16'
        res.setHeader('content-type', 'application/json')
        res.setHeader('cache-control', 'no-store')
        try {
          const upstream = await fetch(`https://${FEED_HOST}/data/${season}/result_state_assembly.json?bust=${Date.now()}`)
          if (!upstream.ok) {
            res.statusCode = 502
            res.end(JSON.stringify({ error: `Feed responded ${upstream.status}` }))
            return
          }
          res.end(JSON.stringify(await upstream.json()))
        } catch {
          res.statusCode = 502
          res.end(JSON.stringify({ error: 'Failed to reach results feed' }))
        }
      })

      server.middlewares.use('/api/upload-to-blob', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        res.setHeader('content-type', 'application/json')
        const token = env.BLOB_READ_WRITE_TOKEN
        if (!token) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Blob storage not configured (set BLOB_READ_WRITE_TOKEN in .env.local)' }))
          return
        }
        let body = ''
        for await (const chunk of req) body += chunk
        let dataUrl = ''
        let filename = 'election'
        try {
          const parsed = JSON.parse(body || '{}') as { dataUrl?: string; filename?: string }
          dataUrl = parsed.dataUrl ?? ''
          filename = parsed.filename ?? 'election'
        } catch {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Invalid body' }))
          return
        }
        const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl)
        if (!match || !match[1].startsWith('image/')) {
          res.statusCode = 400
          res.end(JSON.stringify({ error: 'Invalid image data URL' }))
          return
        }
        try {
          const { put } = await import('@vercel/blob')
          const ext = match[1].split('/')[1] || 'png'
          const safeName = filename.replace(/[^a-z0-9._-]/gi, '-').slice(0, 80)
          const blob = await put(`election/${safeName}-${Date.now()}.${ext}`, Buffer.from(match[2], 'base64'), {
            access: 'public',
            contentType: match[1],
            token,
          })
          res.end(JSON.stringify({ url: blob.url }))
        } catch {
          res.statusCode = 502
          res.end(JSON.stringify({ error: 'Upload failed' }))
        }
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
    plugins: [react(), adminAuthDevPlugin(env), electionDevPlugin(env)],
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
          configure: (proxy) => {
            // Mirrors WEBHOOK_TOKENS in api/n8n-proxy.ts so dashboard-gated
            // webhooks work under `vite dev` without exposing the token to
            // the client bundle.
            proxy.on('proxyReq', (proxyReq, req) => {
              const url = req.url || ''
              if (env.DASHBOARD_WEBHOOK_TOKEN && url.startsWith('/webhook/dashboard')) {
                proxyReq.setHeader('dashboard-webhook-token', env.DASHBOARD_WEBHOOK_TOKEN)
              }
            })
          },
        },
        '/webhook-test': {
          target: 'https://astroproduct.app.n8n.cloud',
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const url = req.url || ''
              if (env.DASHBOARD_WEBHOOK_TOKEN && url.startsWith('/webhook-test/dashboard')) {
                proxyReq.setHeader('dashboard-webhook-token', env.DASHBOARD_WEBHOOK_TOKEN)
              }
            })
          },
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
