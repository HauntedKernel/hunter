import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      },
      manifest: {
        name: 'FlashStack - Revolutionary CMA Technology',
        short_name: 'FlashStack',
        description: 'Patent-pending gesture-based property intelligence platform',
        theme_color: '#2563eb',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml'
          },
          {
            src: 'pwa-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml'
          }
        ]
      }
    })
  ],
  server: {
    https: true,
    host: true,
    port: 5173,
    strictPort: false,
    hmr: {
      overlay: true
    },
    // The backend writes debug HTML + the tax-roll DB inside the repo; without
    // this, those writes trigger full page reloads that reset the UI mid-use.
    watch: {
      ignored: ['**/backend/**']
    },
    // Proxy API calls to the backend so the frontend can use same-origin
    // relative paths (/api/...). This keeps everything behind one origin,
    // which is what lets a single Cloudflare tunnel serve the whole app.
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false
      }
    },
    // Allow Cloudflare quick-tunnel hostnames to reach the dev server.
    allowedHosts: ['.trycloudflare.com', '.cfargotunnel.com']
  }
})