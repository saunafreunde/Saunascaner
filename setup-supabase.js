#!/usr/bin/env node
/**
 * Supabase Setup Script für Saunascaner
 * 
 * Erstellt alle benötigten Tabellen, Indexes und Initialdaten.
 * 
 * Nutzung:
 *   node setup-supabase.js
 * 
 * Umgebungsvariablen (aus .env.local oder .env):
 *   SUPABASE_URL - Deine Supabase Projekt URL
 *   SUPABASE_SERVICE_ROLE - Dein Service Role Key
 */

const https = require('https');

// ─────────────────────────────────────────────────────────────
// Konfiguration laden
// ─────────────────────────────────────────────────────────────
function loadEnv() {
  const fs = require('fs');
  const path = require('path');
  
  const envPath = path.join(process.cwd(), '.env.local');
  const envExample = path.join(process.cwd(), '.env.example');
  
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  } else if (fs.existsSync(envExample)) {
    console.log('⚠️  .env.local nicht gefunden, verwende .env.example');
    envContent = fs.readFileSync(envExample, 'utf-8');
  } else {
    console.error('❌ Weder .env.local noch .env.example gefunden!');
    process.exit(1);
  }
  
  const env = {};
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
  
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE) {
    console.error('❌ SUPABASE_URL und SUPABASE_SERVICE_ROLE müssen in .env.local gesetzt sein!');
    process.exit(1);
  }
  
  return env;
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE } = loadEnv();

