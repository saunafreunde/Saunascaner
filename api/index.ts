import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL || "https://uuxjuqvpfjwqqbtcxoku.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV1eGp1cXZwZmp3cXFidGN4b2t1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzAxMjEwOSwiZXhwIjoyMDg4NTg4MTA5fQ.L3FeqbqvoM3DZQ3DNRlyEGEyBjeso8plm_mWcbg59KU";
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, url } = req;
  const path = url?.split('?')[0] || '';

  // SCAN - Einlass/Auslass
  if (path === '/api/scan' && method === 'POST') {
    try {
      const { ausweis_nr, aktion, family_count } = req.body || {};

      // Member finden oder anlegen
      let { data: member } = await supabase
        .from('mitglieder')
        .select('*')
        .eq('code', ausweis_nr)
        .single();

      if (!member) {
        const num = Math.floor(Math.random() * 900) + 100;
        const { name, memberName } = req.body || {};
        const newMember = {
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
        };
        const { data } = await supabase
          .from('mitglieder')
          .insert(newMember)
          .select()
          .single();
        member = data;
      }

      // Familien-Check
      if (member.is_family && !family_count && aktion === 'einlass') {
        res.json({ needs_family_count: true });
        return;
      }

      // Besuche aktualisieren
      const updates: any = { updated_at: new Date().toISOString() };
      if (aktion === 'einlass') {
        updates.present = true;
        updates.visits_30_days = (member.visits_30_days || 0) + 1;
        updates.visits_365_days = (member.visits_365_days || 0) + 1;
        updates.visits_total = (member.visits_total || 0) + 1;
      } else if (aktion === 'auslass') {
        updates.present = false;
      }

      await supabase
        .from('mitglieder')
        .update(updates)
        .eq('code', ausweis_nr);

      res.json({
        member_number: member.member_number,
        name: member.name,
        status: member.status,
        present: updates.present,
        visits_30_days: updates.visits_30_days,
        visits_365_days: updates.visits_365_days,
        visits_total: updates.visits_total,
        warning: member.warning,
        auto_checkout_info: member.auto_checkout_info,
        is_admin: member.is_admin,
        is_family: member.is_family,
        qualifications: member.qualifications,
        feedback_questions: member.feedback_questions || [],
        checkoutMessage: !updates.present ? `Tschüss, ${member.name}!` : null
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Scan failed' });
    }
    return;
  }

  // CONFIG - Geräte-Einstellungen (weiterhin in memory)
  if (path === '/api/config' && method === 'GET') {
    const { data } = await supabase
      .from('memory')
      .select('value')
      .eq('key', 'scanner_config')
      .single();
    const config = data?.value || { deviceName: 'Scanner 1', soundEnabled: true, feedbackQuestions: [] };
    res.json(config);
    return;
  }

  if (path === '/api/config' && method === 'POST') {
    const { apiUrl, deviceName, soundEnabled, feedbackQuestions } = req.body || {};
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
    res.json({ success: true });
    return;
  }

  // MEMBERS - Alle Mitglieder
  if (path === '/api/members' && method === 'GET') {
    const { data: members } = await supabase
      .from('mitglieder')
      .select('*')
      .order('name');
    res.json(members?.map((m: any) => ({
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
    })) || []);
    return;
  }

  // MEMBERS CREATE - Neues Mitglied
  if (path === '/api/members/create' && method === 'POST') {
    const { code, name, memberName, qualifications, is_admin, is_family } = req.body || {};
    const num = Math.floor(Math.random() * 900) + 100;
    const memberNameFinal = (name && name.trim()) || (memberName && memberName.trim()) || 'Neues Mitglied';
    const { data, error } = await supabase
      .from('mitglieder')
      .insert({
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
      })
      .select()
      .single();
    if (error) {
      res.status(400).json({ error: error.message });
    } else {
      res.json({ success: true, member: data });
    }
    return;
  }

  // MEMBERS UPDATE - Mitglied bearbeiten
  if (path === '/api/members/update' && method === 'POST') {
    const { code, name, qualifications, is_admin, is_family, memberName } = req.body || {};
    const { data: existing } = await supabase
      .from('mitglieder')
      .select('*')
      .eq('code', code)
      .single();

    if (!existing) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (name) updates.name = name.trim();
    if (memberName) updates.name = memberName.trim();
    if (qualifications) updates.qualifications = qualifications;
    if (is_admin !== undefined) updates.is_admin = is_admin;
    if (is_family !== undefined) updates.is_family = is_family;

    // Update und aktualisierte Daten zurückgeben
    const { data: updated, error: updateError } = await supabase
      .from('mitglieder')
      .update(updates)
      .eq('code', code)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      res.status(500).json({ error: updateError.message });
      return;
    }

    res.json({ success: true, member: updated });
    return;
  }

  // MEMBERS FEEDBACK
  if (path === '/api/members/feedback' && method === 'POST') {
    const { code, feedback } = req.body || {};
    // Feedback speichern (könnte später erweitert werden)
    res.json({ success: true });
    return;
  }

  // DAILY CODES (weiterhin in memory)
  if (path === '/api/daily-codes/generate' && method === 'POST') {
    const { type, ref, validFrom, validUntil } = req.body || {};
    const { data: existing } = await supabase
      .from('memory')
      .select('value')
      .eq('key', 'scanner_daily_codes')
      .single();
    let dailyCodes = existing?.value || {};
    const code = type === 'guest' ? `GAST-${Date.now().toString(36).toUpperCase()}` : `TAGES-${Date.now().toString(36).toUpperCase()}`;
    const now = Date.now();
    const until = validUntil ? new Date(validUntil).getTime() : now + 24 * 60 * 60 * 1000;
    dailyCodes[code] = { code, type, ref, validFrom, validUntil: until, expiresAt: until, createdAt: now };
    await supabase
      .from('memory')
      .upsert({ key: 'scanner_daily_codes', value: dailyCodes }, { onConflict: 'key' });
    res.json(dailyCodes[code]);
    return;
  }

  res.status(404).json({ error: 'Not found' });
}
