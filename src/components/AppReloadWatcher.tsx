import { useEffect, useRef } from 'react';
import { useAppReloadSignal } from '@/lib/api';

const STORAGE_KEY = 'app-reload-signal-seen';
const VERSUCH_KEY = 'app-reload-bundle-versuch';

/** Cache leeren und hart neu laden — höchstens einmal je Aufruf. */
function cacheLeerenUndNeuLaden(marke: string) {
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
      url.searchParams.set('_t', marke);
      window.location.replace(url.toString());
    }, 3000);
  })();
}

/**
 * Läuft hier noch ein altes Bundle? Vergleicht das geladene Haupt-Skript mit
 * dem, das die index.html auf dem Server gerade nennt. Liefert den Namen des
 * Server-Bundles, wenn er abweicht — sonst null (auch offline oder im Dev-Modus).
 */
async function neueresBundleAufDemServer(): Promise<string | null> {
  try {
    const meins = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.src;
    if (!meins) return null;
    // ?_v= umgeht den Workbox-Precache (der kennt nur die nackte URL) und den HTTP-Cache.
    const res = await fetch(`/index.html?_v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const html = await res.text();
    const server = html.match(/<script[^>]+type="module"[^>]+src="(\/assets\/[^"]+\.js)"/)?.[1];
    if (!server) return null;
    return meins.endsWith(server) ? null : server;
  } catch {
    return null;
  }
}

/**
 * Pollt das App-Force-Reload-Signal aus system_config (Migration 0099).
 * Wenn der Admin den Cache-Clear-Button drückt, wird ein neuer Timestamp
 * geschrieben. Dieser Hook merkt den letzten gesehenen Wert im
 * localStorage und führt bei Änderung einen Hard-Reload + Cache-Clear
 * durch — damit alle iPhone-/PWA-User die neue Version bekommen.
 *
 * Das Signal erreicht nur Geräte, auf denen die App offen ist oder im
 * Hintergrund liegt. Wer sie ganz geschlossen hatte, bekam beim nächsten
 * Öffnen wieder das ALTE Bundle aus dem Service-Worker-Cache — und der erste
 * Mount merkt sich das Signal nur, statt neu zu laden („es ist nicht live",
 * 17.09.2026). Darum prüft der Kaltstart zusätzlich selbst, ob auf dem Server
 * schon ein neueres Bundle liegt, und lädt dann einmal neu. Nur beim Start —
 * nie später, damit niemand mitten im Formular seine Eingaben verliert.
 *
 * 5 Sekunden Warnung wird im Console-Log ausgegeben, damit User nicht
 * mitten in einem Klick verpassen — kein Modal-UI weil das Refresh-Event
 * von Admin ausgelöst wird (akzeptable Unterbrechung).
 */
export function AppReloadWatcher() {
  const sig = useAppReloadSignal();
  const initialized = useRef(false);

  // Kaltstart-Prüfung: altes Bundle aus dem Cache? → einmal neu laden.
  useEffect(() => {
    let alive = true;
    void neueresBundleAufDemServer().then((server) => {
      if (!alive || !server) return;
      // Schleifenschutz: für dasselbe Ziel-Bundle nur alle 10 Minuten ein Versuch.
      try {
        const alt = JSON.parse(localStorage.getItem(VERSUCH_KEY) ?? 'null') as { bundle: string; at: number } | null;
        if (alt && alt.bundle === server && Date.now() - alt.at < 10 * 60_000) return;
        localStorage.setItem(VERSUCH_KEY, JSON.stringify({ bundle: server, at: Date.now() }));
      } catch { return; /* ohne Speicher kein Schleifenschutz → lieber nicht neu laden */ }
      // eslint-disable-next-line no-console
      console.log('[AppReloadWatcher] Neueres Bundle auf dem Server — Hard-Reload in 3s …', server);
      cacheLeerenUndNeuLaden(String(Date.now()));
    });
    return () => { alive = false; };
  }, []);

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
      cacheLeerenUndNeuLaden(String(current));
    }
  }, [sig.data]);

  return null;
}
