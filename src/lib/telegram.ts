// Sends evacuation list via the server-side /api/send-evacuation function.
// Bot token never reaches the browser.

export type EvacuationPayload = {
  triggeredBy: string;
  triggeredAt: Date;
  presentNames: string[];
};

export async function sendEvacuationList(p: EvacuationPayload): Promise<{ ok: boolean; via: string; detail?: string; sent?: number; total?: number }> {
  try {
    const r = await fetch('/api/send-evacuation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        triggeredBy: p.triggeredBy,
        triggeredAt: p.triggeredAt.toISOString(),
        presentNames: p.presentNames,
      }),
    });
    const data = await r.json();
    if (!r.ok) return { ok: false, via: 'telegram', detail: data?.error ?? `HTTP ${r.status}` };
    return { ok: true, via: 'telegram', sent: data.sent, total: data.total };
  } catch (e) {
    return { ok: false, via: 'telegram', detail: (e as Error).message };
  }
}
