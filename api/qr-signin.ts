// Vercel Serverless Function — POST /api/qr-signin
// Body: { member_code: "<uuid>" }
// Returns: { url: "<magic-link>" } — frontend redirects there for instant login.
// Uses Supabase Admin API (service_role) to mint a one-time link for the matching email.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Simple in-memory rate limiter: max 10 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= 10) return true;
  entry.count++;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'too_many_requests' });

  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !serviceKey) return res.status(500).json({ error: 'server env missing' });

  const code = (req.body?.member_code ?? '').trim();
  if (!UUID_RE.test(code)) return res.status(400).json({ error: 'invalid member_code' });

  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });

  const { data: m, error: mErr } = await admin
    .from('members')
    .select('id, email, name, role, revoked_at')
    .eq('member_code', code)
    .maybeSingle();
  if (mErr) return res.status(500).json({ error: mErr.message });
  if (!m || m.revoked_at) return res.status(404).json({ error: 'unknown_or_revoked' });
  if (!m.email) return res.status(400).json({ error: 'no_email_on_member' });

  const origin =
    (req.headers['origin'] as string) ??
    `https://${req.headers['x-forwarded-host'] ?? req.headers['host']}`;
  // Saunameister/Manager/Admin → /planner, alle anderen → /me
  const redirectPath = ['super_admin', 'manager', 'saunameister'].includes(m.role) ? '/me' : '/me';
  const redirectTo = `${origin}${redirectPath}`;

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: m.email,
    options: { redirectTo },
  });
  if (error) return res.status(500).json({ error: error.message });

  const url = data?.properties?.action_link;
  if (!url) return res.status(500).json({ error: 'no_action_link' });

  return res.status(200).json({ url, name: m.name, role: m.role });
}
