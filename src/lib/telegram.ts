// Sends notifications via server-side API functions.
// Bot token never reaches the browser.
//
// Seit 25.09.2026 (Audit): alle Endpunkte verlangen eine Anmeldung bzw. ein
// gekoppeltes Kiosk-Gerät, und der Server baut die Texte selbst — der Browser
// schickt nur noch die Art der Meldung (Alarm-Inhalt kommt aus der Datenbank).
import { authHeaders } from './api';
import { kioskGeraetHeader } from './kioskGeraet';

export type EvacuationPayload = {
  triggeredBy: string;
  triggeredAt: Date;
  presentNames: string[];
};

export type EvacuationWithPhotoPayload = EvacuationPayload & {
  photoBlob?: Blob;
};

/** Antwort von /api/send-evacuation (seit 0191). Text + Push verschickt zuerst
 *  der Server selbst (DB-Trigger); dieser Aufruf ist Rückfall bzw. bringt das
 *  Öl-Raum-Foto — dann meist `schon_gesendet: true`. */
export type EvakuierungsVersand = {
  ok: boolean;
  via: string;
  detail?: string;
  sent?: number;
  total?: number;
  schon_gesendet?: boolean;
  note?: string;
  push?: { gesendet: number; gesamt: number; fehlt?: string };
  foto?: string;
};

export async function sendEvacuationList(p: EvacuationPayload): Promise<EvakuierungsVersand> {
  return sendEvacuationWithPhoto(p);
}

/** Kurzmeldung für die Oberfläche — nur aufrufen, wenn der Alarm steht. */
export function versandMeldung(r: EvakuierungsVersand): string {
  if (!r.ok) {
    return `Benachrichtigung von diesem Gerät fehlgeschlagen (${r.detail ?? 'unbekannt'}). `
      + 'Der Server verschickt Push und Telegram selbst — bitte im Telegram-Chat prüfen und im Zweifel telefonisch alarmieren.';
  }
  const teile: string[] = [];
  const push = r.push?.gesendet ?? 0;
  if (r.schon_gesendet) teile.push('Push + Telegram verschickt der Server');
  else if (r.note === 'no chats subscribed') teile.push(`Push an ${push} Geräte, keine Telegram-Chats eingerichtet`);
  else if (r.note === 'telegram_token_fehlt') teile.push(`Push an ${push} Geräte, Telegram nicht eingerichtet`);
  else teile.push(`Push an ${push} Geräte, Telegram an ${r.sent ?? 0}/${r.total ?? 0} Chats`);
  if (r.foto) {
    teile.push(r.foto.startsWith('gesendet') ? 'Foto an Telegram gesendet'
      : r.foto === 'schon_gesendet' ? 'Foto war schon gesendet'
        : r.foto === 'nicht_erlaubt' ? 'Foto nicht gesendet (Gerät nicht gekoppelt)'
          : `Foto nicht gesendet (${r.foto})`);
  }
  return teile.join(' · ');
}

async function sendNotification(body: Record<string, unknown>): Promise<void> {
  try {
    await fetch('/api/send-notification', {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(body),
    });
  } catch { /* ignore */ }
}

export async function sendBadgeAnnouncement(
  _displayName: string,
  badge: { id: string; emoji: string; label: string; description: string }
): Promise<void> {
  await sendNotification({ art: 'badge', badge_id: badge.id, emoji: badge.emoji, label: badge.label, description: badge.description });
}

/** Aufguss-Name wurde gerade geändert — der Server liest den neuen Namen selbst. */
export async function sendSaunaNameAnnouncement(): Promise<void> {
  await sendNotification({ art: 'sauna_name' });
}

export async function sendEvacuationWithPhoto(p: EvacuationWithPhotoPayload): Promise<EvakuierungsVersand> {
  let photoBase64: string | undefined;
  try {
    if (p.photoBlob) {
      const arrayBuffer = await p.photoBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      bytes.forEach((b) => (binary += String.fromCharCode(b)));
      photoBase64 = `data:image/jpeg;base64,${btoa(binary)}`;
    }
  } catch { /* ohne Foto weiter */ }

  // Netzfehler und 5xx (z. B. Kaltstart-Zeitüberschreitung) bis zu zweimal
  // wiederholen — 403/409 sind endgültig. Doppelt senden kann der Server nicht
  // (Text/Push und Foto werden je Alarm genau einmal beansprucht).
  const pausen = [1_000, 3_000];
  let letzter: EvakuierungsVersand = { ok: false, via: 'telegram', detail: 'unbekannt' };
  for (let versuch = 0; versuch <= pausen.length; versuch++) {
    if (versuch > 0) await new Promise((r) => setTimeout(r, pausen[versuch - 1]));
    try {
      const r = await fetch('/api/send-evacuation', {
        method: 'POST',
        headers: { ...(await authHeaders()), ...kioskGeraetHeader() },
        body: JSON.stringify({
          triggeredBy: p.triggeredBy,
          triggeredAt: p.triggeredAt.toISOString(),
          presentNames: p.presentNames,
          photoBase64,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        return {
          ok: true, via: 'telegram', sent: data.sent, total: data.total,
          schon_gesendet: !!data.schon_gesendet, note: data.note, push: data.push, foto: data.foto,
        };
      }
      letzter = { ok: false, via: 'telegram', detail: data?.error ?? `HTTP ${r.status}` };
      if (r.status < 500) return letzter;
    } catch (e) {
      letzter = { ok: false, via: 'telegram', detail: (e as Error).message };
    }
  }
  return letzter;
}
