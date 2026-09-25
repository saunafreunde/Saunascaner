import { useEffect, useRef } from 'react';
import { useAppReloadSignal } from '@/lib/api';

const STORAGE_KEY = 'app-reload-signal-seen';
const VERSUCH_KEY = 'app-reload-bundle-versuch';

/** Präfix des Workbox-Precaches (App-Hülle: index.html, JS, CSS). */
const PRECACHE_PREFIX = 'workbox-precache';

/**
 * Service Worker nach einer neuen Fassung fragen — NICHT abmelden!
 * Bis 25.09.2026 stand hier `unregister()`. Chrome und Firefox löschen beim
 * Abmelden das Push-Abo des Geräts: Nach jedem Deploy kamen auf Android keine
 * Evakuierungs-, Spiel- und Saunafest-Pushes mehr an, still und ohne Hinweis.
 * `update()` holt die neue sw.js; die übernimmt dank skipWaiting + clientsClaim
 * (vite.config.ts) von selbst. Höchstens `maxMs` warten.
 */
async function serviceWorkerAktualisieren(maxMs: number): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.race([
    Promise.all(regs.map((r) => r.update().catch(() => undefined))),
    new Promise((resolve) => setTimeout(resolve, maxMs)),
  ]);
}

/**
 * Caches so aufräumen, dass der nächste Seitenaufruf das Server-Bundle bekommt.
 * - Eine gecachte index.html, die NICHT das Server-Bundle nennt, fliegt aus dem
 *   Precache. Workbox holt die Startseite dann aus dem Netz (fallbackToNetwork),
 *   auch solange noch der alte Service Worker die Seite steuert.
 * - Eine index.html, die das Server-Bundle schon nennt (der neue Service Worker
 *   war schneller), bleibt liegen — so startet die App weiterhin ohne Netz.
 * - Alle übrigen Precache-Einträge bleiben ebenfalls liegen.
 * - `laufzeitCaches`: zusätzlich Bilder-, Avatar- und Wetter-Cache leeren
 *   (Admin-Knopf „App-Update ausrollen“).
 */
async function cachesAufraeumen(zielBundle: string | null, laufzeitCaches: boolean): Promise<void> {
  if (!('caches' in window)) return;
  for (const name of await caches.keys()) {
    if (!name.startsWith(PRECACHE_PREFIX)) {
      if (laufzeitCaches) await caches.delete(name);
      continue;
    }
    const cache = await caches.open(name);
    for (const req of await cache.keys()) {
      if (new URL(req.url).pathname !== '/index.html') continue;
      const res = await cache.match(req);
      const html = res ? await res.text().catch(() => '') : '';
      if (zielBundle && html.includes(`src="${zielBundle}"`)) continue;
      await cache.delete(req);
    }
  }
}

/**
 * Auf das neue Bundle umschalten und neu laden — höchstens einmal je Aufruf.
 * Das Push-Abo und der übrige Offline-Vorrat bleiben dabei erhalten.
 */
function aufNeuesBundleUmschalten(
  marke: string,
  opts: { serverBundle?: string | null; laufzeitCaches: boolean },
) {
  (async () => {
    const start = Date.now();
    try {
      await serviceWorkerAktualisieren(2500);
      const bundle = opts.serverBundle !== undefined ? opts.serverBundle : await serverBundle();
      await cachesAufraeumen(bundle, opts.laufzeitCaches);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[AppReloadWatcher] Aufräumen teilweise fehlgeschlagen', e);
    }
    // Insgesamt ~3 s nach dem Auslöser neu laden, ?_t= als Cache-Buster.
    setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('_t', marke);
      window.location.replace(url.toString());
    }, Math.max(0, 3000 - (Date.now() - start)));
  })();
}

/**
 * Welches Haupt-Skript nennt die index.html auf dem Server gerade?
 * null offline, im Dev-Modus oder bei einem Fehler.
 */
async function serverBundle(): Promise<string | null> {
  try {
    // ?_v= umgeht den Workbox-Precache (der kennt nur die nackte URL) und den HTTP-Cache.
    const res = await fetch(`/index.html?_v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const html = await res.text();
    return html.match(/<script[^>]+type="module"[^>]+src="(\/assets\/[^"]+\.js)"/)?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Läuft hier noch ein altes Bundle? Vergleicht das geladene Haupt-Skript mit
 * dem, das die index.html auf dem Server gerade nennt. Liefert den Namen des
 * Server-Bundles, wenn er abweicht — sonst null (auch offline oder im Dev-Modus).
 */
async function neueresBundleAufDemServer(): Promise<string | null> {
  const meins = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]')?.src;
  if (!meins) return null;
  const server = await serverBundle();
  if (!server) return null;
  return meins.endsWith(server) ? null : server;
}

/**
 * Pollt das App-Force-Reload-Signal aus system_config (Migration 0099).
 * Wenn der Admin den Cache-Clear-Button drückt, wird ein neuer Timestamp
 * geschrieben. Dieser Hook merkt den letzten gesehenen Wert im
 * localStorage und führt bei Änderung einen Hard-Reload + Cache-Clear
 * durch — damit alle iPhone-/PWA-User die neue Version bekommen.
 * Der Service Worker wird dabei nur aktualisiert, nie abgemeldet — sonst
 * wäre das Push-Abo des Geräts weg (siehe serviceWorkerAktualisieren).
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
      aufNeuesBundleUmschalten(String(Date.now()), { serverBundle: server, laufzeitCaches: false });
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
      aufNeuesBundleUmschalten(String(current), { laufzeitCaches: true });
    }
  }, [sig.data]);

  return null;
}
