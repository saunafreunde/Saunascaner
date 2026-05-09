// Vercel Cron — täglich um 09:00 CET (siehe vercel.json)
// Prüft Geburtstagskinder via RPC und sendet Telegram-Glückwunsch.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel-Cron sendet GET. Schützen via CRON_SECRET (kann optional gesetzt werden).
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.authorization ?? '';
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;

  if (!token || !supaUrl || !anonKey) {
    return res.status(500).json({ error: 'env missing' });
  }

  const sb = createClient(supaUrl, anonKey);

  // Geburtstagskinder heute
  const { data: birthdays, error } = await sb.rpc('get_birthdays_today');
  if (error) return res.status(500).json({ error: error.message });

  const list = (birthdays ?? []) as { member_id: string; name: string; sauna_name: string | null }[];
  if (list.length === 0) return res.status(200).json({ ok: true, sent: 0, note: 'no birthdays today' });

  // Telegram-Chat-IDs aus system_config
  const { data: cfg } = await sb.from('system_config').select('value').eq('key', 'telegram_chats').maybeSingle();
  const chats: number[] = Array.isArray(cfg?.value?.chat_ids) ? cfg.value.chat_ids : [];
  if (chats.length === 0) return res.status(200).json({ ok: true, sent: 0, note: 'no chats' });

  let totalSent = 0;
  for (const person of list) {
    const display = person.sauna_name ? `${person.name} („${person.sauna_name}")` : person.name;
    const text = `🎂 Heute hat <b>${display}</b> Geburtstag!\nWir wünschen einen wunderbaren Tag — auf viele weitere Aufgüsse! 🥂`;

    const results = await Promise.allSettled(
      chats.map((chat_id) =>
        fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id, text, parse_mode: 'HTML' }),
        })
      )
    );
    totalSent += results.filter((r) => r.status === 'fulfilled' && (r.value as Response).ok).length;
  }

  return res.status(200).json({ ok: true, birthdays: list.length, sent: totalSent });
}