// ─────────────────────────────────────────────────────────────
// Supabase Client (einfache HTTPS Implementation)
// ─────────────────────────────────────────────────────────────
function supabaseRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, SUPABASE_URL);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'apikey': SUPABASE_SERVICE_ROLE,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ data: parsed, status: res.statusCode });
        } catch {
          resolve({ data: body, status: res.statusCode });
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Request failed: ${err.message}`));
    });

    if (data && method !== 'GET') {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────
// SQL ausführen (über REST API)
// ─────────────────────────────────────────────────────────────
async function executeSql(sql) {
  // Supabase SQL Endpoint über REST
  const result = await supabaseRequest('POST', '/rest/v1/', {
    query: sql
  });
  return result;
}

// ─────────────────────────────────────────────────────────────
// Tabellen erstellen
// ─────────────────────────────────────────────────────────────
async function createTables() {
  console.log('\n📋 Erstelle Tabellen...');

  // 1. Mitglieder Tabelle
  console.log('  → mitglieder');
  let result = await supabaseRequest('POST', '/rest/v1/', {
    query: `
      CREATE TABLE IF NOT EXISTS mitglieder (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        member_number VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'aktiv',
        present BOOLEAN DEFAULT false,
        visits_30_days INTEGER DEFAULT 0,
        visits_365_days INTEGER DEFAULT 0,
        visits_total INTEGER DEFAULT 0,
        warning TEXT,
        auto_checkout_info BOOLEAN DEFAULT false,
        is_admin BOOLEAN DEFAULT false,
        is_family BOOLEAN DEFAULT false,
        qualifications JSONB DEFAULT '[]',
        feedback_questions JSONB DEFAULT '[]',
        feedback_answers JSONB DEFAULT '{}',
        last_checkin BIGINT,
        last_family_count INTEGER,
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW)::BIGINT,
        updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW)::BIGINT
      );
    `
  });
  
  if (result.status >= 400) {
    console.log('    ⚠️  Tabelle existiert eventuell bereits oder Fehler:', JSON.stringify(result.data));
  } else {
    console.log('    ✅ Tabelle erstellt');
  }

  // 2. Memory Tabelle (für Configs)
  console.log('  → memory');
  result = await supabaseRequest('POST', '/rest/v1/', {
    query: `
      CREATE TABLE IF NOT EXISTS memory (
        id SERIAL PRIMARY KEY,
        key VARCHAR(100) UNIQUE NOT NULL,
        value JSONB NOT NULL,
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW)::BIGINT,
        updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW)::BIGINT
      );
    `
  });
  
  if (result.status >= 400) {
    console.log('    ⚠️  Tabelle existiert eventuell bereits');
  } else {
    console.log('    ✅ Tabelle erstellt');
  }

  // 3. Scan Events Tabelle (optional, für Logs)
  console.log('  → scan_events');
  result = await supabaseRequest('POST', '/rest/v1/', {
    query: `
      CREATE TABLE IF NOT EXISTS scan_events (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) NOT NULL,
        action VARCHAR(20) NOT NULL,
        duration_hours DECIMAL(5,2),
        family_count INTEGER,
        timestamp BIGINT DEFAULT EXTRACT(EPOCH FROM NOW)::BIGINT,
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW)::BIGINT
      );
    `
  });
  
  if (result.status >= 400) {
    console.log('    ⚠️  Tabelle existiert eventuell bereits');
  } else {
    console.log('    ✅ Tabelle erstellt');
  }

  // 4. Daily Codes Tabelle
  console.log('  → daily_codes');
  result = await supabaseRequest('POST', '/rest/v1/', {
    query: `
      CREATE TABLE IF NOT EXISTS daily_codes (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        type VARCHAR(20) NOT NULL,
        ref VARCHAR(255),
        valid_from BIGINT,
        valid_until BIGINT,
        expires_at BIGINT,
        created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW)::BIGINT
      );
    `
  });
  
  if (result.status >= 400) {
    console.log('    ⚠️  Tabelle existiert eventuell bereits');
  } else {
    console.log('    ✅ Tabelle erstellt');
  }
}

// ─────────────────────────────────────────────────────────────
// Indexes erstellen
// ─────────────────────────────────────────────────────────────
async function createIndexes() {
  console.log('\n📑 Erstelle Indexes...');

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_mitglieder_code ON mitglieder(code);',
    'CREATE INDEX IF NOT EXISTS idx_mitglieder_present ON mitglieder(present);',
    'CREATE INDEX IF NOT EXISTS idx_mitglieder_status ON mitglieder(status);',
    'CREATE INDEX IF NOT EXISTS idx_memory_key ON memory(key);',
    'CREATE INDEX IF NOT EXISTS idx_scan_events_code ON scan_events(code);',
    'CREATE INDEX IF NOT EXISTS idx_scan_events_timestamp ON scan_events(timestamp);',
    'CREATE INDEX IF NOT EXISTS idx_daily_codes_code ON daily_codes(code);',
    'CREATE INDEX IF NOT EXISTS idx_daily_codes_expires ON daily_codes(expires_at);'
  ];

  for (const sql of indexes) {
    const tableName = sql.match(/idx_\w+/)?.[0] || 'unknown';
    console.log(`  → ${tableName}`);
    const result = await supabaseRequest('POST', '/rest/v1/', { query: sql });
    if (result.status < 400) {
      console.log('    ✅ Index erstellt');
    } else {
      console.log('    ⚠️  Index existiert eventuell bereits');
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Initialdaten
// ─────────────────────────────────────────────────────────────
async function seedData() {
  console.log('\n🌱 Seed Daten...');

  // Scanner Config
  console.log('  → Scanner Config');
  const scannerConfig = {
    deviceName: 'Scanner 1',
    soundEnabled: true,
    apiUrl: '',
    feedbackQuestions: [
      { id: 'q1', text: 'Neues Wedeltuch (15€) – möchtest du eins?', type: 'yes_no' },
      { id: 'q2', text: 'Sauna-Fest 2026', type: 'event' }
    ]
  };

  let result = await supabaseRequest('POST', '/rest/v1/memory', {
    key: 'scanner_config',
    value: scannerConfig
  });

  if (result.status === 201 || result.status === 200) {
    console.log('    ✅ Config gespeichert');
  } else if (result.status === 409) {
    console.log('    ⚠️  Config existiert bereits');
  } else {
    console.log('    ⚠️  Status:', result.status);
  }

  // Beispielmitglied (optional)
  console.log('  → Beispielmitglied (optional)');
  const testMember = {
    code: 'FDS-001',
    member_number: 'FDS-001',
    name: 'Max Mustermann',
    status: 'aktiv',
    present: false,
    visits_30_days: 5,
    visits_365_days: 42,
    visits_total: 128,
    is_admin: false,
    is_family: true,
    qualifications: ['Einlass', 'Kasse'],
    feedback_questions: []
  };

  result = await supabaseRequest('POST', '/rest/v1/mitglieder', testMember);
  
  if (result.status === 201) {
    console.log('    ✅ Beispielmitglied erstellt');
  } else if (result.status === 409) {
    console.log('    ⚠️  Beispielmitglied existiert bereits');
  } else {
    console.log('    ⚠️  Status:', result.status, JSON.stringify(result.data));
  }
}

// ─────────────────────────────────────────────────────────────
// Health Check
// ─────────────────────────────────────────────────────────────
async function healthCheck() {
  console.log('\n❤ Gesundheit prüfen...');
  
  const result = await supabaseRequest('GET', '/rest/v1/mitglieder?limit=1');
  
  if (result.status < 400) {
    console.log('  ✅ Supabase Verbindung OK');
    console.log(`  📊 Mitglieder gefunden: ${Array.isArray(result.data) ? result.data.length : 'n/a'}`);
    return true;
  } else {
    console.log('  ❌ Supabase Verbindung fehlgeschlagen');
    console.log('  Status:', result.status);
    console.log('  Antwort:', JSON.stringify(result.data));
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Saunascaner Supabase Setup');
  console.log('==============================');
  console.log(`URL: ${SUPABASE_URL}`);
  
  try {
    // 1. Health Check
    const healthy = await healthCheck();
    if (!healthy) {
      console.log('\n⚠️  Setup abgebrochen - Supabase nicht erreichbar');
      process.exit(1);
    }

    // 2. Tabellen erstellen
    await createTables();

    // 3. Indexes erstellen
    await createIndexes();

    // 4. Seed Daten
    await seedData();

    console.log('\n✅ Setup erfolgreich abgeschlossen!');
    console.log('\nNächste Schritte:');
    console.log('  1. Vercel Environment Variables setzen:');
    console.log('     - SUPABASE_URL');
    console.log('     - SUPABASE_SERVICE_ROLE');
    console.log('  2. App neu deployen');
    console.log('  3. Testen!');
    
  } catch (err) {
    console.error('\n❌ Setup fehlgeschlagen:', err.message);
    process.exit(1);
  }
}

main();
