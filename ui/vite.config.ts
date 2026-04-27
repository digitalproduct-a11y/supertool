import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
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
    },
  },
})
