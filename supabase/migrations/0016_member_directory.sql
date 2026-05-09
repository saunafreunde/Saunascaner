-- Phase 8: Mitglieder-Galerie / -Verzeichnis
-- Liefert allen authentifizierten Mitgliedern eine sichere Liste der genehmigten,
-- nicht widerrufenen Mitglieder mit den Feldern, die fürs Verzeichnis nötig sind.
-- Eigenes Auth-Schema umgeht RLS (members_read_self) bewusst — die zurückgegebenen
-- Spalten sind genau das, was sich Mitglieder gegenseitig ohnehin auf der Tafel
-- und im Aufguss-Plan zeigen.

CREATE OR REPLACE FUNCTION public.list_members_directory()
RETURNS TABLE(
  id            uuid,
  name          text,
  sauna_name    text,
  member_number int,
  role          text,
  is_aufgieser  boolean,
  is_present    boolean,
  birthday      date,
  created_at    timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    m.id,
    m.name,
    m.sauna_name,
    m.member_number,
    m.role::text,
    m.is_aufgieser,
    m.is_present,
    m.birthday,
    m.created_at
  FROM members m
  WHERE m.approved = true
    AND m.revoked_at IS NULL
    AND auth.uid() IS NOT NULL
  ORDER BY m.is_aufgieser DESC, COALESCE(m.sauna_name, m.name);
$$;

GRANT EXECUTE ON FUNCTION public.list_members_directory() TO authenticated;
