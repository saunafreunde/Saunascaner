import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { queryClient } from '@/lib/queryClient';
import { analytikBeforeSend } from '@/lib/analytikFilter';
import { fehlerberichteEinschalten } from '@/lib/fehlerbericht';
import App from './App';
import './index.css';

// Unbehandelte Fehler gedrosselt an den Server melden (Tafel, Kiosk, App) —
// sonst sieht niemand, wenn ein Gerät im Verein abstürzt. Siehe lib/fehlerbericht.
fehlerberichteEinschalten();

// Nach einem Deploy fehlen einem schon offenen Tab die alten Lazy-Chunks: Der
// neue Service Worker hat sie aus dem Precache geräumt, und Vercel liefert sie
// nicht mehr (404). React.lazy merkt sich so einen Ladefehler für immer —
// „Erneut versuchen" hilft dann nie, nur Neuladen holt das neue Bundle.
// Vites Preload-Helfer meldet jeden fehlgeschlagenen dynamischen Import als
// 'vite:preloadError'. Schleifenschutz: höchstens ein automatisches Neuladen
// pro Minute; ohne Netz oder ohne sessionStorage gar keins — dann zeigt die
// Fehlergrenze den Knopf „Neu laden". Kein preventDefault(): der Fehler soll
// normal weiterlaufen (sonst bekäme React.lazy `undefined` statt des Moduls).
window.addEventListener('vite:preloadError', () => {
  if (!navigator.onLine) return;
  // Während eines Evakuierungsalarms nie neu laden: das Vollbild steht, und
  // nach einem Neuladen bliebe die Sirene bis zum ersten Antippen stumm
  // (Audit-Runde 3). Ein fehlender Programmteil (z. B. Bühnen-Effekt) wartet.
  if (queryClient.getQueryData(['evacuation', 'active'])) return;
  const KEY = 'chunk-neuladen-um';
  try {
    const zuletzt = Number(sessionStorage.getItem(KEY) ?? '0');
    if (Date.now() - zuletzt < 60_000) return;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    return;
  }
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        {/* Ohne Login-Codes (/m/<code>), Kennungen, Query und Hash — siehe lib/analytikFilter. */}
        <Analytics beforeSend={analytikBeforeSend} />
        <SpeedInsights beforeSend={analytikBeforeSend} />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
