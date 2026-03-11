import { createClient } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = "https://uuxjuqvpfjwqqbtcxoku.supabase.co";
const supabaseKey = "sb_publishable_VHW1Wv2zuhfJ9dK3vJQ33g_-TJc_ULh";
const supabase = createClient(supabaseUrl, supabaseKey);

async function getMemory(key: string): Promise<any> {
  const { data } = await supabase.from('memory').select('value').eq('key', key).single();
  return data?.value || null;
}

async function setMemory(key: string, value: any): Promise<void> {
  await supabase.from('memory').upsert({ key, value }, { onConflict: 'key' });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { method, url } = req;
  const path = url?.split('?')[0] || '';
  
  if (path === '/api/scan' && method === 'POST') {
    try {
      const { ausweis_nr, aktion, family_count } = req.body || {};
      let members = await getMemory('scanner_members') || {};
      let scannerConfig = await getMemory('scanner_config') || { feedbackQuestions: [] };
      
      let member = members[ausweis_nr];
      if (!member) {
        const num = Math.floor(Math.random() * 900) + 100;
        const { name, memberName } = req.body || {};
        member = {
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
          feedback_questions: scannerConfig.feedbackQuestions || []
        };
        members[ausweis_nr] = member;
        await setMemory('scanner_members', members);
      }

      if (member.is_family && !family_count && aktion === 'einlass') {
        res.json({ needs_family_count: true });
        return;
      }

      if (aktion === 'einlass') {
        member.present = true;
        member.visits_30_days = (member.visits_30_days || 0) + 1;
        member.visits_365_days = (member.visits_365_days || 0) + 1;
        member.visits_total = (member.visits_total || 0) + 1;
      } else if (aktion === 'auslass') {
        member.present = false;
      }

      members[ausweis_nr] = member;
      await setMemory('scanner_members', members);

      res.json({
        member_number: member.member_number, name: member.name, status: member.status,
        present: member.present, visits_30_days: member.visits_30_days,
        visits_365_days: member.visits_365_days, visits_total: member.visits_total,
        warning: member.warning, auto_checkout_info: member.auto_checkout_info,
        is_admin: member.is_admin, is_family: member.is_family,
        qualifications: member.qualifications, feedback_questions: member.feedback_questions || [],
        checkoutMessage: !member.present ? `Tschüss, ${member.name}!` : null
      });
    } catch (err) { res.status(500).json({ error: 'Scan failed' }); }
    return;
  }

  if (path === '/api/config' && method === 'GET') {
    const config = await getMemory('scanner_config');
    res.json(config || { deviceName: 'Scanner 1', soundEnabled: true, feedbackQuestions: [] });
    return;
  }

  if (path === '/api/config' && method === 'POST') {
    const { apiUrl, deviceName, soundEnabled, feedbackQuestions } = req.body || {};
    let config = await getMemory('scanner_config') || {};
    if (apiUrl !== undefined) config.apiUrl = apiUrl;
    if (deviceName !== undefined) config.deviceName = deviceName;
    if (soundEnabled !== undefined) config.soundEnabled = soundEnabled;
    if (feedbackQuestions !== undefined) config.feedbackQuestions = feedbackQuestions;
    await setMemory('scanner_config', config);
    res.json({ success: true });
    return;
  }

  if (path === '/api/members' && method === 'GET') {
    const members = await getMemory('scanner_members') || {};
    res.json(Object.values(members).map((m: any) => ({
      code: m.code, memberNumber: m.member_number, memberName: m.name,
      memberStatus: m.status, present: m.present, visits30: m.visits_30_days,
      visits365: m.visits_365_days, visitsTotal: m.visits_total, warning: m.warning,
      autoCheckoutInfo: m.auto_checkout_info, isAdmin: m.is_admin, isFamily: m.is_family,
      qualifications: m.qualifications, feedbackQuestions: m.feedback_questions
    })));
    return;
  }

  if (path === '/api/members/create' && method === 'POST') {
    const { code, name, memberName, qualifications, is_admin, is_family } = req.body || {};
    let members = await getMemory('scanner_members') || {};
    const num = Math.floor(Math.random() * 900) + 100;
    const memberNameFinal = (name && name.trim()) || (memberName && memberName.trim()) || 'Neues Mitglied';
    members[code] = { 
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
    };
    await setMemory('scanner_members', members);
    res.json({ success: true, member: members[code] });
    return;
  }

  if (path === '/api/members/update' && method === 'POST') {
    const { code, name, qualifications, is_admin, is_family, memberName } = req.body || {};
    let members = await getMemory('scanner_members') || {};
    if (members[code]) {
      members[code] = { 
        ...members[code], 
        name: (name && name.trim()) || (memberName && memberName.trim()) || members[code].name, 
        qualifications: qualifications || members[code].qualifications || [], 
        is_admin: is_admin !== undefined ? is_admin : members[code].is_admin,
        is_family: is_family !== undefined ? is_family : members[code].is_family
      };
      await setMemory('scanner_members', members);
      res.json({ success: true });
    } else { res.status(404).json({ error: 'Member not found' }); }
    return;
  }

  if (path === '/api/daily-codes/generate' && method === 'POST') {
    const { type, ref, validFrom, validUntil } = req.body || {};
    let dailyCodes = await getMemory('scanner_daily_codes') || {};
    const code = type === 'guest' ? `GAST-${Date.now().toString(36).toUpperCase()}` : `TAGES-${Date.now().toString(36).toUpperCase()}`;
    const now = Date.now();
    const until = validUntil ? new Date(validUntil).getTime() : now + 24 * 60 * 60 * 1000;
    dailyCodes[code] = { code, type, ref, validFrom, validUntil: until, expiresAt: until, createdAt: now };
    await setMemory('scanner_daily_codes', dailyCodes);
    res.json(dailyCodes[code]);
    return;
  }

  res.status(404).json({ error: 'Not found' });
}
