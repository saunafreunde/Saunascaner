// Vercel Serverless Function — POST /api/qr-signin
// Default: Body { member_code: "<uuid>" } — Mitglieder-QR-Scanner
// ?action=pin-checkin: Body { pin: "1234" } — Sauna-Tablet PIN-Checkin
// ?action=tablet-signup: Body { name, email, dsgvo, ref?, origin? } — Schnell-Signup am Tablet

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PIN_RE = /^\d{4}$/;

// Simple in-memory rate limiter: max 10 requests per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(ip: string, max = 10): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  if (entry.count >= max) return true;
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

  const admin = createClient(supaUrl, serviceKey, { auth: { persistSession: false } });
  const action = String(req.query.action ?? '');

  if (action === 'pin-checkin') return handlePinCheckin(req, res, admin);
  if (action === 'tablet-signup') return handleTabletSignup(req, res, admin);

  // Default: Mitglieder-QR-Scanner mit UUID member_code
  const code = (req.body?.member_code ?? '').trim();
  if (!UUID_RE.test(code)) return res.status(400).json({ error: 'invalid member_code' });

  const { data: m, error: mErr } = await admin
    .from('members')
    .select('id, email, name, role, revoked_at')
    .eq('member_code', code)
    .maybeSingle();
  if (mErr) return res.status(500).json({ error: mErr.message });
  if (!m || m.revoked_at) return res.status(404).json({ error: 'unknown_or_revoked' });
  if (!m.email) return res.status(400).json({ error: 'no_email_on_member' });

  const origin = getOrigin(req);
  const redirectTo = `${origin}/me`;

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

function getOrigin(req: VercelRequest): string {
  return (
    (req.headers['origin'] as string) ??
    `https://${req.headers['x-forwarded-host'] ?? req.headers['host']}`
  );
}

// ─── PIN-Checkin am Sauna-Tablet ──────────────────────────────────────────
async function handlePinCheckin(
  req: VercelRequest,
  res: VercelResponse,
  admin: SupabaseClient,
) {
  const pin = String(req.body?.pin ?? '').trim();
  if (!PIN_RE.test(pin)) return res.status(400).json({ error: 'invalid_pin' });

  const { data: rows, error: lookupErr } = await admin.rpc('lookup_gast_by_pin', { p_pin: pin });
  if (lookupErr) return res.status(500).json({ error: lookupErr.message });
  const m = Array.isArray(rows) ? rows[0] : null;
  if (!m) return res.status(404).json({ error: 'pin_unknown' });

  if (!m.email) return res.status(400).json({ error: 'no_email_on_member' });

  // Anwesenheits-Event auslösen: is_present + last_scan_at via direkten Update,
  // damit Trigger log_attendance_on_checkin + log_infusion_attendance_on_scan greifen
  await admin
    .from('members')
    .update({ is_present: true, last_scan_at: new Date().toISOString() })
    .eq('id', m.id);

  const origin = getOrigin(req);
  const redirectTo = `${origin}/checkin/rate`;

  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: m.email,
    options: { redirectTo },
  });
  if (linkErr) return res.status(500).json({ error: linkErr.message });

  const url = linkData?.properties?.action_link;
  if (!url) return res.status(500).json({ error: 'no_action_link' });

  const needsFamilyModal = !!(m.family_has_partner || (m.family_children_count ?? 0) > 0);

  return res.status(200).json({
    url,
    member_id: m.id,
    name: m.name,
    role: m.role,
    needs_family_modal: needsFamilyModal,
    family_has_partner: !!m.family_has_partner,
    family_children_count: m.family_children_count ?? 0,
  });
}

// ─── Schnell-Signup am Sauna-Tablet ───────────────────────────────────────
async function handleTabletSignup(
  req: VercelRequest,
  res: VercelResponse,
  admin: SupabaseClient,
) {
  const { name, email, dsgvo, ref } = req.body as {
    name?: string; email?: string; dsgvo?: boolean; ref?: string;
  };
  const cleanName = (name ?? '').trim();
  const cleanEmail = (email ?? '').trim().toLowerCase();
  if (!cleanName || cleanName.length < 2) return res.status(400).json({ error: 'name_required' });
  if (!cleanEmail.includes('@')) return res.status(400).json({ error: 'valid_email_required' });
  if (!dsgvo) return res.status(400).json({ error: 'dsgvo_required' });

  // Prüfen ob Email bereits einen Account hat → in dem Fall PIN ausgeben
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const existing = existingUsers?.users.find((u) => u.email?.toLowerCase() === cleanEmail);
  if (existing) {
    // Existierenden Member-PIN ausgeben
    const { data: memberRow } = await admin
      .from('members')
      .select('id, checkin_pin, name, role')
      .eq('auth_user_id', existing.id)
      .maybeSingle();
    if (memberRow && memberRow.checkin_pin) {
      return res.status(200).json({
        existing: true,
        pin: memberRow.checkin_pin,
        name: memberRow.name,
        role: memberRow.role,
      });
    }
  }

  // Neuen Auth-User erstellen mit signup_kind=gast Metadata (Trigger generiert PIN)
  const tempPassword = cryptoRandomPassword();
  const { data: signupData, error: signupErr } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      name: cleanName,
      signup_kind: 'gast',
      gast_referral: ref ?? 'Tablet',
      gast_origin: 'tablet_signup',
    },
  });
  if (signupErr) return res.status(500).json({ error: signupErr.message });

  // Kurz warten + Member-PIN abholen (Trigger sollte sofort gefeuert haben)
  let pin: string | null = null;
  let attempts = 0;
  while (!pin && attempts < 5) {
    const { data: m } = await admin
      .from('members')
      .select('checkin_pin')
      .eq('auth_user_id', signupData.user!.id)
      .maybeSingle();
    pin = m?.checkin_pin ?? null;
    if (!pin) {
      await new Promise((r) => setTimeout(r, 200));
      attempts++;
    }
  }
  if (!pin) return res.status(500).json({ error: 'pin_generation_failed' });

  return res.status(200).json({
    existing: false,
    pin,
    name: cleanName,
    email: cleanEmail,
  });
}

function cryptoRandomPassword(): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!#=*';
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes).map((n) => charset[n % charset.length]).join('');
}
