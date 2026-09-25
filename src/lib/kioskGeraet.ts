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

const SCHLUESSEL = 'sauna-kiosk-geraet-v1';

export type KioskGeraetArt = 'oelraum' | 'eingang' | 'tafel' | 'panel' | 'scanner';

export const KIOSK_GERAET_ARTEN: { art: KioskGeraetArt; label: string; ziel: string }[] = [
  { art: 'oelraum', label: 'Öl-Raum-Tablet', ziel: '/oil-room' },
  { art: 'panel', label: 'Anwesenheits-Panel (Innenraum-PC)', ziel: '/panel' },
  { art: 'eingang', label: 'Eingangs-Tablet', ziel: '/willkommen' },
  { art: 'scanner', label: 'Eingangs-Scanner', ziel: '/scanner' },
  { art: 'tafel', label: 'TV-Tafel', ziel: '/dashboard' },
];

export function kioskGeraetToken(): string | null {
  try {
    const t = localStorage.getItem(SCHLUESSEL);
    return t && /^[0-9a-f]{64}$/.test(t) ? t : null;
  } catch {
    return null;
  }
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
