import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

// Build-Identifier für Debug-Anzeige im UI (Ölraum-Kiosk).
// Hilft, einen veralteten PWA-Cache von einem aktuellen Bundle zu unterscheiden.
const __APP_BUILD__ = {
  sha: (process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev').slice(0, 7),
  time: new Date().toISOString(),
};

export default defineConfig({
  define: {
    __APP_BUILD__: JSON.stringify(__APP_BUILD__),
  },
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
        // Vom Home-Bildschirm auf die Wurzel starten — RootEntry schickt jede
        // Rolle in IHREN Bereich (Gast → /gast, Personal → /mitarbeiter,
        // Aufgießer → /planner) und wer nicht angemeldet ist, auf /login.
        // Vorher stand hier fest '/planner': für Gäste war die Startseite
        // damit der Aufgussplan, obwohl sie ihn gar nicht bedienen können.
        start_url: '/',
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
        ],
      },
      workbox: {
        importScripts: ['/push-handler.js'],
        // FIX 0107 (Audit Phase 9.B+9.F): alte Bundle-Snapshots wegräumen (sonst
        // sammeln sich pro Deploy 5-10MB im CacheStorage an → Quota-Exceeded auf
        // 24/7-TV nach 30 Tagen). skipWaiting + clientsClaim sind bei autoUpdate
        // ohnehin Default, hier explizit für Sichtbarkeit.
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
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
          // Übrige Supabase-Requests (REST, Anmeldung, Functions, signierte
          // Storage-URLs) bewusst OHNE Regel — sie gehen direkt ans Netz.
          // Bis 25.09.2026 stand hier ein NetworkFirst-Cache „supabase-api“.
          // Sein Schlüssel war nur die URL (Supabase sendet kein
          // Vary: Authorization): bei >5 s Netz-Latenz kam die Antwort eines
          // früheren Kontos oder eine bis zu 5 min alte zurück, persönliche
          // Antworten blieben nach dem Abmelden auf dem Gerät, und der
          // TV-Stick schrieb durch den 5-s-Poll ~3,5 GB am Tag in den Cache.
          // Den alten Cache räumt public/push-handler.js beim Aktivieren weg.
          // Nur öffentliche Bilder (Regel oben) werden zwischengespeichert.
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
        // Nie ein Paket mit dynamischem import() in einen manualChunk legen!
        // Vite hängt dann seinen Preload-Helfer (__vitePreload) in genau diesen
        // Chunk, und das Haupt-Bundle importiert ihn beim Start statisch.
        // So lud bis 25.09.2026 jeder Aufruf — auch die TV-Tafel und jedes
        // Gäste-Handy — vorab ~0,56 MB jsPDF + html2canvas ('pdf-vendor'),
        // obwohl nur die PDF-Funktionen sie brauchen. Ebenso betroffen wäre
        // qr-scanner (lädt seinen Worker per import()). jsPDF, html2canvas,
        // qr-scanner und qrcode verteilt Rollup jetzt selbst auf Lazy-Chunks.
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'query-vendor': ['@tanstack/react-query'],
          'motion-vendor': ['framer-motion'],
          'supabase-vendor': ['@supabase/supabase-js'],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
