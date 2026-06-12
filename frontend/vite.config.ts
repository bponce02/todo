import path from 'node:path'
import { defineConfig } from 'vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
  // django-vite prepends Django's STATIC_URL (/static/) to asset paths in both
  // dev and prod, so Vite needs to serve at the same prefix in both modes.
  base: '/static/',
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    tailwindcss(),
    viteReact(),
  ],
  build: {
    manifest: '.vite/manifest.json',
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: 'src/main.tsx',
    },
  },
  server: {
    port: 3000,
    strictPort: true,
    // django-vite injects http://localhost:3000/<asset> tags into Django's
    // template. `origin` makes sure URLs Vite itself emits agree.
    origin: 'http://localhost:3000',
    // The page is served from :8000 (Django) but loads ES modules from :3000
    // (Vite). Cross-origin module loading requires CORS headers from Vite.
    cors: { origin: 'http://localhost:8000' },
  },
})
