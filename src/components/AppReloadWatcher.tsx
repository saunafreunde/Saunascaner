import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAppReloadSignal } from '@/lib/api';

const STORAGE_KEY = 'app-reload-signal-seen';
const VERSUCH_KEY = 'app-reload-bundle-versuch';

/** Nach einem Signal-Neuladen: wann (ab Signal) noch einmal nach dem Server-Bundle sehen. */
const NACHPRUEF_KEY = 'app-reload-nachpruefung';
const NACHPRUEF_NACH_MS = [90_000, 5 * 60_000] as const;
/** Anzeige-Geräte laden erst nach so viel Ruhe neu … */
const RUHE_MS = 60_000;
/** … und nach dieser Frist (ab Signal) gar nicht mehr. */
const SPAETESTENS_MS = 15 * 60_000;
/** Kiosk-/Anzeige-Pfade: dort tippt kein Mitglied ein langes Formular. */
const ANZEIGE_PFADE = ['/dashboard', '/oil-room', '/scanner', '/panel', '/willkommen', '/checkin'];

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

/** Schleifenschutz: für dasselbe Ziel-Bundle nur alle 10 Minuten ein Versuch.
 *  Ohne Speicher kein Schleifenschutz → lieber nicht neu laden. */
function versuchErlaubt(server: string): boolean {
  try {
    const alt = JSON.parse(localStorage.getItem(VERSUCH_KEY) ?? 'null') as { bundle: string; at: number } | null;
    if (alt && alt.bundle === server && Date.now() - alt.at < 10 * 60_000) return false;
    localStorage.setItem(VERSUCH_KEY, JSON.stringify({ bundle: server, at: Date.now() }));
    return true;
  } catch { return false; }
}

/** Zeitpunkt des Signal-Neuladens, nach dem noch nachgeprüft werden soll — sonst null. */
function nachpruefungLesen(): number | null {
  try {
    const m = JSON.parse(localStorage.getItem(NACHPRUEF_KEY) ?? 'null') as { at?: unknown } | null;
    return typeof m?.at === 'number' ? m.at : null;
  } catch { return null; }
}

