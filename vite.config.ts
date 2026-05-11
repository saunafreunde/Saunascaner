import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: 'Saunafreunde Schwarzwald',
        short_name: 'Saunafreunde',
        description: 'Sauna-Steuerung & Aufgussplan',
        theme_color: '#0a1812',
        background_color: '#050b08',
        display: 'standalone',
        orientation: 'any',
        // Vom Home-Bildschirm direkt in den Planner starten.
        // Wenn nicht eingeloggt → RequireAuth leitet zu /login.
        start_url: '/planner',
        scope: '/',
        id: '/',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
        // Long-Press auf das App-Icon (Android / Chrome) öffnet diese Shortcuts.
        shortcuts: [
          {
            name: 'Aufgüsse planen',
            short_name: 'Planner',
            description: 'Aufgüsse anlegen, Team-Aufgüsse, Vorlagen',
            url: '/planner',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'TV-Tafel',
            short_name: 'Tafel',
            description: 'Schwarzwald-Tafel mit Aufguss-Plan',
            url: '/dashboard',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Mitglieder',
            short_name: 'Members',
            description: 'Mitglieder-Galerie',
            url: '/members',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'WM-Tipspiel',
            short_name: 'WM 2026',
            description: 'Tipps abgeben',
            url: '/wm',
            icons: [{ src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        importScripts: ['/push-handler.js'],
        runtimeCaching: [
          // Storage-Bilder (Avatare, Event-Fotos): aggressiv cachen, 30 Tage
          {
            urlPattern: ({ url }) => url.hostname.includes('supabase.co')
              && url.pathname.includes('/storage/v1/object/public/assets/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-images',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // DiceBear-generierte Avatare: 7 Tage
          {
            urlPattern: ({ url }) => url.hostname === 'api.dicebear.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'dicebear-avatars',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          // Übrige Supabase-Requests (API/RPC): NetworkFirst
          {
            urlPattern: ({ url }) => url.hostname.includes('supabase.co'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 64, maxAgeSeconds: 60 * 5 },
            },
          },
          {
            urlPattern: ({ url }) => url.hostname.includes('open-meteo.com'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'weather',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'motion-vendor': ['framer-motion'],
          'pdf-vendor': ['jspdf', 'html2canvas'],
          'qr-vendor': ['qr-scanner', 'qrcode'],
          'supabase-vendor': ['@supabase/supabase-js'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
