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

export async function sendEvacuationList(
  p: EvacuationPayload
): Promise<{ ok: boolean; via: string; detail?: string; sent?: number; total?: number }> {
  return sendEvacuationWithPhoto(p);
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

export async function sendEvacuationWithPhoto(
  p: EvacuationWithPhotoPayload
): Promise<{ ok: boolean; via: string; detail?: string; sent?: number; total?: number }> {
  try {
    let photoBase64: string | undefined;
    if (p.photoBlob) {
      const arrayBuffer = await p.photoBlob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      bytes.forEach((b) => (binary += String.fromCharCode(b)));
      photoBase64 = `data:image/jpeg;base64,${btoa(binary)}`;
    }

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
    const data = await r.json();
    if (!r.ok) return { ok: false, via: 'telegram', detail: data?.error ?? `HTTP ${r.status}` };
    return { ok: true, via: 'telegram', sent: data.sent, total: data.total };
  } catch (e) {
    return { ok: false, via: 'telegram', detail: (e as Error).message };
  }
}
