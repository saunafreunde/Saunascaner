// POST /api/push-subscribe — speichert eine Browser-Push-Subscription.
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

interface PushSubBody {
  member_id: string;
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } };
  user_agent?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) return res.status(500).json({ error: 'env missing' });

  const body = req.body as PushSubBody;
  if (!body?.member_id || !body?.subscription?.endpoint) {
    return res.status(400).json({ error: 'member_id and subscription required' });
  }

  const sb = createClient(supaUrl, serviceKey);
  const { error } = await sb.from('push_subscriptions').upsert({
    member_id: body.member_id,
    endpoint: body.subscription.endpoint,
    p256dh_key: body.subscription.keys.p256dh,
    auth_key: body.subscription.keys.auth,
    user_agent: body.user_agent ?? null,
  }, { onConflict: 'endpoint' });

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true });
}
