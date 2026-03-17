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
