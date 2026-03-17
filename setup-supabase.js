#!/usr/bin/env node
// Supabase Tables anlegen für Saunascanner

const https = require('https');

const SUPABASE_URL = 'https://aiwsriwgznesqiachfyb.supabase.co';
const SUPABASE_KEY = 'sb_secret_v3Mm37ZMnc7P9sKJPJIaWA_jwrtsHdY';

const sql = `
-- Members Tabelle für Saunascanner
CREATE TABLE IF NOT EXISTS public.members (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  member_number VARCHAR(50),
  name VARCHAR(255),
  status VARCHAR(50) DEFAULT 'aktiv',
  present BOOLEAN DEFAULT FALSE,
  visits_30_days INTEGER DEFAULT 0,
  visits_365_days INTEGER DEFAULT 0,
  visits_total INTEGER DEFAULT 0,
  warning TEXT,
  auto_checkout_info BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  is_family BOOLEAN DEFAULT FALSE,
  qualifications JSONB DEFAULT '[]',
  feedback_questions JSONB DEFAULT '[]',
  feedback_answers JSONB DEFAULT '{}',
  last_checkin TIMESTAMP,
  last_family_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Scan Events Log
CREATE TABLE IF NOT EXISTS public.scan_events (
  id BIGSERIAL PRIMARY KEY,
  code VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  duration_hours NUMERIC,
  family_count INTEGER,
  timestamp TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index für schnelle Code-Suchen
CREATE INDEX IF NOT EXISTS idx_members_code ON public.members(code);
CREATE INDEX IF NOT EXISTS idx_scan_events_code ON public.scan_events(code);
`;

// Supabase PostgreSQL Runtime Query API
function runQuery(sql) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'aiwsriwgznesqiachfyb.supabase.co',
      port: 443,
      path: '/rest/v1/rpc/run_sql_query',
      method: 'POST',
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
        if (res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 204) {
          resolve({ ok: true, status: res.statusCode });
        } else {
          try {
            const error = JSON.parse(body);
            reject(error);
          } catch {
            reject(new Error(body));
          }
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify({ query: sql }));
    req.end();
  });
}

async function main() {
  console.log('🔧 Lege Supabase Tabellen an...\n');
  
  try {
    // Try the RPC method first
    await runQuery(sql);
    console.log('✅ Tabellen erfolgreich angelegt!');
  } catch (err) {
    console.log('⚠️ RPC method nicht verfügbar, versuche alternativen Weg...\n');
    
    // Fall back to just reporting that manual setup is needed
    console.log('❌ Automatisches Anlegen nicht möglich.');
    console.log('\nManuelle Schritte erforderlich:');
    console.log('1. Öffne: https://supabase.com/dashboard/project/aiwsriwgznesqiachfyb');
    console.log('2. Geh zu SQL Editor');
    console.log('3. Führe das SQL-Skript aus: /data/.openclaw/workspace/Saunascaner/create-tables.sql');
    console.log('\nOder warte... ich versuche noch einen direkten POST Weg.\n');
    
    // Alternative: Use the migrations endpoint or just output the SQL
    console.log('SQL zum manuellen Einfügen:');
    console.log('='.repeat(60));
    console.log(sql);
    console.log('='.repeat(60));
  }
}

main();
