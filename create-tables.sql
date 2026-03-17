-- Saunascaner Datenbank Schema
-- Supabase PostgreSQL
-- Stand: 2026-03-17

-- Hinweis: Dieses Skript kann im Supabase SQL Editor ausgeführt werden.
-- Alternativ: node setup-supabase.js für automatisches Setup

-- ─────────────────────────────────────────────────────────────
-- Mitglieder Tabelle
-- Speichert alle Vereinsmitglieder mit Scan-Statistiken
-- ─────────────────────────────────────────────────────────────
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
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Indexes für Mitglieder
CREATE INDEX IF NOT EXISTS idx_mitglieder_code ON mitglieder(code);
CREATE INDEX IF NOT EXISTS idx_mitglieder_present ON mitglieder(present);
CREATE INDEX IF NOT EXISTS idx_mitglieder_status ON mitglieder(status);
CREATE INDEX IF NOT EXISTS idx_mitglieder_member_number ON mitglieder(member_number);

-- ─────────────────────────────────────────────────────────────
-- Memory Tabelle
-- Key-Value Store für Scanner-Konfigurationen und temporäre Daten
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS memory (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  updated_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Index für schnellen Key-Zugriff
CREATE INDEX IF NOT EXISTS idx_memory_key ON memory(key);

-- ─────────────────────────────────────────────────────────────
-- Scan Events Tabelle
-- Protokolliert alle Scan-Vorgänge für Statistiken und Audit
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scan_events (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL,
  action VARCHAR(20) NOT NULL CHECK (action IN ('checkin', 'checkout')),
  duration_hours DECIMAL(5,2),
  family_count INTEGER,
  timestamp BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Indexes für Scan Events
CREATE INDEX IF NOT EXISTS idx_scan_events_code ON scan_events(code);
CREATE INDEX IF NOT EXISTS idx_scan_events_timestamp ON scan_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_scan_events_action ON scan_events(action);

-- ─────────────────────────────────────────────────────────────
-- Daily Codes Tabelle
-- Temporäre Zugangscodes für Tagesgäste und spezielle Events
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS daily_codes (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('member', 'guest', 'event')),
  ref VARCHAR(255),
  valid_from BIGINT,
  valid_until BIGINT,
  expires_at BIGINT,
  created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Indexes für Daily Codes
CREATE INDEX IF NOT EXISTS idx_daily_codes_code ON daily_codes(code);
CREATE INDEX IF NOT EXISTS idx_daily_codes_expires ON daily_codes(expires_at);
CREATE INDEX IF NOT EXISTS idx_daily_codes_type ON daily_codes(type);

-- ─────────────────────────────────────────────────────────────
-- Initiale Daten
-- ─────────────────────────────────────────────────────────────

-- Scanner Standard-Konfiguration
INSERT INTO memory (key, value)
VALUES ('scanner_config', '{
  "deviceName": "Scanner 1",
  "soundEnabled": true,
  "apiUrl": "",
  "feedbackQuestions": [
    {"id": "q1", "text": "Neues Wedeltuch (15€) – möchtest du eins?", "type": "yes_no"},
    {"id": "q2", "text": "Sauna-Fest 2026", "type": "event"}
  ]
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Beispielmitglied (kann gelöscht werden)
INSERT INTO mitglieder (code, member_number, name, status, present, visits_30_days, visits_365_days, visits_total, is_admin, is_family, qualifications)
VALUES ('FDS-001', 'FDS-001', 'Max Mustermann', 'aktiv', false, 5, 42, 128, false, true, '["Einlass", "Kasse"]'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- Row Level Security (RLS) deaktivieren für Service Role
-- ─────────────────────────────────────────────────────────────
-- Hinweis: Mit dem Service Role Key sind alle Tabellen voll zugreifbar.
-- Für Production mit Anon-Key sollten RLS Policies eingerichtet werden.

-- Beispiel für RLS (optional, nur bei Anon-Key Zugriff benötigt):
-- ALTER TABLE mitglieder ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Service role can do anything" ON mitglieder
--   FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- Nützliche Views für Statistiken
-- ─────────────────────────────────────────────────────────────

-- Aktive Mitglieder heute
CREATE OR REPLACE VIEW mitglieder_heute AS
SELECT * FROM mitglieder
WHERE present = true;

-- Besuche der letzten 30 Tage
CREATE OR REPLACE VIEW besuche_30_tage AS
SELECT 
  code,
  COUNT(*) as anzahl,
  MAX(timestamp) as letzter_besuch
FROM scan_events
WHERE timestamp > (EXTRACT(EPOCH FROM NOW()) - 30*24*60*60)::BIGINT
  AND action = 'checkin'
GROUP BY code;

-- Durchschnittliche Verweildauer pro Mitglied
CREATE OR REPLACE VIEW durchschnittliche_verweildauer AS
SELECT 
  code,
  AVG(duration_hours) as avg_dauer,
  COUNT(*) as anzahl_besuche
FROM scan_events
WHERE action = 'checkout'
  AND duration_hours IS NOT NULL
GROUP BY code;

-- ─────────────────────────────────────────────────────────────
-- Abschluss
-- ─────────────────────────────────────────────────────────────

-- Setup erfolgreich
SELECT '✅ Saunascaner Setup erfolgreich!' as status;
