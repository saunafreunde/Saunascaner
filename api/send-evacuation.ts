// Vercel Serverless Function — POST /api/send-evacuation
// Sends an evacuation notification (text + optional photo) to all configured Telegram chats.
// Bot token stays server-side (TELEGRAM_BOT_TOKEN env var).
//
// FIX 0107 (Audit Phase 8 CRITICAL+HIGH):
//  - serviceClient() statt anon-Key
//  - Photo-Size-Limit 8 MB (Telegram-Max ist 10 MB für sendPhoto, plus Vercel-Memory-Schutz)
//  - tgBroadcast für Throttle + 429-Retry

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { serviceClient } from './_auth.js';
import { tgBroadcast } from './_telegram.js';

type EvacPayload = {
  triggeredBy: string;
  triggeredAt: string;
  presentNames: string[];
  photoBase64?: string;
};

const MAX_PHOTO_BYTES = 8 * 1024 * 1024; // 8 MB

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const sb = serviceClient();
  if (!token) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN missing' });
  if (!sb) return res.status(500).json({ error: 'Supabase service env missing' });

  const p = req.body as EvacPayload;
  if (!p?.triggeredBy || !p?.triggeredAt) return res.status(400).json({ error: 'bad payload' });

  const { data: cfg } = await sb.from('system_config').select('value').eq('key', 'telegram_chats').maybeSingle();
  const chats: number[] = Array.isArray(cfg?.value?.chat_ids) ? cfg.value.chat_ids : [];

  if (chats.length === 0) {
    return res.status(200).json({ ok: true, via: 'telegram', sent: 0, note: 'no chats subscribed' });
  }

  const esc = (s: string) => s.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  const caption = [
    '🚨 *EVAKUIERUNG ausgelöst*',
    `Auslöser: ${esc(p.triggeredBy)}`,
    `Zeit: ${new Date(p.triggeredAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`,
    '',
    `Anwesend \\(${p.presentNames.length}\\):`,
    ...(p.presentNames.length ? p.presentNames.map((n) => `• ${esc(n)}`) : ['_keine Personen erfasst_']),
  ].join('\n');

  // Photo-Blob aus base64 erzeugen — mit Size-Cap gegen Memory-OOM
  let photoBuffer: Buffer | null = null;
  if (p.photoBase64) {
    try {
      const base64Data = p.photoBase64.replace(/^data:image\/\w+;base64,/, '');
      const buf = Buffer.from(base64Data, 'base64');
      if (buf.length > MAX_PHOTO_BYTES) {
        // Zu groß — Text-only senden, kein Photo. Kein Crash.
        photoBuffer = null;
      } else {
        photoBuffer = buf;
      }
    } catch { /* ignore, fall back to text */ }
  }

  // Throttled Telegram-Broadcast mit 429-Retry
  let results;
  if (photoBuffer) {
    const ab = photoBuffer.buffer.slice(
      photoBuffer.byteOffset,
      photoBuffer.byteOffset + photoBuffer.byteLength
    ) as ArrayBuffer;
    results = await tgBroadcast(token, 'sendPhoto', chats, (chat_id) => {
      const fd = new FormData();
      fd.append('chat_id', String(chat_id));
      fd.append('photo', new Blob([ab], { type: 'image/jpeg' }), 'evac.jpg');
      fd.append('caption', caption);
      fd.append('parse_mode', 'MarkdownV2');
      return fd;
    });
    // Fallback: für jede gescheiterte Photo-Sendung Text-Variante
    const failed = results.filter((r) => !r.ok).map((r) => r.chat_id);
    if (failed.length > 0) {
      const textResults = await tgBroadcast(token, 'sendMessage', failed, (chat_id) => ({
        chat_id, text: caption, parse_mode: 'MarkdownV2',
      }));
      // Merge: ersetze gescheiterte Results
      results = results.map((r) => {
        if (!r.ok) {
          const tr = textResults.find((t) => t.chat_id === r.chat_id);
          if (tr) return tr;
        }
        return r;
      });
    }
  } else {
    results = await tgBroadcast(token, 'sendMessage', chats, (chat_id) => ({
      chat_id, text: caption, parse_mode: 'MarkdownV2',
    }));
  }

  const sent = results.filter((r) => r.ok).length;
  return res.status(200).json({
    ok: true, via: 'telegram', sent, total: chats.length, withPhoto: !!photoBuffer,
    photoTruncated: !!(p.photoBase64 && !photoBuffer),
  });
}
