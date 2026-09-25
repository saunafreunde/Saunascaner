// Gekoppelte Kiosk-Geräte (Migration 0177, 25.09.2026).
//
// Öl-Raum-Tablet, Anwesenheits-Panel & Co. laufen ohne Login. Damit nicht
// jeder im Internet ihre Sonderrechte nutzen kann (Aufgüsse anlegen/löschen,
// Anwesenheit setzen, Alarm auslösen), koppelt ein Admin jedes Gerät einmal:
// Admin → Displays → „Kiosk-Geräte" erzeugt einen Link /koppeln#<code> mit
// einem Einmal-Code (24 h, seit 0191). Das Gerät tauscht ihn gegen sein Token;
// das Token landet hier im localStorage und geht bei jeder Kiosk-Aktion als
// p_geraet (bzw. Header x-kiosk-geraet) mit. In der Datenbank liegt nur der
// sha256-Wert.
//
// Seit 0197 geht es auch andersherum (der lange Link musste abgetippt werden):
// Das Gerät würfelt sein Token selbst, meldet eine Kopplungsanfrage an und
// zeigt einen QR-Code + kurzen Code; ein Admin scannt ihn mit dem Handy und
// gibt frei (components/kiosk/GeraetKoppelnQr.tsx, routes/KoppelnFreigeben.tsx).
// Bis zur Freigabe liegt das Token unter einem eigenen Schlüssel.

const SCHLUESSEL = 'sauna-kiosk-geraet-v1';

export type KioskGeraetArt = 'oelraum' | 'eingang' | 'tafel' | 'panel' | 'scanner';

export const KIOSK_GERAET_ARTEN: { art: KioskGeraetArt; label: string; ziel: string }[] = [
  { art: 'oelraum', label: 'Öl-Raum-Tablet', ziel: '/oil-room' },
  { art: 'panel', label: 'Anwesenheits-Panel (Innenraum-PC)', ziel: '/panel' },
  { art: 'eingang', label: 'Eingangs-Tablet', ziel: '/willkommen' },
  { art: 'scanner', label: 'Eingangs-Scanner', ziel: '/scanner' },
  { art: 'tafel', label: 'TV-Tafel', ziel: '/dashboard' },
];

/** Bestätigtes Geräte-Token (nach Link-Einlösung bzw. QR-Freigabe übernommen). */
export function kioskGeraetTokenBestaetigt(): string | null {
  try {
    const t = localStorage.getItem(SCHLUESSEL);
    return t && /^[0-9a-f]{64}$/.test(t) ? t : null;
  } catch {
    return null;
  }
}

/** Token, das dieses Gerät bei Kiosk-Aktionen mitschickt: das bestätigte —
 *  sonst das einer laufenden QR-Kopplung (0197/0198). Gibt ein Admin frei,
 *  NACHDEM das Gerät den QR-Dialog verlassen hat (geschlossen, neu geladen,
 *  Eingangs-Tablet schon zurück auf /willkommen), kennt der Server das Token
 *  bereits als gekoppelt — das Gerät muss es dann auch benutzen, sonst lehnt
 *  z. B. die Gäste-Anmeldung das echte Tablet ab. Ein noch nicht
 *  freigegebenes Token behandelt jeder Server-Endpunkt wie „kein Token".
 *  useKioskGeraetStatus übernimmt es fest, sobald der Server es bestätigt. */
export function kioskGeraetToken(): string | null {
  return kioskGeraetTokenBestaetigt() ?? kopplungsTokenOffen();
}

export function kioskGeraetSpeichern(token: string): void {
  try { localStorage.setItem(SCHLUESSEL, token); } catch { /* privater Modus — dann eben nicht */ }
}

export function kioskGeraetVergessen(): void {
  try { localStorage.removeItem(SCHLUESSEL); } catch { /* egal */ }
}

/** Header für Server-Endpunkte (api/send-evacuation.ts). Leer, wenn nicht gekoppelt. */
export function kioskGeraetHeader(): Record<string, string> {
  const t = kioskGeraetToken();
  return t ? { 'x-kiosk-geraet': t } : {};
}

// ─── Kopplung per QR-Code (0197) ───────────────────────────────────────────

