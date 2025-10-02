import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const PUBLIC_HOSTS = [
  /\.replit\.dev$/,
  /\.repl\.co$/,
  // keep the current spock host while you debug; it's harmless if it rotates
  '6a0d95e2-a1ad-47f9-8de5-26d3f2436712-00-3mzq4uf233kzp.spock.replit.dev',
]

// Prefer *.repl.co if present, otherwise allow *.replit.dev HMR to still work.
// If neither env exists on your Repl, we let Vite infer but keep allowedHosts wide.
const replHost =
  (process.env.REPL_SLUG && process.env.REPL_OWNER)
    ? `${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
    : undefined

export default defineConfig({
  plugins: [react()],
  root: './client',
  server: {
    host: true,
    port: 5173,
    cors: true,
    hmr: {
      protocol: 'wss',
      host: replHost ?? undefined, // if undefined, Vite falls back to page host
      clientPort: 443,
      // path: '/vite-hmr', // default; uncomment only if you changed it on a proxy
    },
    allowedHosts: [
      ...(replHost ? [replHost] : []),
      ...PUBLIC_HOSTS,
    ],
    // Let the client call /api on the same origin (Vite dev server) and proxy to your API
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
    // This helps Vite generate absolute HMR URLs that match the public host
    origin: replHost ? `https://${replHost}` : undefined,
  },
  preview: { port: 5173 },
})