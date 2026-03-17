// Supabase Client für den Saunascanner
const https = require('https');

const SUPABASE_URL = 'https://aiwsriwgznesqiachfyb.supabase.co';
const SUPABASE_KEY = 'sb_secret_v3Mm37ZMnc7P9sKJPJIaWA_jwrtsHdY';

function supabaseRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    if (data && method !== 'GET') req.write(JSON.stringify(data));
    req.end();
  });
}

module.exports = {
  // Alle Mitglieder laden
  async getMembers() {
    const result = await supabaseRequest('GET', '/rest/v1/members?select=*&order=created_at.desc');
    return result || [];
  },

  // Mitglied nach Code suchen
  async getMemberByCode(code) {
    const result = await supabaseRequest('GET', `/rest/v1/members?code=eq.${encodeURIComponent(code)}&select=*`);
    return (Array.isArray(result) && result.length > 0) ? result[0] : null;
  },

  // Neues Mitglied anlegen
  async createMember(memberData) {
    const result = await supabaseRequest('POST', '/rest/v1/members', memberData);
    return result;
  },

  // Mitglied aktualisieren
  async updateMember(code, updates) {
    const result = await supabaseRequest('PATCH', `/rest/v1/members?code=eq.${encodeURIComponent(code)}`, updates);
    return result;
  },

  // Scan-Event loggen
  async logScan(scanData) {
    const result = await supabaseRequest('POST', '/rest/v1/scan_events', scanData);
    return result;
  }
};
