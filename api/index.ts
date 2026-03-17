import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Umgebungsvariablen für Sicherheit (Keine Hardcoded-Keys mehr!)
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || "";
const supabase = createClient(supabaseUrl, supabaseKey);

// --- 1. SCAN LOGIK ---
async function handleScan(req: VercelRequest, res: VercelResponse) {
  const { ausweis_nr, aktion, family_count, name, memberName } = req.body || {};

  if (!ausweis_nr) return res.status(400).json({ error: 'Ausweisnummer fehlt' });

  // Mitglied suchen
  let { data: member, error: fetchError } = await supabase
    .from('mitglieder')
    .select('*')
    .eq('code', ausweis_nr)
    .maybeSingle();

  // Neues Mitglied anlegen, falls nicht vorhanden
  if (!member && !fetchError) {
    const num = Math.floor(Math.random() * 900) + 100;
    const { data: newMember, error: createError } = await supabase
      .from('mitglieder')
      .insert({
        code: ausweis_nr,
        member_number: `FDS-${num}`,
        name: name || memberName || 'Neues Mitglied',
        status: 'aktiv',
        present: aktion === 'einlass',
        visits_30_days: 0,
        visits_365_days: 0,
        visits_total: 0,
        warning: '',
        auto_checkout_info: false,
        is_admin: false,
        is_family: false,
        qualifications: [],
        feedback_questions: []
      })
      .select()
      .single();
    
    if (createError) throw createError;
    member = newMember;
  }

  // Familien-Check
  if (member?.is_family && !family_count && aktion === 'einlass') {
    return res.json({ needs_family_count: true });
  }

  // Besuche aktualisieren (Atomic Update via RPC für Einlass)
  if (aktion === 'einlass') {
    const { error: rpcError } = await supabase.rpc('increment_member_visits', { member_code: ausweis_nr });
    if (rpcError) throw rpcError;
  } else if (aktion === 'auslass') {
    await supabase.from('mitglieder').update({ present: false, updated_at: new Date().toISOString() }).eq('code', ausweis_nr);
  }

  // Aktuelle Daten für die Response abrufen
  const { data: updatedMember } = await supabase.from('mitglieder').select('*').eq('code', ausweis_nr).single();
  
  return res.json({
    member_number: updatedMember.member_number,
    name: updatedMember.name,
    status: updatedMember.status,
    present: updatedMember.present,
    visits_30_days: updatedMember.visits_30_days,
    visits_365_days: updatedMember.visits_365_days,
    visits_total: updatedMember.visits_total,
    warning: updatedMember.warning,
    auto_checkout_info: updatedMember.auto_checkout_info,
    is_admin: updatedMember.is_admin,
    is_family: updatedMember.is_family,
    qualifications: updatedMember.qualifications,
    feedback_questions: updatedMember.feedback_questions || [],
    checkoutMessage: aktion === 'auslass' ? `Tschüss, ${updatedMember.name}!` : null
  });
}

// --- 2. CONFIG LOGIK ---
async function handleGetConfig(res: VercelResponse) {
  const { data } = await supabase.from('memory').select('value').eq('key', 'scanner_config').maybeSingle();
  const config = data?.value || { deviceName: 'Scanner 1', soundEnabled: true, feedbackQuestions: [] };
  return res.json(config);
}

async function handleUpdateConfig(req: VercelRequest, res: VercelResponse) {
  const { apiUrl, deviceName, soundEnabled, feedbackQuestions } = req.body || {};
  const { data: existing } = await supabase.from('memory').select('value').eq('key', 'scanner_config').maybeSingle();
  
  let config = existing?.value || {};
  if (apiUrl !== undefined) config.apiUrl = apiUrl;
  if (deviceName !== undefined) config.deviceName = deviceName;
  if (soundEnabled !== undefined) config.soundEnabled = soundEnabled;
  if (feedbackQuestions !== undefined) config.feedbackQuestions = feedbackQuestions;
  
  await supabase.from('memory').upsert({ key: 'scanner_config', value: config }, { onConflict: 'key' });
  return res.json({ success: true });
}

