// POST /api/push-send — sendet Push-Notifications an Mitglieder.
// Body: { member_ids?: string[], title: string, body: string, url?: string, tag?: string }
// Wenn member_ids leer/missing: an alle Subscriptions (nur Admin/Aufgieser/Cron).
//
// Authentifizierung:
//  - Bearer <JWT>: Eingeloggtes Mitglied
//      • Self-Test: member_ids === [eigene_id]
//      • Broadcast (kein/leer member_ids): nur Admin oder is_aufgieser (z.B. Evakuierung)
//      • Beliebige andere Empfänger: nur Admin
//  - Cron-Aufruf (Server→Server): Header `x-cron-secret: <CRON_SECRET>` → unbeschränkt
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { authenticate } from './_auth.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Cron-Action: process-queue — verarbeitet notification_queue,
  // sendet Pushes an Follower für aufguss_announced-Events.
  if (req.query.action === 'process-queue') {
    return await processQueue(req, res);
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPub = process.env.VAPID_PUBLIC_KEY;
  const vapidPriv = process.env.VAPID_PRIVATE_KEY;
  const vapidSub = process.env.VAPID_SUBJECT ?? 'mailto:admin@saunascaner.local';
  if (!supaUrl || !serviceKey || !vapidPub || !vapidPriv) {
    return res.status(500).json({ error: 'env missing (Supabase/VAPID)' });
  }

  const { member_ids, title, body, url, tag, requireInteraction } = req.body as {
    member_ids?: string[];
    title: string;
    body: string;
    url?: string;
    tag?: string;
    requireInteraction?: boolean;
  };
  if (!title || !body) return res.status(400).json({ error: 'title + body required' });

  // Authorization
  const cronSecret = process.env.CRON_SECRET;
  const cronHeader = req.headers['x-cron-secret'];
  const isCron = !!cronSecret && cronHeader === cronSecret;

  let sb;
  if (!isCron) {
    const auth = await authenticate(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    const isAdmin = auth.member.role === 'admin';
    const isAufgieser = !!auth.member.is_aufgieser;
    const targets = Array.isArray(member_ids) ? member_ids : [];
    const isBroadcast = targets.length === 0;
    const isSelfOnly = targets.length === 1 && targets[0] === auth.member.id;

    if (isBroadcast) {
      if (!isAdmin && !isAufgieser) return res.status(403).json({ error: 'broadcast not allowed' });
    } else if (!isAdmin && !isSelfOnly) {
      return res.status(403).json({ error: 'cannot push to other members' });
    }
    sb = auth.service;
  } else {
    sb = createClient(supaUrl, serviceKey);
  }

  webpush.setVapidDetails(vapidSub, vapidPub, vapidPriv);

  let q = sb.from('push_subscriptions').select('id, endpoint, p256dh_key, auth_key, member_id');
  if (Array.isArray(member_ids) && member_ids.length > 0) {
    q = q.in('member_id', member_ids);
  }
  const { data: subs, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  if (!subs || subs.length === 0) return res.status(200).json({ ok: true, sent: 0, note: 'no subs' });

  const payload = JSON.stringify({ title, body, url: url ?? '/', tag: tag ?? 'saunafreunde', requireInteraction: !!requireInteraction });

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } },
        payload
      )
    )
  );

  // 410 Gone / 404: Subscription ist tot — bereinigen
  const stale: string[] = [];
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      const err = r.reason as { statusCode?: number };
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        stale.push(subs[i].endpoint);
      }
    }
  });
  if (stale.length > 0) {
    await sb.from('push_subscriptions').delete().in('endpoint', stale);
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return res.status(200).json({ ok: true, sent, failed: results.length - sent, stale_pruned: stale.length });
}

