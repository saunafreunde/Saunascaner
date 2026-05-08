-- Migration 0006: Aufguss-Künstlername + Custom Attribute Buttons

-- ─── Members: neue Felder ─────────────────────────────────────────────────────
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS sauna_name text,
  ADD COLUMN IF NOT EXISTS sauna_name_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS custom_attrs_enabled boolean NOT NULL DEFAULT true;

-- ─── RPC: set_sauna_name mit 30-Tage-Cooldown ─────────────────────────────────
CREATE OR REPLACE FUNCTION set_sauna_name(p_name text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_changed_at timestamptz;
BEGIN
  SELECT sauna_name_changed_at INTO v_changed_at
  FROM members WHERE id = auth.uid();

  IF v_changed_at IS NOT NULL AND v_changed_at > (NOW() - INTERVAL '30 days') THEN
    RAISE EXCEPTION 'cooldown: Aufguss-Name kann nur alle 30 Tage geändert werden';
  END IF;

  UPDATE members
  SET sauna_name = NULLIF(trim(p_name), ''),
      sauna_name_changed_at = NOW()
  WHERE id = auth.uid();
END;
$$;

-- ─── member_custom_attrs Tabelle ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_custom_attrs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  emoji       text NOT NULL,
  color       text NOT NULL,
  label       text NOT NULL CHECK (char_length(label) <= 7),
  sort_order  smallint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Index für schnelle Abfragen nach member_id
CREATE INDEX IF NOT EXISTS member_custom_attrs_member_id_idx ON member_custom_attrs(member_id);

-- Trigger: max 8 custom attrs pro Aufgieser
CREATE OR REPLACE FUNCTION check_max_custom_attrs()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT COUNT(*) FROM member_custom_attrs WHERE member_id = NEW.member_id) >= 8 THEN
    RAISE EXCEPTION 'max_attrs: Maximal 8 eigene Buttons pro Aufgieser erlaubt';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_max_custom_attrs ON member_custom_attrs;
CREATE TRIGGER trg_max_custom_attrs
  BEFORE INSERT ON member_custom_attrs
  FOR EACH ROW EXECUTE FUNCTION check_max_custom_attrs();

-- ─── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE member_custom_attrs ENABLE ROW LEVEL SECURITY;

-- Aufgieser und Admins dürfen eigene sehen; Admin darf alle sehen
DROP POLICY IF EXISTS "member_custom_attrs_select" ON member_custom_attrs;
CREATE POLICY "member_custom_attrs_select" ON member_custom_attrs
  FOR SELECT USING (member_id = auth.uid() OR is_admin());

-- Nur Aufgieser mit aktivierter Funktion dürfen erstellen
DROP POLICY IF EXISTS "member_custom_attrs_insert" ON member_custom_attrs;
CREATE POLICY "member_custom_attrs_insert" ON member_custom_attrs
  FOR INSERT WITH CHECK (
    member_id = auth.uid()
    AND is_aufgieser()
    AND (SELECT custom_attrs_enabled FROM members WHERE id = auth.uid())
  );

-- Kein DELETE für Aufgieser — nur Admin
DROP POLICY IF EXISTS "member_custom_attrs_delete" ON member_custom_attrs;
CREATE POLICY "member_custom_attrs_delete" ON member_custom_attrs
  FOR DELETE USING (is_admin());

-- ─── list_meister_names: sauna_name zurückgeben ────────────────────────────────
-- Gibt sauna_name zurück wenn gesetzt, sonst den echten Namen
CREATE OR REPLACE FUNCTION list_meister_names()
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id, COALESCE(sauna_name, name) AS name
  FROM members
  WHERE is_aufgieser = true AND approved = true AND revoked_at IS NULL
  ORDER BY COALESCE(sauna_name, name);
$$;
