// POST /api/push-send — sendet Push-Notifications an Mitglieder.
// Body (freier Text): { member_ids?: string[], title, body, url?, tag?, requireInteraction? }
// Body (Vorlage):     { vorlage: 'team_aufguss' | 'stammslot_antrag' | 'urlaubsslots', …Bezug }
// Wenn member_ids leer/missing: an alle Subscriptions (nur Admin/Cron).
//
// Authentifizierung:
//  - Bearer <JWT>: Eingeloggtes Mitglied
//      • Self-Test: member_ids === [eigene_id]
//      • Freier Rundruf (kein/leer member_ids) und beliebige Empfänger: nur Admin
//        (z. B. Evakuierung). Seit 25.09.2026 (Audit) nicht mehr jeder Aufgießer —
//        der konnte vorher allen Abonnenten beliebigen Text samt Klick-Ziel schicken.
//      • Vorlagen (Planer): Aufgießer/Admins; Text, Empfänger und Ziel baut der
//        Server aus der Datenbank, jede Vorlage geht je Bezug genau einmal raus
//        (Tabelle push_vorlagen_versand, Migration 0187).
//  - Cron-Aufruf (Server→Server): Header `x-cron-secret: <CRON_SECRET>` → unbeschränkt
//    Fehlt CRON_SECRET in der Umgebung, gilt KEIN Aufruf als Cron (fail closed).
//
// Klick-Ziele (url) sind nur Pfade dieser App — fremde Adressen werden zu '/'
// (public/push-handler.js prüft das beim Klick zusätzlich).
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { authenticate, type AuthOk } from './_auth.js';
import { cronHeaderOk, cronSecretFehlt } from './_cron.js';
import { tgBroadcast, vereinsChats } from './_telegram.js';
import { queryParam } from './_query.js';

// Zeitgrenze je Push-Dienst (web-push setzt sonst keine) und Haltbarkeit einer
// nicht zugestellten Meldung (Standard wären 4 Wochen — eine Aufguss-Meldung
// ist nach ein paar Stunden wertlos).
const PUSH_OPTS = { timeout: 8000, TTL: 6 * 3600 };
const APP_ORIGIN = 'https://app.sauna-fds.de';

type Sub = { endpoint: string; p256dh_key: string; auth_key: string; member_id?: string | null };
type PushInhalt = { title: string; body: string; url: string; tag: string; requireInteraction?: boolean };

/**
 * Klick-Ziel eines Pushes: nur Pfade dieser App. Fremde Domains, '//host',
 * '/\\host', javascript: … werden zum Ersatz ('/'). Geprüft wird nach dem
 * Parsen (ein bloßes startsWith('/') lässt '/\\evil.example' durch).
 */
function appPfad(u: unknown, ersatz = '/'): string {
  if (typeof u !== 'string' || u.length === 0 || u.length > 500) return ersatz;
  try {
    const t = new URL(u, APP_ORIGIN);
    return t.origin === APP_ORIGIN ? `${t.pathname}${t.search}${t.hash}` : ersatz;
  } catch {
    return ersatz;
  }
}

