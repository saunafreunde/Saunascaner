// Fehlerberichte aus dem Frontend (Audit 25.09.2026, Migration 0188).
//
// Warum: Stürzte die 24/7-Tafel, ein Kiosk-Tablet oder die App im Browser ab,
// landete das nur in der Konsole des Geräts — gemerkt hat es erst jemand vor
// Ort. Jetzt gehen unbehandelte Fehler (window „error", „unhandledrejection")
// und Abstürze, die eine ErrorBoundary fängt, gedrosselt an die kleine Tabelle
// client_fehler (RPC client_fehler_melden, auch ohne Anmeldung). Admins sehen
// sie unter Admin → Auswertung → Aktivitäts-Log („Technische Fehler").
//
// Datensparsam: Pfad ohne Query/Hash, Login-Codes (/m/…), IDs und E-Mail-
// Adressen maskiert, keine Mitglieds-ID, kein Name. Gedrosselt im Gerät
// (höchstens 5 Meldungen je 10 min, derselbe Fehler höchstens alle 10 min) und
// noch einmal auf dem Server (gleicher Fehler wird gezählt, max. 60 neue je
// Stunde, 30 Tage Aufbewahrung). Das Melden selbst wirft nie.

import { supabase } from '@/lib/supabase';

const MAX_JE_FENSTER = 5;
const FENSTER_MS = 10 * 60_000;
const GLEICHER_FEHLER_MS = 10 * 60_000;

let gesendet: number[] = [];
const zuletztJeFehler = new Map<string, number>();

// Rauschen, das nichts über die App sagt.
const IGNORIEREN = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i, // fremdes Skript ohne Details (CORS)
];

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
// Nur echte Adressen (name@domain.tld). Bewusst OHNE „/" und „:" im Domainteil:
// Safari- und Firefox-Stacks schreiben jede Zeile als „funktion@https://…/datei.js:1:2"
// — eine lockerere Regel machte daraus „<e-mail>:1:2", der Stack war unlesbar.
const EMAIL = /[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g;

function entschaerfen(text: string): string {
  return text.replace(EMAIL, '<e-mail>').replace(UUID, ':id');
}

/** Pfad ohne Query und Hash; Login-Codes und IDs maskiert. */
function routeOhneGeheimnisse(): string {
  try {
    return entschaerfen(window.location.pathname.replace(/^\/m\/[^/]+/, '/m/*')).slice(0, 120);
  } catch {
    return '/';
  }
}

function meldungAus(err: unknown): { meldung: string; stack: string | null } {
  if (err instanceof Error) {
    return { meldung: `${err.name}: ${err.message}`, stack: err.stack ?? null };
  }
  if (typeof err === 'string') return { meldung: err, stack: null };
  if (err && typeof err === 'object' && 'message' in err) {
    // z. B. PostgrestError { message, code, details }
    const e = err as { message?: unknown; code?: unknown };
    return { meldung: `${String(e.code ?? 'Fehler')}: ${String(e.message ?? '')}`, stack: null };
  }
  try {
    return { meldung: JSON.stringify(err) ?? String(err), stack: null };
  } catch {
    return { meldung: String(err), stack: null };
  }
}

/** Einen Fehler melden. quelle z. B. 'fenster', 'versprechen', 'grenze:Dashboard'. */
export function fehlerMelden(quelle: string, err: unknown): void {
  try {
    if (!supabase) return;
    const roh = meldungAus(err);
    if (IGNORIEREN.some((r) => r.test(roh.meldung))) return;
    if (roh.stack && /(chrome|moz|safari-web)-extension:/i.test(roh.stack)) return;

    const meldung = entschaerfen(roh.meldung).slice(0, 500);
    const jetzt = Date.now();
    const schluessel = `${quelle}|${meldung}`;
    if (jetzt - (zuletztJeFehler.get(schluessel) ?? 0) < GLEICHER_FEHLER_MS) return;
    gesendet = gesendet.filter((t) => jetzt - t < FENSTER_MS);
    if (gesendet.length >= MAX_JE_FENSTER) return;
    gesendet.push(jetzt);
    if (zuletztJeFehler.size > 200) zuletztJeFehler.clear();
    zuletztJeFehler.set(schluessel, jetzt);

    let geraet = '';
    try { geraet = navigator.userAgent.slice(0, 200); } catch { /* egal */ }

    supabase.rpc('client_fehler_melden', {
      p_quelle: quelle.slice(0, 60),
      p_route: routeOhneGeheimnisse(),
      p_meldung: meldung,
      p_stack: roh.stack ? entschaerfen(roh.stack).slice(0, 2000) : null,
      p_geraet: geraet,
    }).then(() => undefined, () => undefined);
  } catch {
    /* Melden darf nie selbst einen Fehler auslösen */
  }
}

let eingeschaltet = false;

/** Einmal beim Start (main.tsx): globale Fehler melden. */
export function fehlerberichteEinschalten(): void {
  if (eingeschaltet || typeof window === 'undefined') return;
  eingeschaltet = true;
  window.addEventListener('error', (e) => {
    // Ladefehler von <img>/<script> erreichen window nicht als ErrorEvent.
    if (!(e instanceof ErrorEvent)) return;
    fehlerMelden('fenster', e.error ?? e.message);
  });
  window.addEventListener('unhandledrejection', (e) => {
    fehlerMelden('versprechen', e.reason);
  });
}