// --- 3. MEMBERS LOGIK ---
async function handleGetMembers(res: VercelResponse) {
  const { data, error } = await supabase.from('mitglieder').select('*').order('name');
  if (error) throw error;
  
  return res.json((data || []).map((m: any) => ({
    code: m.code,
    memberNumber: m.member_number,
    memberName: m.name,
    memberStatus: m.status,
    present: m.present,
    visits30: m.visits_30_days,
    visits365: m.visits_365_days,
    visitsTotal: m.visits_total,
    warning: m.warning,
    autoCheckoutInfo: m.auto_checkout_info,
    isAdmin: m.is_admin,
    isFamily: m.is_family,
    qualifications: m.qualifications,
    feedbackQuestions: m.feedback_questions
  })));
}

async function handleCreateMember(req: VercelRequest, res: VercelResponse) {
  const { code, name, memberName, qualifications, is_admin, is_family } = req.body || {};
  const num = Math.floor(Math.random() * 900) + 100;
  const memberNameFinal = (name && name.trim()) || (memberName && memberName.trim()) || 'Neues Mitglied';
  
  const { data, error } = await supabase.from('mitglieder').insert({
    code,
    member_number: `FDS-${num}`,
    name: memberNameFinal,
    status: 'aktiv',
    present: false,
    visits_30_days: 0,
    visits_365_days: 0,
    visits_total: 0,
    warning: '',
    auto_checkout_info: false,
    is_admin: is_admin || false,
    is_family: is_family || false,
    qualifications: qualifications || [],
    feedback_questions: []
  }).select().single();

  if (error) throw error;
  return res.json({ success: true, member: data });
}

async function handleUpdateMember(req: VercelRequest, res: VercelResponse) {
  const { code, name, qualifications, is_admin, is_family, memberName } = req.body || {};
  const updates: any = { updated_at: new Date().toISOString() };
  
  if (name) updates.name = name.trim();
  if (memberName) updates.name = memberName.trim();
  if (qualifications) updates.qualifications = qualifications;
  if (is_admin !== undefined) updates.is_admin = is_admin;
  if (is_family !== undefined) updates.is_family = is_family;

  const { data, error } = await supabase.from('mitglieder').update(updates).eq('code', code).select().single();
  if (error) throw error;
  return res.json({ success: true, member: data });
}

// --- 4. DAILY CODES LOGIK ---
async function handleGenerateDailyCode(req: VercelRequest, res: VercelResponse) {
  const { type, ref, validFrom, validUntil } = req.body || {};
  const { data: existing } = await supabase.from('memory').select('value').eq('key', 'scanner_daily_codes').maybeSingle();
  
  let dailyCodes = existing?.value || {};
  const code = type === 'guest' ? `GAST-${Date.now().toString(36).toUpperCase()}` : `TAGES-${Date.now().toString(36).toUpperCase()}`;
  const now = Date.now();
  const until = validUntil ? new Date(validUntil).getTime() : now + 24 * 60 * 60 * 1000;
  
  dailyCodes[code] = { code, type, ref, validFrom, validUntil: until, expiresAt: until, createdAt: now };
  await supabase.from('memory').upsert({ key: 'scanner_daily_codes', value: dailyCodes }, { onConflict: 'key' });
  
  return res.json(dailyCodes[code]);
}

// --- MAIN ROUTER ---
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS Headers (optional, falls Frontend auf anderer Domain läuft)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { method, url } = req;
  const path = url?.split('?')[0] || '';

  // Fehlende Umgebungsvariablen prüfen
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE) {
    return res.status(500).json({ error: 'Server Konfiguration fehlerhaft (Env Vars fehlen)' });
  }

  try {
    switch (`${method} ${path}`) {
      case 'POST /api/scan': return await handleScan(req, res);
      case 'GET /api/config': return await handleGetConfig(res);
      case 'POST /api/config': return await handleUpdateConfig(req, res);
      case 'GET /api/members': return await handleGetMembers(res);
      case 'POST /api/members/create': return await handleCreateMember(req, res);
      case 'POST /api/members/update': return await handleUpdateMember(req, res);
      case 'POST /api/members/feedback': return res.json({ success: true });
      case 'POST /api/daily-codes/generate': return await handleGenerateDailyCode(req, res);
      default: return res.status(404).json({ error: 'Route not found' });
    }
  } catch (err: any) {
    console.error(`API Error on ${method} ${path}:`, err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
