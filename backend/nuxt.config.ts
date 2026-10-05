import { fileURLToPath } from 'node:url'

// API-only Nuxt app: serves /api routes (and, later, Socket.io). No pages are rendered.
export default defineNuxtConfig({
  compatibilityDate: '2025-05-15',
  ssr: false,
  pages: false,
  devtools: { enabled: false },

  devServer: { port: 3001 },

  alias: {
    '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
  },

  nitro: {
    // Nitro has its own bundler; mirror the alias so server routes can import @shared.
    alias: {
      '@shared': fileURLToPath(new URL('../shared', import.meta.url)),
    },
    routeRules: {
      '/api/**': {
        cors: true,
        headers: { 'Access-Control-Allow-Origin': 'http://localhost:5173' },
      },
    },
    // Socket.io is attached through server/plugins/socket.io.ts on top of Nitro's WebSocket support.
    experimental: {
      websocket: true,
    },
  },
})
