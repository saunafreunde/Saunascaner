// GET /api/push-vapid-public — liefert den Public-Key für die Browser-Subscription.
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(500).json({ error: 'VAPID_PUBLIC_KEY not set' });
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).json({ publicKey: key });
}
