import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createHmac } from 'crypto'

// Mirrors ui/api/admin-auth.ts (Vercel serverless) for local dev so the
// Admin Access modal works under `vite dev` — same token shape so the
// client-side token verifier keeps working across envs.
function adminAuthDevPlugin(env: Record<string, string>): Plugin {
  const TOKEN_TTL_MS = 8 * 60 * 60 * 1000
  // In-memory mirror of api/admin-auth.ts's KV rate limiting, so brute-force
  // lockout behaves the same under `vite dev` (single process, no KV needed).
  const FAIL_THRESHOLD = 5
  const BASE_LOCK_MS = 60 * 1000
  const MAX_LOCK_LEVEL = 6
  const attempts = new Map<string, { fails: number; level: number; lockUntil: number }>()

  const clientIp = (req: { headers: Record<string, unknown>; socket?: { remoteAddress?: string } }): string => {
    const xff = req.headers['x-forwarded-for']
    if (typeof xff === 'string' && xff.trim()) return xff.split(',')[0].trim()
    return req.socket?.remoteAddress ?? 'dev'
  }

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

        const ip = clientIp(req as never)
        const rec = attempts.get(ip)
        if (rec && rec.lockUntil > Date.now()) {
          const retryAfter = Math.ceil((rec.lockUntil - Date.now()) / 1000)
          res.statusCode = 429
          res.setHeader('retry-after', String(retryAfter))
          res.end(JSON.stringify({ error: 'Too many failed attempts. Try again later.', retryAfter }))
          return
        }

        let body = ''
        for await (const chunk of req) body += chunk
        let passcode = ''
        let turnstileToken = ''
        try {
          const parsed = JSON.parse(body || '{}') as { passcode?: string; turnstileToken?: string }
          passcode = parsed.passcode ?? ''
          turnstileToken = parsed.turnstileToken ?? ''
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

        // CAPTCHA after repeated failures (mirrors api/admin-auth.ts)
        const captchaSecret = env.TURNSTILE_SECRET_KEY
        const prior = attempts.get(ip)
        if (captchaSecret && prior && prior.fails >= 3) {
          let captchaOk = false
          if (turnstileToken) {
            try {
              const params = new URLSearchParams({ secret: captchaSecret, response: turnstileToken })
              const vr = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
                method: 'POST',
                headers: { 'content-type': 'application/x-www-form-urlencoded' },
                body: params,
              })
              captchaOk = ((await vr.json()) as { success?: boolean }).success === true
            } catch {
              captchaOk = false
            }
          }
          if (!captchaOk) {
            res.statusCode = 401
            res.end(JSON.stringify({ error: 'Please complete the verification.', captchaRequired: true }))
            return
          }
        }

        if (passcode !== secret && !(devSecret && passcode === devSecret)) {
          const cur = attempts.get(ip) ?? { fails: 0, level: 0, lockUntil: 0 }
          cur.fails += 1
          if (cur.fails >= FAIL_THRESHOLD) {
            cur.level += 1
            const lockMs = BASE_LOCK_MS * Math.pow(2, Math.min(cur.level - 1, MAX_LOCK_LEVEL))
            cur.lockUntil = Date.now() + lockMs
            cur.fails = 0
            attempts.set(ip, cur)
            const retryAfter = Math.ceil(lockMs / 1000)
            res.statusCode = 429
            res.setHeader('retry-after', String(retryAfter))
            res.end(JSON.stringify({ error: 'Too many failed attempts. Locked temporarily.', retryAfter }))
            return
          }
          attempts.set(ip, cur)
          res.statusCode = 401
          res.end(JSON.stringify({ error: 'Incorrect passcode' }))
          return
        }
        attempts.delete(ip)
        const expiresAt = String(Date.now() + TOKEN_TTL_MS)
        const sig = createHmac('sha256', secret).update(expiresAt).digest('hex')
        res.end(JSON.stringify({ token: `${expiresAt}.${sig}` }))
      })
    },
  }
}

// Mirrors ui/api/election-results.ts (Vercel serverless) for local dev so the
// Election Results tool works under `vite dev`. The election feed is CORS-locked
// to pru.astroawani.com, so the browser must go through a same-origin proxy in
// every environment. Image uploads go straight from the browser to Cloudinary
// (signed via the n8n webhook), so no upload middleware is needed.
function electionDevPlugin(): Plugin {
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
    plugins: [react(), adminAuthDevPlugin(env), electionDevPlugin()],
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
