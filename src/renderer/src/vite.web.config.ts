/**
 * vite.web.config.ts
 *
 * Vite-Konfiguration für den reinen Browser-Modus (npm run web).
 * Rendert dieselbe React-App, proxied /api → Express auf Port 3001.
 * Kein Electron, kein IPC – nur fetch().
 */
import { defineConfig } from 'vite'
import react            from '@vitejs/plugin-react'
import { resolve }      from 'path'

export default defineConfig({
  plugins: [react()],
  root:    resolve(__dirname, 'src/renderer'),
  resolve: {
    alias: { '@': resolve(__dirname, 'src/renderer/src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target:       'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir:    resolve(__dirname, 'src/renderer/dist'),
    emptyOutDir: true,
  },
})
