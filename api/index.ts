import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || "https://uuxjuqvpfjwqqbtcxoku.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1eGp1cXZwZmp3cXFidGN4b2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxMjEwOSwiZXhwIjoyMDg4NTg8MTA5fQ.L3FeqbqvoM3DZQ3DNRlyEGEyBjeso8plm_mWcbg59KU";

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Supabase credentials missing');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Types
interface Member {
  code: string;
  member_number: string;
  name: string;
  status: string;
  present: boolean;
  visits_30_days: number;
  visits_365_days: number;
  visits_total: number;
  warning: string;
  auto_checkout_info: boolean;
  is_admin: boolean;
  is_family: boolean;
  qualifications: string[];
  feedback_questions: any[];
  feedback_answers?: Record<string, any>;
  last_checkin?: number | null;
  [key: string]: any;
}

interface ScanBody {
  ausweis_nr?: string;
  aktion?: 'einlass' | 'auslass';
  family_count?: number;
  name?: string;
  memberName?: string;
}

interface ConfigBody {
  apiUrl?: string;
  deviceName?: string;
  soundEnabled?: boolean;
  feedbackQuestions?: any[];
}

interface DailyCodeBody {
  type: 'member' | 'guest';
  ref: string;
  validFrom?: string;
  validUntil?: string;
}

// Helper: Supabase request with error handling
async function supabaseRequest<T>(
  fn: () => Promise<{ data: T | null; error: any }>
): Promise<T | null> {
  try {
    const { data, error } = await fn();
    if (error) {
      console.error('Supabase error:', error);
      return null;
    }
    return data;
  } catch (err) {
    console.error('Request error:', err);
    return null;
  }
}

