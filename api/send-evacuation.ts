// Vercel Serverless Function — POST /api/send-evacuation
// Sends an evacuation notification (text + optional photo) to all configured Telegram chats.
// Bot token stays server-side (TELEGRAM_BOT_TOKEN env var).

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

type EvacPayload = {
  triggeredBy: string;
  triggeredAt: string;
  presentNames: string[];
  photoBase64?: string; // optional: data:image/jpeg;base64,...
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN missing' });
  if (!supaUrl || !anonKey) return res.status(500).json({ error: 'Supabase env missing' });

  const p = req.body as EvacPayload;
  if (!p?.triggeredBy || !p?.triggeredAt) return res.status(400).json({ error: 'bad payload' });

  const sb = createClient(supaUrl, anonKey);
  const { data: cfg } = await sb.from('system_config').select('value').eq('key', 'telegram_chats').maybeSingle();
  const chats: number[] = Array.isArray(cfg?.value?.chat_ids) ? cfg.value.chat_ids : [];

  if (chats.length === 0) {
    return res.status(200).json({ ok: true, via: 'telegram', sent: 0, note: 'no chats subscribed' });
  }

  const esc = (s: string) => s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  const caption = [
    '🚨 *EVAKUIERUNG ausgelöst*',
    `Auslöser: ${esc(p.triggeredBy)}`,
    `Zeit: ${new Date(p.triggeredAt).toLocaleString('de-DE')}`,
    '',
    `Anwesend \\(${p.presentNames.length}\\):`,
    ...(p.presentNames.length ? p.presentNames.map((n) => `• ${esc(n)}`) : ['_keine Personen erfasst_']),
  ].join('\n');

  // Photo-Blob aus base64 erzeugen
  let photoBuffer: Buffer | null = null;
  if (p.photoBase64) {
    try {
      const base64Data = p.photoBase64.replace(/^data:image\/\w+;base64,/, '');
      photoBuffer = Buffer.from(base64Data, 'base64');
    } catch { /* ignore, fall back to text */ }
  }

  const results = await Promise.allSettled(
    chats.map(async (chat_id) => {
      if (photoBuffer) {
        // Mit Foto senden via sendPhoto
        const fd = new FormData();
        fd.append('chat_id', String(chat_id));
        const photoBytes = Uint8Array.from(photoBuffer);
        fd.append('photo', new Blob([photoBytes], { type: 'image/jpeg' }), 'evac.jpg');
        fd.append('caption', caption);
        fd.append('parse_mode', 'MarkdownV2');
        const r = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method: 'POST', body: fd });
        if (!r.ok) {
          // Fallback: Text ohne Foto
          const tr = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ chat_id, text: caption, parse_mode: 'MarkdownV2' }),
          });
          return { chat_id, ok: tr.ok, status: tr.status };
        }
        return { chat_id, ok: true, status: r.status };
      } else {
        // Nur Text
        const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id, text: caption, parse_mode: 'MarkdownV2' }),
        });
        return { chat_id, ok: r.ok, status: r.status };
      }
    })
  );

  const sent = results.filter((r) => r.status === 'fulfilled' && r.value.ok).length;
  return res.status(200).json({ ok: true, via: 'telegram', sent, total: chats.length, withPhoto: !!photoBuffer });
}
