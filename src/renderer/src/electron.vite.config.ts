import { resolve }        from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react              from '@vitejs/plugin-react'

export default defineConfig({
  // ── Main Process ────────────────────────────────────────────
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: { '@main': resolve('src/main') },
    },
  },

  // ── Preload Script ──────────────────────────────────────────
  preload: {
    plugins: [externalizeDepsPlugin()],
  },

  // ── Renderer (React / Vite) ─────────────────────────────────
  renderer: {
    resolve: {
      alias: { '@': resolve('src/renderer/src') },
    },
    plugins: [react()],
    css: {
      postcss: resolve('postcss.config.js'),
    },
  },
})