// Helper: Generate unique code
function generateCode(prefix: string = 'FDS-', length: number = 3): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${prefix}${code}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, url, body } = req;
  const path = url?.split('?')[0] || '';

  try {
    // ─────────────────────────────────────────────────────────────
    // SCAN - Einlass/Auslass
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/scan' && method === 'POST') {
      const { ausweis_nr, family_count } = (body || {}) as ScanBody;
      const code = ausweis_nr?.toUpperCase();

      if (!code) {
        return res.status(400).json({ error: 'Ausweis-Nummer erforderlich' });
      }

      // Member finden
      const member = await supabaseRequest<Member[]>(async () => {
        return supabase
          .from('mitglieder')
          .select('*')
          .eq('code', code)
          .single();
      });

      if (!member) {
        // Unbekannter Code -> Gast
        return res.json({
          ok: true,
          name: 'Gast / Unbekannt',
          member_number: code,
          status: 'aktiv',
          present: false,
          visits_30_days: 0,
          visits_365_days: 0,
          visits_total: 0,
          warning: 'Mitglied nicht gefunden.',
          is_admin: false,
          is_family: false,
          qualifications: [],
          feedback_questions: []
        });
      }

      // Familien-Check
      if (member.is_family && family_count === undefined && !member.present) {
        return res.json({ needs_family_count: true, ...member });
      }

      const updates: Partial<Member> = {
        updated_at: new Date().toISOString()
      };

      if (member.present) {
        // CHECKOUT
        const durationMs = Date.now() - (member.last_checkin || Date.now());
        const durationHours = Math.round((durationMs / (1000 * 60 * 60)) * 10) / 10;

        updates.present = false;
        updates.last_checkin = null;

        const updated = await supabaseRequest<Member[]>(async () => {
          return supabase
            .from('mitglieder')
            .update(updates)
            .eq('code', code)
            .select()
            .single();
        });

        // Scan event loggen (optional)
        await supabaseRequest(async () => {
          return supabase.from('scan_events').insert({
            code: member.code,
            action: 'checkout',
            duration_hours: durationHours,
            timestamp: new Date().toISOString()
          });
        });

        const result = updated || member;
        return res.json({
          ok: true,
          ...result,
          present: false,
          last_checkin: null,
          checkout_message: `Gute Heimfahrt! Heute warst du ${durationHours}h da, bis bald.`,
          feedback_questions: member.feedback_questions || []
        });
      } else {
        // CHECKIN
        updates.present = true;
        updates.last_checkin = Date.now();
        updates.visits_total = (member.visits_total || 0) + 1;
        updates.visits_30_days = (member.visits_30_days || 0) + 1;
        updates.visits_365_days = (member.visits_365_days || 0) + 1;

        if (family_count !== undefined) {
          updates.last_family_count = family_count;
        }

        const updated = await supabaseRequest<Member[]>(async () => {
          return supabase
            .from('mitglieder')
            .update(updates)
            .eq('code', code)
            .select()
            .single();
        });

        // Scan event loggen (optional)
        await supabaseRequest(async () => {
          return supabase.from('scan_events').insert({
            code: member.code,
            action: 'checkin',
            family_count,
            timestamp: new Date().toISOString()
          });
        });

        const result = updated || member;
        return res.json({
          ok: true,
          ...result,
          feedback_questions: member.feedback_questions || []
        });
      }
    }

    // ─────────────────────────────────────────────────────────────
    // CONFIG - Geräte-Einstellungen
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/config' && method === 'GET') {
      const { data } = await supabase
        .from('memory')
        .select('value')
        .eq('key', 'scanner_config')
        .single();

      const config = data?.value || {
        deviceName: 'Scanner 1',
        soundEnabled: true,
        feedbackQuestions: []
      };

      return res.json(config);
    }

    if (path === '/api/config' && method === 'POST') {
      const { apiUrl, deviceName, soundEnabled, feedbackQuestions } = (body || {}) as ConfigBody;

      const { data: existing } = await supabase
        .from('memory')
        .select('value')
        .eq('key', 'scanner_config')
        .single();

      let config = existing?.value || {};
      if (apiUrl !== undefined) config.apiUrl = apiUrl;
      if (deviceName !== undefined) config.deviceName = deviceName;
      if (soundEnabled !== undefined) config.soundEnabled = soundEnabled;
      if (feedbackQuestions !== undefined) config.feedbackQuestions = feedbackQuestions;

      await supabase
        .from('memory')
        .upsert({ key: 'scanner_config', value: config }, { onConflict: 'key' });

      return res.json({ success: true });
    }

    // ─────────────────────────────────────────────────────────────
    // MEMBERS - Alle Mitglieder
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/members' && method === 'GET') {
      const { data: members } = await supabase
        .from('mitglieder')
        .select('*')
        .order('name');

      return res.json(
        members?.map((m: any) => ({
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
          feedback_questions: m.feedback_questions
        })) || []
      );
    }

    // ─────────────────────────────────────────────────────────────
    // MEMBERS CREATE - Neues Mitglied
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/members/create' && method === 'POST') {
      const { code, name, memberName, qualifications, is_admin, is_family } = (body || {}) as any;

      // Generate unique code if not provided
      let memberCode = code;
      if (!memberCode) {
        // Get existing codes to avoid duplicates
        const { data: existing } = await supabase
          .from('mitglieder')
          .select('code')
          .like('code', 'FDS-%');

        const existingCodes = existing?.map((m: any) => m.code) || [];
        let newCode;
        let attempts = 0;
        do {
          newCode = generateCode('FDS-', 3);
          attempts++;
        } while (existingCodes.includes(newCode) && attempts < 10);

        memberCode = newCode || generateCode('FDS-', 3);
      }

      const memberNameFinal = (name && name.trim()) || (memberName && memberName.trim()) || 'Neues Mitglied';

      const { data, error } = await supabase
        .from('mitglieder')
        .insert({
          code: memberCode,
          member_number: memberCode,
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
        })
        .select()
        .single();

      if (error) {
        return res.status(400).json({ error: error.message });
      }

      return res.json({ success: true, member: data, code: memberCode });
    }

    // ─────────────────────────────────────────────────────────────
    // MEMBERS UPDATE - Mitglied bearbeiten
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/members/update' && method === 'POST') {
      const { code, name, memberName, qualifications, is_admin, is_family } = (body || {}) as any;

      if (!code) {
        return res.status(400).json({ error: 'Code erforderlich' });
      }

      const { data: existing } = await supabase
        .from('mitglieder')
        .select('*')
        .eq('code', code)
        .single();

      if (!existing) {
        return res.status(404).json({ error: 'Mitglied nicht gefunden' });
      }

      const updates: any = { updated_at: new Date().toISOString() };
      if (name) updates.name = name.trim();
      if (memberName) updates.name = memberName.trim();
      if (qualifications) updates.qualifications = qualifications;
      if (is_admin !== undefined) updates.is_admin = is_admin;
      if (is_family !== undefined) updates.is_family = is_family;

      const { data: updated, error: updateError } = await supabase
        .from('mitglieder')
        .update(updates)
        .eq('code', code)
        .select()
        .single();

      if (updateError) {
        console.error('Update error:', updateError);
        return res.status(500).json({ error: updateError.message });
      }

      return res.json({ success: true, member: updated });
    }

    // ─────────────────────────────────────────────────────────────
    // MEMBERS FEEDBACK
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/members/feedback' && method === 'POST') {
      const { code, answers } = (body || {}) as any;

      if (!code) {
        return res.status(400).json({ error: 'Code erforderlich' });
      }

      const { data: member } = await supabase
        .from('mitglieder')
        .select('feedback_answers')
        .eq('code', code)
        .single();

      if (member) {
        const updatedAnswers = {
          ...(member.feedback_answers || {}),
          ...answers
        };

        await supabase
          .from('mitglieder')
          .update({ feedback_answers: updatedAnswers })
          .eq('code', code);
      }

      return res.json({ success: true });
    }

    // ─────────────────────────────────────────────────────────────
    // DAILY CODES GENERATE
    // ─────────────────────────────────────────────────────────────
    if (path === '/api/daily-codes/generate' && method === 'POST') {
      const { type, ref, validFrom, validUntil } = (body || {}) as DailyCodeBody;

      if (!type || !ref) {
        return res.status(400).json({ error: 'Type und Ref erforderlich' });
      }

      const code = type === 'guest'
        ? `GAST-${Date.now().toString(36).toUpperCase()}`
        : `TAGES-${Date.now().toString(36).toUpperCase()}`;

      const now = Date.now();
      const until = validUntil ? new Date(validUntil).getTime() : now + 24 * 60 * 60 * 1000;

      const dailyCode = {
        code,
        type,
        ref,
        validFrom: validFrom ? new Date(validFrom).getTime() : now,
        validUntil: until,
        expiresAt: until,
        createdAt: now
      };

      await supabase
        .from('memory')
        .upsert({ key: 'scanner_daily_codes', value: { [code]: dailyCode } }, { onConflict: 'key' });

      return res.json(dailyCode);
    }

    // ─────────────────────────────────────────────────────────────
    // NOT FOUND
    // ─────────────────────────────────────────────────────────────
    return res.status(404).json({ error: 'Not found' });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