const ANFRAGE_SCHLUESSEL = 'sauna-kiosk-kopplung-v1';
// Bis wann die zuletzt angezeigte Anfrage gilt (ms) — so lange fragt
// useKioskGeraetStatus alle 20 s nach, ob die Freigabe schon da ist.
const ANFRAGE_BIS_SCHLUESSEL = 'sauna-kiosk-kopplung-bis-v1';

/** 32 Zufallsbytes als Hex — das künftige Geräte-Token. */
function neuesToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

/** Token der laufenden Kopplungsanfrage (überlebt ein Neuladen der Seite, damit
 *  der angezeigte Code gleich bleibt). Legt bei Bedarf ein neues an. */
export function kopplungsToken(neu = false): string {
  try {
    const t = localStorage.getItem(ANFRAGE_SCHLUESSEL);
    if (!neu && t && /^[0-9a-f]{64}$/.test(t)) return t;
    const n = neuesToken();
    localStorage.setItem(ANFRAGE_SCHLUESSEL, n);
    return n;
  } catch {
    return neuesToken();
  }
}

/** Token einer laufenden Kopplung, ohne eins anzulegen (sonst null). */
export function kopplungsTokenOffen(): string | null {
  try {
    const t = localStorage.getItem(ANFRAGE_SCHLUESSEL);
    return t && /^[0-9a-f]{64}$/.test(t) ? t : null;
  } catch {
    return null;
  }
}

/** Anfrage angezeigt: merken, bis wann sie freigegeben werden kann. */
export function kopplungAngefragt(gueltigBisMs: number): void {
  try { localStorage.setItem(ANFRAGE_BIS_SCHLUESSEL, String(gueltigBisMs)); } catch { /* egal */ }
}

/** Kann gerade eine Freigabe eintreffen? (Anfrage offen oder erst kurz abgelaufen.) */
export function kopplungKannEintreffen(): boolean {
  if (!kopplungsTokenOffen()) return false;
  try {
    const bis = Number(localStorage.getItem(ANFRAGE_BIS_SCHLUESSEL));
    return Number.isFinite(bis) && Date.now() < bis + 60_000;
  } catch {
    return false;
  }
}

/** Freigabe angekommen: das Anfrage-Token wird zum Geräte-Token. */
export function kopplungAbschliessen(token: string): void {
  kioskGeraetSpeichern(token);
  try {
    localStorage.removeItem(ANFRAGE_SCHLUESSEL);
    localStorage.removeItem(ANFRAGE_BIS_SCHLUESSEL);
  } catch { /* egal */ }
}

/** Kurzer Code für Menschen: „K7MQ2XPA" → „K7MQ-2XPA". */
export function kopplungsCodeAnzeige(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** Eingabe/Scan → Code (8 Zeichen, ohne 0/O/1/I) oder null. Nimmt auch den
 *  ganzen QR-Link …/k/K7MQ2XPA. */
export function kopplungsCodeAus(eingabe: string): string | null {
  const s = eingabe.trim();
  const ausLink = /\/k\/([A-Za-z0-9-]{8,9})(?:[/?#]|$)/.exec(s);
  const roh = (ausLink ? ausLink[1] : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-HJ-NP-Z2-9]{8}$/.test(roh) ? roh : null;
}

/** Was für ein Gerät fragt an? Hilft dem Admin beim Freigeben („Windows · Edge ·
 *  1920×1080"). Keine Kennung, nur grobe Merkmale. */
export function geraetBeschreibung(): string {
  try {
    const ua = navigator.userAgent;
    const touch = navigator.maxTouchPoints > 1;
    const os = /Windows/.test(ua) ? 'Windows'
      : /Android/.test(ua) ? 'Android'
      : /iPhone/.test(ua) ? 'iPhone'
      : /iPad/.test(ua) || (/Macintosh/.test(ua) && touch) ? 'iPad'
      : /Mac OS X/.test(ua) ? 'Mac'
      : /CrOS/.test(ua) ? 'ChromeOS'
      : /Linux/.test(ua) ? 'Linux' : 'Gerät';
    const browser = /Edg\//.test(ua) ? 'Edge'
      : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
      : /Fully/.test(ua) ? 'Fully Kiosk'
      : /Firefox\//.test(ua) ? 'Firefox'
      : /Chrome\//.test(ua) ? 'Chrome'
      : /Safari\//.test(ua) ? 'Safari' : 'Browser';
    return `${os} · ${browser} · ${screen.width}×${screen.height}`;
  } catch {
    return '';
  }
}
