// POST /api/push-subscribe — speichert eine Browser-Push-Subscription.
// Erfordert gültiges Supabase-JWT. member_id muss der eingeloggte User sein.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from './_auth.js';

interface PushSubBody {
  member_id: string;
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  user_agent?: string;
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

  const { error } = await auth.service.from('push_subscriptions').upsert({
    member_id: auth.member.id,
    endpoint: body.subscription.endpoint,
    p256dh_key: body.subscription.keys.p256dh,
    auth_key: body.subscription.keys.auth,
    user_agent: body.user_agent ?? null,
  }, { onConflict: 'endpoint' });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