// ─── Cron-Action: notification_queue verarbeiten ─────────────────────────
// Aufruf via Supabase pg_cron alle 60s mit Header x-cron-secret oder GET/POST mit cronSecret.
// Sendet pro Follower mit aktivierten Notifications eine Push-Notification.
async function processQueue(req: VercelRequest, res: VercelResponse) {
  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPub = process.env.VAPID_PUBLIC_KEY;
  const vapidPriv = process.env.VAPID_PRIVATE_KEY;
  const vapidSub = process.env.VAPID_SUBJECT ?? 'mailto:admin@saunascaner.local';
  if (!supaUrl || !serviceKey || !vapidPub || !vapidPriv) {
    return res.status(500).json({ error: 'env missing' });
  }

  // Optional: Secret-Check wenn CRON_SECRET gesetzt ist (sonst offen wie push-reminder-cron).
  // Da der Endpoint nur Pushes aus der Queue verschickt und idempotent ist (processed_at-Update),
  // ist eine offene Variante akzeptabel — schlimmstenfalls verzögern sich Pushes.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const headerSecret = req.headers['x-cron-secret'];
    if (headerSecret !== cronSecret) {
      return res.status(401).json({ error: 'cron secret required' });
    }
  }

  const sb = createClient(supaUrl, serviceKey);
  webpush.setVapidDetails(vapidSub, vapidPub, vapidPriv);

  // Pending-Queue-Einträge holen (max 50 pro Run)
  const { data: queue, error: qErr } = await sb
    .from('notification_queue')
    .select('id, kind, payload, dedup_key')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(50);
  if (qErr) return res.status(500).json({ error: qErr.message });
  if (!queue || queue.length === 0) return res.status(200).json({ ok: true, processed: 0 });

  let totalSent = 0;
  const processedIds: string[] = [];
  const errors: { id: string; err: string }[] = [];

  for (const item of queue) {
    try {
      const payload = item.payload as Record<string, unknown>;

      if (item.kind === 'aufguss_announced') {
        const saunameisterId = payload.saunameister_id as string;
        const infusionId = payload.infusion_id as string;
        const startTime = payload.start_time as string;
        const title = (payload.title as string) || 'Aufguss';

        // Saunameister-Name + Sauna-Name laden
        const [{ data: meister }, { data: sauna }] = await Promise.all([
          sb.from('members').select('name').eq('id', saunameisterId).maybeSingle(),
          sb.from('saunas').select('name, temperature_label').eq('id', payload.sauna_id as string).maybeSingle(),
        ]);

        // Alle Follower mit aktivierten Notifications
        const { data: followers } = await sb
          .from('member_follows')
          .select('follower_id')
          .eq('followee_id', saunameisterId)
          .eq('notifications_enabled', true);
        const followerIds = (followers ?? []).map((f) => f.follower_id);

        if (followerIds.length > 0) {
          // Push-Subscriptions dieser Follower
          const { data: subs } = await sb
            .from('push_subscriptions')
            .select('endpoint, p256dh_key, auth_key')
            .in('member_id', followerIds);

          if (subs && subs.length > 0) {
            const meisterName = meister?.name ?? 'Aufgießer';
            const saunaName = sauna?.name ?? 'Sauna';
            const time = new Date(startTime).toLocaleString('de-DE', {
              weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
              timeZone: 'Europe/Berlin',
            });
            const pushPayload = JSON.stringify({
              title: `🌟 ${meisterName} plant einen Aufguss`,
              body: `${title} · ${saunaName} · ${time}`,
              url: `/aufgieser/${saunameisterId}`,
              tag: `aufguss-${infusionId}`,
            });

            const results = await Promise.allSettled(
              subs.map((s) =>
                webpush.sendNotification(
                  { endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } },
                  pushPayload
                )
              )
            );
            totalSent += results.filter((r) => r.status === 'fulfilled').length;
          }
        }
      }

      processedIds.push(item.id);
    } catch (e) {
      errors.push({ id: item.id, err: (e as Error).message });
    }
  }

  // Verarbeitete Einträge markieren
  if (processedIds.length > 0) {
    await sb
      .from('notification_queue')
      .update({ processed_at: new Date().toISOString() })
      .in('id', processedIds);
  }
  // Fehler-Einträge mit Fehler markieren (aber nicht processed)
  for (const e of errors) {
    await sb.from('notification_queue').update({ error: e.err }).eq('id', e.id);
  }

  return res.status(200).json({
    ok: true,
    processed: processedIds.length,
    sent: totalSent,
    errors: errors.length,
  });
}
