import { useEffect, useRef } from 'react';
import { useAppReloadSignal } from '@/lib/api';

const STORAGE_KEY = 'app-reload-signal-seen';

/**
 * Pollt das App-Force-Reload-Signal aus system_config (Migration 0099).
 * Wenn der Admin den Cache-Clear-Button drückt, wird ein neuer Timestamp
 * geschrieben. Dieser Hook merkt den letzten gesehenen Wert im
 * localStorage und führt bei Änderung einen Hard-Reload + Cache-Clear
 * durch — damit alle iPhone-/PWA-User die neue Version bekommen.
 *
 * 5 Sekunden Warnung wird im Console-Log ausgegeben, damit User nicht
 * mitten in einem Klick verpassen — kein Modal-UI weil das Refresh-Event
 * von Admin ausgelöst wird (akzeptable Unterbrechung).
 */
export function AppReloadWatcher() {
  const sig = useAppReloadSignal();
  const initialized = useRef(false);

  useEffect(() => {
    if (sig.data === undefined) return;
    const current = sig.data;

    // Beim ersten Mount: aktuellen Wert merken (NICHT reloaden — das wäre
    // bei jedem App-Open ein Reload-Loop).
    if (!initialized.current) {
      initialized.current = true;
      try { localStorage.setItem(STORAGE_KEY, String(current)); } catch { /* ignore */ }
      return;
    }

    let lastSeen = 0;
    try { lastSeen = Number(localStorage.getItem(STORAGE_KEY) ?? '0'); } catch { /* ignore */ }

    if (current > lastSeen) {
      // eslint-disable-next-line no-console
      console.log('[AppReloadWatcher] Admin hat App-Reload getriggert — Hard-Reload in 3s …');
      try { localStorage.setItem(STORAGE_KEY, String(current)); } catch { /* ignore */ }

      // Service-Worker-Caches löschen, dann hard-reload
      (async () => {
        try {
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            await Promise.all(regs.map((r) => r.unregister()));
          }
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.map((k) => caches.delete(k)));
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[AppReloadWatcher] Cache-Clear teilweise fehlgeschlagen', e);
        }
        // 3s warten dann reload (mit Cache-Bypass)
        setTimeout(() => {
          // location.reload() ohne Argumente macht in modernen Browsern
          // bereits eine Force-Revalidation. Plus ?_t= als Cache-Buster.
          const url = new URL(window.location.href);
          url.searchParams.set('_t', String(current));
          window.location.replace(url.toString());
        }, 3000);
      })();
    }
  }, [sig.data]);

  return null;
}
