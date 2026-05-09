-- Phase 8: Profil-Erweiterungen — Motto, Lieblings-Öle, Signatur-Aufguss

-- Motto-Feld (Selbstbeschreibung, max ca. 140 Zeichen, optional)
ALTER TABLE members ADD COLUMN IF NOT EXISTS motto text;
ALTER TABLE members
  DROP CONSTRAINT IF EXISTS members_motto_length;
ALTER TABLE members
  ADD CONSTRAINT members_motto_length
  CHECK (motto IS NULL OR char_length(motto) <= 200);

-- RPC: eigenes Motto setzen (max 200 Zeichen, leerer String → NULL)
CREATE OR REPLACE FUNCTION public.set_my_motto(p_motto text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  cleaned text;
BEGIN
  cleaned := nullif(btrim(coalesce(p_motto, '')), '');
  IF cleaned IS NOT NULL AND char_length(cleaned) > 200 THEN
    RETURN 'too_long';
  END IF;
  UPDATE members SET motto = cleaned WHERE auth_user_id = auth.uid();
  IF NOT FOUND THEN RETURN 'not_authorized'; END IF;
  RETURN 'ok';
END $$;

GRANT EXECUTE ON FUNCTION public.set_my_motto(text) TO authenticated;

-- Verzeichnis-RPC um Motto erweitern (Return-Type wird geändert → DROP nötig)
DROP FUNCTION IF EXISTS public.list_members_directory();
CREATE FUNCTION public.list_members_directory()
RETURNS TABLE(
  id            uuid,
  name          text,
  sauna_name    text,
  member_number int,
  role          text,
  is_aufgieser  boolean,
  is_present    boolean,
  birthday      date,
  motto         text,
  created_at    timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    m.id, m.name, m.sauna_name, m.member_number,
    m.role::text, m.is_aufgieser, m.is_present, m.birthday, m.motto, m.created_at
  FROM members m
  WHERE m.approved = true
    AND m.revoked_at IS NULL
    AND auth.uid() IS NOT NULL
  ORDER BY m.is_aufgieser DESC, COALESCE(m.sauna_name, m.name);
$$;
GRANT EXECUTE ON FUNCTION public.list_members_directory() TO authenticated;

-- RPC: öffentliche Profil-Felder eines Mitglieds (umgeht RLS members_read_self)
-- Liefert nur Felder, die sich Mitglieder ohnehin gegenseitig zeigen.
CREATE OR REPLACE FUNCTION public.get_member_public(p_member_id uuid)
RETURNS TABLE(
  id            uuid,
  name          text,
  sauna_name    text,
  member_number int,
  role          text,
  is_aufgieser  boolean,
  birthday      date,
  motto         text,
  created_at    timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    m.id, m.name, m.sauna_name, m.member_number,
    m.role::text, m.is_aufgieser, m.birthday, m.motto, m.created_at
  FROM members m
  WHERE m.id = p_member_id
    AND m.approved = true
    AND m.revoked_at IS NULL
    AND auth.uid() IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.get_member_public(uuid) TO authenticated;

-- RPC: Top 3 Lieblings-Öle eines Mitglieds (aus seinen Aufgüssen)
CREATE OR REPLACE FUNCTION public.get_member_favorite_oils(p_member_id uuid)
RETURNS TABLE(oil_id text, usage_count int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  WITH unrolled AS (
    SELECT unnest(oils) AS oil_id
    FROM infusions
    WHERE saunameister_id = p_member_id
      AND oils IS NOT NULL
  )
  SELECT oil_id, COUNT(*)::int AS usage_count
  FROM unrolled
  WHERE oil_id IS NOT NULL
  GROUP BY oil_id
  ORDER BY usage_count DESC, oil_id ASC
  LIMIT 3;
$$;

GRANT EXECUTE ON FUNCTION public.get_member_favorite_oils(uuid) TO authenticated;

-- RPC: Signatur-Aufguss eines Mitglieds (häufigster Titel mit ≥ 2 Aufgüssen)
CREATE OR REPLACE FUNCTION public.get_member_signature_infusion(p_member_id uuid)
RETURNS TABLE(title text, count int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    btrim(title) AS title,
    COUNT(*)::int AS count
  FROM infusions
  WHERE saunameister_id = p_member_id
    AND title IS NOT NULL
    AND btrim(title) <> ''
  GROUP BY btrim(title)
  HAVING COUNT(*) >= 2
  ORDER BY count DESC, title ASC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_member_signature_infusion(uuid) TO authenticated;