function kurz(s: unknown, max: number): string {
  return String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Schickt einen Push an alle Abos; merkt tote Abos (404/410) in `stale`. Liefert die Zahl der Zustellungen. */
async function zustellen(subs: Sub[], inhalt: PushInhalt, stale: Set<string>): Promise<number> {
  if (subs.length === 0) return 0;
  const payload = JSON.stringify({
    title: kurz(inhalt.title, 120),
    body: kurz(inhalt.body, 400),
    url: appPfad(inhalt.url),
    tag: kurz(inhalt.tag, 100) || 'saunafreunde',
    requireInteraction: !!inhalt.requireInteraction,
  });
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh_key, auth: s.auth_key } },
        payload,
        PUSH_OPTS,
      ),
    ),
  );
  let sent = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') sent++;
    else {
      const code = (r.reason as { statusCode?: number } | undefined)?.statusCode;
      if (code === 404 || code === 410) stale.add(subs[i].endpoint);
    }
  });
  return sent;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Cron-Action: process-queue — verarbeitet notification_queue: Follower-
  // Pushes (aufguss_announced), Telegram (kiosk_joker_telegram) und alle
  // Arten mit Empfänger (Direktnachricht, News, Schichten, Spiele … — siehe queueInhalt).
  if (queryParam(req, 'action') === 'process-queue') {
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

  const b = (req.body ?? {}) as {
    member_ids?: unknown;
    title?: unknown;
    body?: unknown;
    url?: unknown;
    tag?: unknown;
    requireInteraction?: unknown;
    vorlage?: unknown;
  } & Record<string, unknown>;

  // Authorization
  const isCron = cronHeaderOk(req);

  let sb: SupabaseClient;
  if (!isCron) {
    const auth = await authenticate(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

    webpush.setVapidDetails(vapidSub, vapidPub, vapidPriv);
    if (typeof b.vorlage === 'string') return await vorlageSenden(auth, b, res);

    const isAdmin = auth.member.role === 'admin';
    const targets = Array.isArray(b.member_ids) ? b.member_ids : [];
    const isBroadcast = targets.length === 0;
    const isSelfOnly = targets.length === 1 && targets[0] === auth.member.id;

    // Freier Text an alle oder an andere: nur Admins. Aufgießer nutzen die Vorlagen.
    if (!isAdmin && !isSelfOnly) {
      return res.status(403).json({ error: isBroadcast ? 'broadcast not allowed' : 'cannot push to other members' });
    }
    sb = auth.service;
  } else {
    sb = createClient(supaUrl, serviceKey);
    webpush.setVapidDetails(vapidSub, vapidPub, vapidPriv);
  }

  const title = typeof b.title === 'string' ? b.title : '';
  const body = typeof b.body === 'string' ? b.body : '';
  if (!title.trim() || !body.trim()) return res.status(400).json({ error: 'title + body required' });
  const memberIds = Array.isArray(b.member_ids)
    ? b.member_ids.filter((x): x is string => typeof x === 'string').slice(0, 500)
    : [];
  // Kaputte Empfängerliste darf nie zum Rundruf an alle werden.
  if (Array.isArray(b.member_ids) && b.member_ids.length > 0 && memberIds.length === 0) {
    return res.status(400).json({ error: 'member_ids ungültig' });
  }

  let q = sb.from('push_subscriptions').select('id, endpoint, p256dh_key, auth_key, member_id');
  if (memberIds.length > 0) {
    q = q.in('member_id', memberIds);
  }
  const { data: subs, error } = await q;
  if (error) return res.status(500).json({ error: error.message });
  if (!subs || subs.length === 0) return res.status(200).json({ ok: true, sent: 0, note: 'no subs' });

  // 410 Gone / 404: Subscription ist tot — bereinigen
  const stale = new Set<string>();
  const sent = await zustellen(subs as Sub[], {
    title,
    body,
    url: appPfad(b.url),
    tag: typeof b.tag === 'string' ? b.tag : 'saunafreunde',
    requireInteraction: b.requireInteraction === true,
  }, stale);
  if (stale.size > 0) {
    await sb.from('push_subscriptions').delete().in('endpoint', Array.from(stale));
  }

  return res.status(200).json({ ok: true, sent, failed: subs.length - sent, stale_pruned: stale.size });
}

// ─── Vorlagen (Rundrufe aus dem Planer) ──────────────────────────────────
// Der Client nennt nur Vorlage + Bezug; Text, Empfänger und Ziel kommen aus
// der Datenbank. Jede Vorlage geht je Bezug genau einmal raus: der Schlüssel
// (z. B. team_aufguss:<infusion_id>) wird VOR dem Senden in
// push_vorlagen_versand eingetragen — ein zweiter Aufruf findet ihn schon.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FRISCH_MS = 15 * 60_000;
const WOCHENTAG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function berlinZeit(iso: string, mitTag: boolean): string {
  return new Date(iso).toLocaleString('de-DE', {
    ...(mitTag ? { weekday: 'short', day: '2-digit', month: '2-digit' } : {}),
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin',
  } as Intl.DateTimeFormatOptions);
}

function berlinDatum(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  return y && m && d ? `${d}.${m}.` : ymd;
}

async function vorlageSenden(auth: AuthOk, b: Record<string, unknown>, res: VercelResponse) {
  const sb = auth.service;
  const me = auth.member;
  const istAdmin = me.role === 'admin';
  const vorlage = b.vorlage;

  let schluessel = '';
  let inhalt: PushInhalt | null = null;
  let empfaengerIds: string[] = [];

  const { data: ich } = await sb.from('members').select('name').eq('id', me.id).maybeSingle();
  const meinName = kurz(ich?.name ?? 'Jemand', 60);

  if (vorlage === 'team_aufguss') {
    // Team-Aufguss sucht Co-Aufgießer → an alle anderen Aufgießer.
    if (!me.is_aufgieser && !istAdmin) return res.status(403).json({ error: 'nur_aufgieser' });
    const saunaId = typeof b.sauna_id === 'string' && UUID_RE.test(b.sauna_id) ? b.sauna_id : null;
    const startMs = typeof b.start_time === 'string' ? Date.parse(b.start_time) : NaN;
    if (!saunaId || !Number.isFinite(startMs)) return res.status(400).json({ error: 'sauna_id + start_time fehlen' });
    const { data: infs } = await sb
      .from('infusions')
      .select('id, title, start_time, saunameister_id, team_infusion, saunas(name)')
      .eq('sauna_id', saunaId)
      .gte('start_time', new Date(startMs - 60_000).toISOString())
      .lte('start_time', new Date(startMs + 60_000).toISOString())
      .eq('team_infusion', true)
      .limit(1);
    const inf = infs?.[0] as { id: string; title: string; start_time: string; saunameister_id: string | null; saunas: unknown } | undefined;
    if (!inf) return res.status(404).json({ error: 'team_aufguss_nicht_gefunden' });
    if (inf.saunameister_id !== me.id && !istAdmin) return res.status(403).json({ error: 'nicht_dein_aufguss' });
    if (Date.parse(inf.start_time) < Date.now()) return res.status(409).json({ error: 'aufguss_vorbei' });
    let meister = meinName;
    if (inf.saunameister_id && inf.saunameister_id !== me.id) {
      const { data: m } = await sb.from('members').select('name').eq('id', inf.saunameister_id).maybeSingle();
      if (m?.name) meister = kurz(m.name, 60);
    }
    const sauna = (Array.isArray(inf.saunas) ? inf.saunas[0] : inf.saunas) as { name?: string } | null;
    schluessel = `team_aufguss:${inf.id}`;
    inhalt = {
      title: '👥 Neuer Team-Aufguss',
      body: `${meister} sucht Co-Aufgießer · ${kurz(inf.title, 80)} · ${berlinZeit(inf.start_time, true)}${sauna?.name ? ` · ${kurz(sauna.name, 40)}` : ''}`,
      url: '/planner',
      tag: `team-aufguss-${inf.id}`,
    };
    const { data: aufg } = await sb.from('members').select('id')
      .eq('is_aufgieser', true).eq('approved', true).is('revoked_at', null);
    empfaengerIds = (aufg ?? []).map((m) => m.id as string).filter((id) => id !== me.id && id !== inf.saunameister_id);
  } else if (vorlage === 'stammslot_antrag') {
    // Neuer Stamm-Slot-Antrag → nur an die Admins (vorher an alle Abonnenten).
    const slotId = typeof b.slot_id === 'string' && UUID_RE.test(b.slot_id) ? b.slot_id : null;
    if (!slotId) return res.status(400).json({ error: 'slot_id fehlt' });
    const { data: slot } = await sb
      .from('recurring_slots')
      .select('id, member_id, weekday, slot_hour, status, created_at, saunas(name)')
      .eq('id', slotId)
      .maybeSingle();
    if (!slot || slot.member_id !== me.id) return res.status(404).json({ error: 'antrag_nicht_gefunden' });
    if (slot.status !== 'pending' || Date.parse(slot.created_at as string) < Date.now() - FRISCH_MS) {
      return res.status(409).json({ error: 'antrag_nicht_frisch' });
    }
    const sauna = (Array.isArray(slot.saunas) ? slot.saunas[0] : slot.saunas) as { name?: string } | null;
    schluessel = `stammslot_antrag:${slot.id}`;
    inhalt = {
      title: '🔔 Neuer Stamm-Slot-Antrag',
      body: `${meinName} möchte ${WOCHENTAG[Number(slot.weekday)] ?? '?'} ${String(slot.slot_hour).padStart(2, '0')}:00${sauna?.name ? ` ${kurz(sauna.name, 40)}` : ''}`,
      url: '/admin#recurring',
      tag: 'recurring-slot-apply',
    };
    const { data: admins } = await sb.from('members').select('id').eq('role', 'admin').is('revoked_at', null);
    empfaengerIds = (admins ?? []).map((m) => m.id as string);
  } else if (vorlage === 'urlaubsslots') {
    // Urlaub gibt eigene Stamm-Aufgüsse frei → an alle anderen Aufgießer.
    const absenceId = typeof b.absence_id === 'string' && UUID_RE.test(b.absence_id) ? b.absence_id : null;
    if (!absenceId) return res.status(400).json({ error: 'absence_id fehlt' });
    const { data: abw } = await sb
      .from('aufgieser_absences')
      .select('id, member_id, start_date, end_date, created_at')
      .eq('id', absenceId)
      .maybeSingle();
    if (!abw || abw.member_id !== me.id) return res.status(404).json({ error: 'urlaub_nicht_gefunden' });
    if (Date.parse(abw.created_at as string) < Date.now() - FRISCH_MS) return res.status(409).json({ error: 'urlaub_nicht_frisch' });
    const { data: meineSlots } = await sb.from('recurring_slots').select('id').eq('member_id', me.id);
    const slotIds = (meineSlots ?? []).map((s) => s.id as string);
    let frei: { start_time: string; saunas: unknown }[] = [];
    if (slotIds.length > 0) {
      const { data: infs } = await sb
        .from('infusions')
        .select('start_time, saunas(name)')
        .in('recurring_slot_id', slotIds)
        .eq('is_personal_fallback', true)
        .gte('end_time', new Date().toISOString())
        .gte('start_time', `${abw.start_date}T00:00:00+00:00`)
        .lte('start_time', `${abw.end_date}T23:59:59+00:00`)
        .order('start_time')
        .limit(50);
      frei = (infs ?? []) as { start_time: string; saunas: unknown }[];
    }
    const zeitraum = `${berlinDatum(String(abw.start_date))}–${berlinDatum(String(abw.end_date))}`;
    const liste = frei.slice(0, 5).map((i) => {
      const s = (Array.isArray(i.saunas) ? i.saunas[0] : i.saunas) as { name?: string } | null;
      return `${berlinZeit(i.start_time, true)}${s?.name ? ` ${kurz(s.name, 30)}` : ''}`;
    }).join(' · ');
    schluessel = `urlaubsslots:${abw.id}`;
    inhalt = {
      title: '🏖️ Urlaubsslots frei',
      body: frei.length > 0
        ? `${meinName} ist im Urlaub — ${frei.length} Slot${frei.length === 1 ? '' : 's'} verfügbar: ${liste}${frei.length > 5 ? '…' : ''}`
        : `${meinName} ist im Urlaub (${zeitraum}) — im Planer sind Slots frei geworden.`,
      url: '/planner',
      tag: 'urlaubsslots',
    };
    const { data: aufg } = await sb.from('members').select('id')
      .eq('is_aufgieser', true).eq('approved', true).is('revoked_at', null);
    empfaengerIds = (aufg ?? []).map((m) => m.id as string).filter((id) => id !== me.id);
  } else {
    return res.status(400).json({ error: 'unbekannte_vorlage' });
  }

  // Genau einmal: Schlüssel beanspruchen, bevor irgendetwas rausgeht.
  const { error: claimErr } = await sb.from('push_vorlagen_versand').insert({ schluessel, member_id: me.id });
  if (claimErr) {
    if ((claimErr as { code?: string }).code === '23505') return res.status(200).json({ ok: true, sent: 0, schon_gesendet: true });
    console.error('[push-send] Vorlage nicht beansprucht', vorlage, claimErr.message);
    return res.status(500).json({ error: 'vorlage_fehlgeschlagen' });
  }

  if (empfaengerIds.length === 0) return res.status(200).json({ ok: true, sent: 0, note: 'keine Empfänger' });
  const { data: subs } = await sb
    .from('push_subscriptions')
    .select('endpoint, p256dh_key, auth_key, member_id')
    .in('member_id', empfaengerIds);
  const stale = new Set<string>();
  const sent = await zustellen((subs ?? []) as Sub[], inhalt, stale);
  if (stale.size > 0) await sb.from('push_subscriptions').delete().in('endpoint', Array.from(stale));
  return res.status(200).json({ ok: true, sent });
}

// ─── Cron-Action: notification_queue verarbeiten ─────────────────────────
// Aufruf via Supabase pg_cron „process-notification-queue" jede Minute; der Job
// liest x-cron-secret bei jedem Lauf aus dem Vault-Eintrag 'cron_secret' (0168).
// Stellt jede Queue-Zeile zu (Push an den Empfänger bzw. Follower, Telegram)
// und markiert sie einzeln (Audit 25.09.2026).
async function processQueue(req: VercelRequest, res: VercelResponse) {
  // Fail closed: ohne gesetztes CRON_SECRET oder mit falschem Header wird
  // abgelehnt. Vorher war der Endpunkt offen, solange CRON_SECRET fehlte.
  if (!cronHeaderOk(req)) {
    if (cronSecretFehlt()) {
      console.error('[push-send] process-queue abgelehnt: CRON_SECRET fehlt oder ist kürzer als 32 Zeichen');
    }
    return res.status(401).json({ error: 'cron secret required' });
  }

  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const vapidPub = process.env.VAPID_PUBLIC_KEY;
  const vapidPriv = process.env.VAPID_PRIVATE_KEY;
  const vapidSub = process.env.VAPID_SUBJECT ?? 'mailto:admin@saunascaner.local';
  if (!supaUrl || !serviceKey || !vapidPub || !vapidPriv) {
    return res.status(500).json({ error: 'env missing' });
  }

  const sb = createClient(supaUrl, serviceKey);
  webpush.setVapidDetails(vapidSub, vapidPub, vapidPriv);

  // Pending-Queue-Einträge holen (max 50 pro Run, älteste zuerst)
  const { data: queue, error: qErr } = await sb
    .from('notification_queue')
    .select('id, kind, recipient_id, payload, dedup_key, error')
    .is('processed_at', null)
    .order('created_at', { ascending: true })
    .limit(50);
  if (qErr) return res.status(500).json({ error: qErr.message });
  if (!queue || queue.length === 0) return res.status(200).json({ ok: true, processed: 0 });

  const t0 = Date.now();
  let totalSent = 0;
  let processed = 0;
  let errors = 0;
  let unbekannt = 0;
  let rest = 0;
  const stale = new Set<string>();
  const zeilen = queue as QueueZeile[];

  // Abos aller Empfänger dieses Laufs auf einmal laden (statt je Zeile).
  const empfaenger = Array.from(new Set(zeilen.map((z) => z.recipient_id).filter((x): x is string => !!x)));
  const subsByMember = new Map<string, Sub[]>();
  if (empfaenger.length > 0) {
    const { data: alle } = await sb
      .from('push_subscriptions')
      .select('endpoint, p256dh_key, auth_key, member_id')
      .in('member_id', empfaenger);
    for (const s of (alle ?? []) as Sub[]) {
      const k = String(s.member_id);
      const arr = subsByMember.get(k) ?? [];
      arr.push(s);
      subsByMember.set(k, arr);
    }
  }

  for (const item of zeilen) {
    // Zeitbudget: was nicht mehr passt, übernimmt der nächste Lauf (jede Minute).
    if (Date.now() - t0 > QUEUE_ZEITBUDGET_MS) { rest++; continue; }

    // Einzeln beanspruchen: processed_at VOR dem Senden setzen, nur wenn noch
    // leer. Bricht ein Lauf ab (Zeitlimit), wird dadurch nichts doppelt
    // verschickt — vorher wurde der ganze Batch erst am Ende markiert, und nach
    // einem Abbruch ging jede Meldung eine Minute später noch einmal raus.
    const { data: claim, error: cErr } = await sb
      .from('notification_queue')
      .update({ processed_at: new Date().toISOString() })
      .eq('id', item.id)
      .is('processed_at', null)
      .select('id');
    if (cErr || !claim || claim.length === 0) continue;

    try {
      const payload = (item.payload ?? {}) as Record<string, unknown>;
      let hinweis: string | null = null;

      if (item.kind === 'aufguss_announced') {
        totalSent += await aufgussAngekuendigt(sb, payload, stale);
      } else if (item.kind === 'kiosk_joker_telegram') {
        // Dieselbe Meldung einmal an den Telegram-Verteiler. Fehlt der
        // Bot-Token oder gibt es keine Chats, gilt die Zeile trotzdem als erledigt.
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const text = typeof payload.text === 'string' ? payload.text : '';
        if (token && text) {
          const chats = await vereinsChats(sb);
          if (chats.length > 0) {
            const tg = await tgBroadcast(token, 'sendMessage', chats, (chat_id) => ({ chat_id, text, parse_mode: 'HTML' }));
            totalSent += tg.filter((r) => r.ok).length;
          }
        }
      } else {
        const inhalt = queueInhalt(item, payload);
        if (inhalt === undefined) {
          // Nicht still verwerfen: sichtbar machen (Log + Spalte error).
          unbekannt++;
          console.warn('[push-send] Queue-Art ohne Push-Zustellung:', item.kind);
          hinweis = `Keine Push-Zustellung für die Art „${item.kind}“ vorgesehen.`;
        } else if (inhalt && item.recipient_id) {
          totalSent += await zustellen(subsByMember.get(item.recipient_id) ?? [], inhalt, stale);
        }
      }
      if (hinweis || item.error) {
        // Hinweis vermerken bzw. nach geglücktem zweiten Versuch den alten Fehlertext entfernen.
        await sb.from('notification_queue').update({ error: hinweis }).eq('id', item.id);
      }
      processed++;
    } catch (e) {
      errors++;
      const msg = String((e as Error)?.message ?? e).slice(0, 500);
      console.error('[push-send] Queue-Eintrag fehlgeschlagen', item.kind, msg);
      // Erster Fehler: für genau EINEN weiteren Versuch im nächsten Lauf
      // freigeben. Beim zweiten Fehler bleibt die Zeile erledigt — sonst
      // verstopft sie die Warteschlange (es werden immer die 50 ältesten
      // offenen Zeilen geholt).
      let freigegeben = false;
      if (!item.error) {
        const { error: rErr } = await sb.from('notification_queue')
          .update({ processed_at: null, error: msg })
          .eq('id', item.id);
        freigegeben = !rErr;
      }
      if (!freigegeben) await sb.from('notification_queue').update({ error: msg }).eq('id', item.id);
    }
  }

  // Tote Abos (404/410) aufräumen — wie beim direkten Versand oben.
  if (stale.size > 0) await sb.from('push_subscriptions').delete().in('endpoint', Array.from(stale));

  return res.status(200).json({
    ok: true,
    processed,
    sent: totalSent,
    errors,
    unbekannt,
    rest,
    stale_pruned: stale.size,
  });
}

// Nach so vielen ms nimmt ein Lauf keine neuen Zeilen mehr an (maxDuration 30 s).
const QUEUE_ZEITBUDGET_MS = 18_000;

type QueueZeile = {
  id: string;
  kind: string;
  recipient_id: string | null;
  payload: unknown;
  dedup_key: string | null;
  error: string | null;
};

/**
 * Push-Inhalt je Queue-Art (Ziele wie im Posteingang, components/NotificationInbox.tsx).
 *   null      = bewusst kein Push: rating_reminder schickt api/push-reminder-cron.ts
 *               schon selbst (sonst käme die Erinnerung doppelt).
 *   undefined = unbekannte Art ohne Titel — wird mit Hinweis in `error` erledigt.
 * Das Handbuch verspricht Pushes für Direktnachrichten, Vereins-News,
 * Schichttausch/-absage, Kommentare, neue Fans und das Vereins-Postfach; bis
 * 25.09.2026 wurden diese Arten als erledigt markiert, ohne dass etwas rausging.
 */
function queueInhalt(item: QueueZeile, p: Record<string, unknown>): PushInhalt | null | undefined {
  const s = (k: string): string | null => (typeof p[k] === 'string' && (p[k] as string).trim() ? (p[k] as string) : null);
  const kind = item.kind;
  const tag = item.dedup_key || `${kind}-${item.id}`;

  if (kind === 'rating_reminder') return null;
  if (!item.recipient_id) return undefined;

  if (kind === 'dm_received') {
    const conv = s('conversation_id');
    return {
      title: s('title') ?? '✉️ Neue Nachricht',
      body: s('body') ?? 'Du hast eine neue Nachricht.',
      url: conv ? `/dm/${conv}` : '/dm',
      // Je Unterhaltung ein Eintrag: neue Nachrichten ersetzen die alte Meldung.
      tag: conv ? `dm-${conv}` : 'dm',
    };
  }
  if (kind === 'new_follower') {
    const f = s('follower_id');
    return {
      title: s('title') ?? '🌟 Neuer Fan',
      body: s('body') ?? `${s('follower_name') ?? 'Jemand'} folgt dir jetzt.`,
      url: f ? `/profile/${f}` : '/me',
      tag,
    };
  }
  if (kind === 'post_commented') {
    return { title: s('title') ?? '💬 Neuer Kommentar', body: s('body') ?? 'Jemand hat deinen Beitrag kommentiert.', url: '/feed', tag };
  }
  if (kind === 'org_news_published') {
    // Die News-Zeile trägt nur den Titel der Ankündigung.
    return { title: '📣 Vereins-News', body: s('title') ?? 'Es gibt eine neue Ankündigung.', url: '/gast', tag: `news-${s('news_id') ?? item.id}` };
  }
  if (kind === 'shared_email_inbound') {
    return { title: s('title') ?? '📧 Neue Vereins-Mail', body: s('body') ?? 'Im Vereins-Postfach ist eine neue Mail.', url: '/postfach?view=shared', tag };
  }
  if (kind.startsWith('shift_')) {
    // Tausch-Ergebnis und übernommene Absagen gehen an die Personalplanung (/cp).
    const fuerCp = kind === 'shift_swap_notified_cp' || kind === 'shift_cancellation_taken';
    return {
      title: s('title') ?? '👨‍🍳 Schichtplan',
      body: s('body') ?? 'Es gibt Neuigkeiten zu den Schichten.',
      url: fuerCp ? '/cp' : '/mitarbeiter',
      tag,
    };
  }
  if (kind === 'fan_upgrade_request') {
    return { title: '🤝 Neuer Fan-Antrag', body: `${s('member_name') ?? 'Jemand'} möchte Fan werden.`, url: '/admin#members', tag };
  }
  if (kind === 'fan_upgrade_approved') {
    return { title: '🎉 Fan-Antrag angenommen', body: 'Willkommen — dein Antrag wurde angenommen.', url: '/fan', tag };
  }
  if (kind === 'fan_upgrade_rejected') {
    return { title: 'Fan-Antrag', body: `Dein Antrag wurde leider abgelehnt.${s('reason') ? ` Grund: ${s('reason')}` : ''}`, url: '/fan', tag };
  }
  if (kind === 'fan_membership_expiring') {
    const tage = typeof p.days_left === 'number' ? p.days_left : null;
    return { title: '⏳ Fan-Mitgliedschaft läuft aus', body: tage !== null ? `Deine Mitgliedschaft läuft in ${tage} Tagen aus.` : 'Deine Mitgliedschaft läuft bald aus.', url: '/fan', tag };
  }
  if (kind.startsWith('game_')) {
    // Spiele-Pushes (Migration 0145): Titel/Body stehen im Payload.
    const matchId = s('match_id');
    return {
      title: s('title') ?? '🎮 Spiele',
      body: s('body') ?? 'Es gibt Neuigkeiten in deinen Matches.',
      url: matchId ? `/spiele/match/${matchId}` : '/spiele',
      tag: item.dedup_key || `game-${matchId ?? 'hub'}`,
    };
  }
  if (kind === 'kiosk_joker') {
    // Eingangs-Tablet außerhalb der Öffnungszeiten angetippt (0153): eine Zeile
    // je Admin; requireInteraction, damit die Meldung stehen bleibt.
    return {
      title: s('title') ?? '🃏 Eingangs-Tablet angetippt',
      body: s('body') ?? 'Jemand hat den gesperrten Bildschirm berührt.',
      url: appPfad(s('url'), '/admin'),
      tag: 'kiosk-joker',
      requireInteraction: true,
    };
  }
  if (kind.startsWith('saunafest_')) {
    // Saunafest (0163): Einteilung, Planbestätigung, Erinnerung.
    return {
      title: s('title') ?? '🔥 Saunafest',
      body: s('body') ?? 'Es gibt Neuigkeiten zum Saunafest.',
      url: appPfad(s('url'), '/planner#saunafest'),
      tag: item.dedup_key || `saunafest-${item.id}`,
    };
  }
  if (kind === 'telegram_anfrage') {
    // Neuer Telegram-Chat wartet auf Freigabe (0187) — an jeden Admin.
    return {
      title: s('title') ?? '✈️ Telegram-Anmeldung wartet',
      body: s('body') ?? 'Ein Telegram-Chat möchte die Vereins-Meldungen bekommen.',
      url: appPfad(s('url'), '/admin#handbook'),
      tag,
    };
  }
  // Neue Art mit Titel: lieber zustellen als still verlieren.
  const titel = s('title');
  if (titel) return { title: titel, body: s('body') ?? '', url: appPfad(s('url')), tag };
  return undefined;
}

/** Follower eines Aufgießers über einen neu geplanten Aufguss informieren. */
async function aufgussAngekuendigt(sb: SupabaseClient, payload: Record<string, unknown>, stale: Set<string>): Promise<number> {
  const saunameisterId = payload.saunameister_id as string;
  const infusionId = payload.infusion_id as string;
  const startTime = payload.start_time as string;
  const title = (payload.title as string) || 'Aufguss';
  if (!saunameisterId) return 0;

  // Alle Follower mit aktivierten Notifications
  const { data: followers } = await sb
    .from('member_follows')
    .select('follower_id')
    .eq('followee_id', saunameisterId)
    .eq('notifications_enabled', true);
  const followerIds = (followers ?? []).map((f) => f.follower_id as string);
  if (followerIds.length === 0) return 0;

  const { data: subs } = await sb
    .from('push_subscriptions')
    .select('endpoint, p256dh_key, auth_key')
    .in('member_id', followerIds);
  if (!subs || subs.length === 0) return 0;

  // Saunameister-Name + Sauna-Name laden
  const [{ data: meister }, { data: sauna }] = await Promise.all([
    sb.from('members').select('name').eq('id', saunameisterId).maybeSingle(),
    sb.from('saunas').select('name, temperature_label').eq('id', payload.sauna_id as string).maybeSingle(),
  ]);
  const meisterName = meister?.name ?? 'Aufgießer';
  const saunaName = sauna?.name ?? 'Sauna';
  const time = startTime
    ? new Date(startTime).toLocaleString('de-DE', {
      weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/Berlin',
    })
    : '';
  return await zustellen(subs as Sub[], {
    title: `🌟 ${meisterName} plant einen Aufguss`,
    body: `${title} · ${saunaName}${time ? ` · ${time}` : ''}`,
    url: `/aufgieser/${saunameisterId}`,
    tag: `aufguss-${infusionId}`,
  }, stale);
}
