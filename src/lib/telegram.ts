// Telegram delivery for evacuation list.
// Phase 1: stub (console + return ok).
// Phase 4: route through Supabase Edge Function `send-evacuation-list`
//         (token stays server-side). Direct browser call is a fallback
//         only — exposes the bot token to anyone who opens DevTools.

export type EvacuationPayload = {
  triggeredBy: string;
  triggeredAt: Date;
  presentNames: string[];
};

export async function sendEvacuationList(p: EvacuationPayload): Promise<{ ok: boolean; via: string; detail?: string }> {
  const token = import.meta.env.VITE_TELEGRAM_BOT_TOKEN;
  const chat  = import.meta.env.VITE_TELEGRAM_CHAT_ID;

  const lines = [
    '🚨 *EVAKUIERUNG ausgelöst*',
    `Auslöser: ${p.triggeredBy}`,
    `Zeit: ${p.triggeredAt.toLocaleString('de-DE')}`,
    '',
    `Anwesend (${p.presentNames.length}):`,
    ...(p.presentNames.length ? p.presentNames.map((n) => `• ${n}`) : ['_keine Personen erfasst_']),
  ];
  const text = lines.join('\n');

  if (!token || !chat) {
    console.info('[telegram-stub] would send:\n' + text);
    return { ok: true, via: 'stub' };
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: 'Markdown' }),
    });
    if (!r.ok) return { ok: false, via: 'telegram', detail: `HTTP ${r.status}` };
    return { ok: true, via: 'telegram' };
  } catch (e) {
    return { ok: false, via: 'telegram', detail: (e as Error).message };
  }
}
