// Hilfsfunktionen für Authentifizierung in Vercel-Funktionen.
// Verifiziert JWT via Supabase und liefert Member-Datensatz zurück.
import type { VercelRequest } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type AuthedMember = {
  id: string;
  auth_user_id: string;
  role: 'member' | 'admin';
  is_aufgieser: boolean;
  approved: boolean;
};

export type AuthOk = { ok: true; member: AuthedMember; service: SupabaseClient };
export type AuthErr = { ok: false; status: number; error: string };

export async function authenticate(req: VercelRequest): Promise<AuthOk | AuthErr> {
  const supaUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supaUrl || !anonKey || !serviceKey) {
    return { ok: false, status: 500, error: 'env missing' };
  }

  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return { ok: false, status: 401, error: 'missing bearer token' };

  // Token gegen Supabase Auth prüfen (anon-Client mit Bearer)
  const userClient = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) return { ok: false, status: 401, error: 'invalid token' };

  const service = createClient(supaUrl, serviceKey);
  const { data: member, error: memErr } = await service
    .from('members')
    .select('id, auth_user_id, role, is_aufgieser, approved')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle();
  if (memErr || !member) return { ok: false, status: 403, error: 'no member record' };
  if (!member.approved) return { ok: false, status: 403, error: 'not approved' };

  return { ok: true, member: member as AuthedMember, service };
}
