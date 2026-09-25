// POST /api/push-subscribe — speichert eine Browser-Push-Subscription.
// Erfordert gültiges Supabase-JWT. member_id muss der eingeloggte User sein.
//
// Seit 25.09.2026 (Audit): Nur Endpunkte bekannter Push-Dienste (https, ohne
// Port/Zugangsdaten) und Schlüssel im Base64-Format — vorher wurde jede URL
// gespeichert, und jeder spätere Push hätte an diese Adresse gesendet. Je
// Mitglied bleiben höchstens MAX_GERAETE Abos (die ältesten fallen weg). Die
// Tabelle ist für anon/authenticated gesperrt (0187), es geht nur über hier.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from './_auth.js';

interface PushSubBody {
  member_id: string;
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  user_agent?: string;
}

// Chrome/Edge/Android (FCM), Firefox (Mozilla), Safari/iOS (Apple), Edge alt (WNS).
const PUSH_DIENSTE = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /(^|\.)push\.services\.mozilla\.com$/,
  /(^|\.)push\.apple\.com$/,
  /(^|\.)notify\.windows\.com$/,
];
const B64URL = /^[A-Za-z0-9_+/-]+={0,2}$/;
const MAX_GERAETE = 10;

function endpunktOk(endpoint: unknown): boolean {
  if (typeof endpoint !== 'string' || endpoint.length > 1024) return false;
  let u: URL;
  try { u = new URL(endpoint); } catch { return false; }
  if (u.protocol !== 'https:' || u.port || u.username || u.password) return false;
  return PUSH_DIENSTE.some((r) => r.test(u.hostname));
}

function schluesselOk(s: unknown, min: number, max: number): s is string {
  return typeof s === 'string' && s.length >= min && s.length <= max && B64URL.test(s);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const auth = await authenticate(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = req.body as PushSubBody;
  if (!body?.member_id || !body?.subscription?.endpoint) {
    return res.status(400).json({ error: 'member_id and subscription required' });
  }

  // member_id muss zur authentifizierten Person passen
  if (body.member_id !== auth.member.id) {
    return res.status(403).json({ error: 'member_id mismatch' });
  }

  if (!endpunktOk(body.subscription.endpoint)) {
    console.warn('[push-subscribe] Endpunkt abgelehnt (kein bekannter Push-Dienst)');
    return res.status(400).json({ error: 'Dieser Push-Dienst wird nicht unterstützt.' });
  }
  const keys = body.subscription.keys ?? { p256dh: '', auth: '' };
  if (!schluesselOk(keys.p256dh, 80, 100) || !schluesselOk(keys.auth, 16, 32)) {
    return res.status(400).json({ error: 'Ungültige Push-Schlüssel.' });
  }

  const { error } = await auth.service.from('push_subscriptions').upsert({
    member_id: auth.member.id,
    endpoint: body.subscription.endpoint,
    p256dh_key: keys.p256dh,
    auth_key: keys.auth,
    user_agent: typeof body.user_agent === 'string' ? body.user_agent.slice(0, 300) : null,
  }, { onConflict: 'endpoint' });

  if (error) return res.status(500).json({ error: error.message });

  // Höchstens MAX_GERAETE Abos je Mitglied: die ältesten (meist tote Geräte) fallen weg.
  const { data: meine } = await auth.service
    .from('push_subscriptions')
    .select('id')
    .eq('member_id', auth.member.id)
    .order('created_at', { ascending: false });
  const zuViel = (meine ?? []).slice(MAX_GERAETE).map((r) => r.id as string);
  if (zuViel.length > 0) await auth.service.from('push_subscriptions').delete().in('id', zuViel);

  return res.status(200).json({ ok: true });
}
