import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load all env vars (not just VITE_*) so server-side proxies can read
  // secrets like ZERNIO_API_KEY from .env.local without exposing them to the
  // client bundle.
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
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
