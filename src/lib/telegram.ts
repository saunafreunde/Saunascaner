// Sends notifications via server-side API functions.
// Bot token never reaches the browser.

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

export async function sendNotification(text: string): Promise<void> {
  try {
    await fetch('/api/send-notification', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch { /* ignore */ }
}

export async function sendBadgeAnnouncement(
  displayName: string,
  badge: { emoji: string; label: string; description: string }
): Promise<void> {
  const text = `🏅 <b>${displayName}</b> hat gerade <b>${badge.label}</b> freigeschaltet! ${badge.emoji}\n<i>${badge.description}</i>`;
  await sendNotification(text);
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
      headers: { 'content-type': 'application/json' },
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