function nachpruefungLoeschen(): void {
  try { localStorage.removeItem(NACHPRUEF_KEY); } catch { /* ignore */ }
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
 * Ausnahme Nachprüfung (Audit-Runde 2, 25.09.2026): Kam das Signal, bevor der
 * Deploy fertig war, luden alle Displays brav neu — und bekamen das ALTE
 * Bundle; die Start-Prüfung fand nichts Neueres, und danach prüfte niemand
 * mehr (Tafel und Öl-Raum liefen am 25.09. über eine Stunde mit dem Stand vor
 * dem Audit). Darum merkt sich ein Signal-Neuladen seinen Zeitpunkt, und die
 * neu geladene Seite sieht 90 s und 5 min danach noch je einmal nach. Ist dann
 * ein neueres Bundle da, lädt sie einmal neu: Anzeige-Geräte, sobald eine
 * Minute niemand bedient hat (höchstens 15 min nach dem Signal), alle anderen
 * nur, wenn seit dem Neuladen niemand die Seite angefasst hat. Eine einmalige
 * Kette aus zwei setTimeout — kein Dauer-Timer auf der Tafel, keine Schleife
 * (die Marke gilt nur für ein Signal, dazu der 10-min-Schleifenschutz).
 *
 * 5 Sekunden Warnung wird im Console-Log ausgegeben, damit User nicht
 * mitten in einem Klick verpassen — kein Modal-UI weil das Refresh-Event
 * von Admin ausgelöst wird (akzeptable Unterbrechung).
 */
export function AppReloadWatcher() {
  const sig = useAppReloadSignal();
  const qc = useQueryClient();
  const initialized = useRef(false);

  // Kaltstart-Prüfung: altes Bundle aus dem Cache? → einmal neu laden.
  useEffect(() => {
    let alive = true;
    void neueresBundleAufDemServer().then((server) => {
      if (!alive || !server) return;
      if (!versuchErlaubt(server)) return;
      // Der Deploy ist schon da — die Nachprüfung (unten) erübrigt sich.
      nachpruefungLoeschen();
      // eslint-disable-next-line no-console
      console.log('[AppReloadWatcher] Neueres Bundle auf dem Server — Hard-Reload in 3s …', server);
      aufNeuesBundleUmschalten(String(Date.now()), { serverBundle: server, laufzeitCaches: false });
    });
    return () => { alive = false; };
  }, []);

  // Nachprüfung nach einem Signal-Neuladen (siehe oben): kam der neue Deploy
  // erst nach dem Neuladen an, hier einmal nachziehen.
  useEffect(() => {
    const signalAt = nachpruefungLesen();
    if (signalAt === null) return;
    const anzeige = ANZEIGE_PFADE.includes(window.location.pathname);
    let letzteBedienung = 0;
    const bedient = () => { letzteBedienung = Date.now(); };
    const EVENTE = ['pointerdown', 'keydown', 'input'] as const;
    for (const e of EVENTE) document.addEventListener(e, bedient, true);
    let timer: number | undefined;
    let aus = false;
    const stoppen = () => {
      aus = true;
      if (timer !== undefined) window.clearTimeout(timer);
      for (const e of EVENTE) document.removeEventListener(e, bedient, true);
    };
    // Endgültig fertig (gefunden, aufgegeben oder abgelaufen): Marke weg.
    const beenden = () => { stoppen(); nachpruefungLoeschen(); };
    const planen = (zeitpunkt: number, schritt: () => void) => {
      timer = window.setTimeout(schritt, Math.max(0, zeitpunkt - Date.now()));
    };

    const umschalten = (server: string) => {
      if (Date.now() - signalAt > SPAETESTENS_MS) { beenden(); return; }
      // Laufender Evakuierungsalarm: nie mitten hinein neu laden — danach wäre
      // die Sirene bis zur nächsten Bedienung stumm (Tonsperre des Browsers).
      if (qc.getQueryData(['evacuation', 'active'])) { planen(Date.now() + RUHE_MS, () => umschalten(server)); return; }
      if (letzteBedienung > 0) {
        // Mitglied hat die Seite schon benutzt: nichts wegwerfen — das neue
        // Bundle kommt dann mit dem nächsten Start (Kaltstart-Prüfung).
        if (!anzeige) { beenden(); return; }
        // Anzeige-Gerät: warten, bis eine Minute Ruhe ist.
        const ruhigAb = letzteBedienung + RUHE_MS;
        if (Date.now() < ruhigAb) { planen(ruhigAb, () => umschalten(server)); return; }
      }
      beenden();
      if (!versuchErlaubt(server)) return;
      // eslint-disable-next-line no-console
      console.log('[AppReloadWatcher] Deploy kam nach dem Neuladen an — Hard-Reload in 3s …', server);
      aufNeuesBundleUmschalten(String(Date.now()), { serverBundle: server, laufzeitCaches: false });
    };

    const nachsehen = (i: number) => {
      if (i >= NACHPRUEF_NACH_MS.length) { beenden(); return; }
      const zeitpunkt = signalAt + NACHPRUEF_NACH_MS[i];
      // Schon vorbei (Seite später erneut geladen): die Start-Prüfung hat das abgedeckt.
      if (zeitpunkt < Date.now()) { nachsehen(i + 1); return; }
      planen(zeitpunkt, () => {
        void neueresBundleAufDemServer().then((server) => {
          if (aus) return;
          if (server) umschalten(server);
          else nachsehen(i + 1);
        });
      });
    };
    nachsehen(0);
    // Beim Aushängen nur anhalten — die Marke bleibt für die nächste Seite.
    return stoppen;
  }, [qc]);

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
      try {
        localStorage.setItem(STORAGE_KEY, String(current));
        // Nachprüfung für die neu geladene Seite (Deploy evtl. noch nicht fertig).
        localStorage.setItem(NACHPRUEF_KEY, JSON.stringify({ at: Date.now() }));
      } catch { /* ignore */ }
      aufNeuesBundleUmschalten(String(current), { laufzeitCaches: true });
    }
  }, [sig.data]);

  return null;
}
