-- Phase 8: Avatar pro Mitglied + Event-/Sauna-Foto-Galerie

-- ─── 1. Avatar pro Mitglied ───────────────────────────────────────────────
-- avatar_path: entweder Storage-Pfad ("avatars/<uuid>.jpg")
--              oder dicebear-Marker ("dicebear:<style>:<seed>")
ALTER TABLE members ADD COLUMN IF NOT EXISTS avatar_path text;

-- ─── 2. Event-/Sauna-Foto-Galerie ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS member_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  photo_path  text NOT NULL,
  caption     text,
  approved    boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE member_photos
  DROP CONSTRAINT IF EXISTS member_photos_caption_length;
ALTER TABLE member_photos
  ADD CONSTRAINT member_photos_caption_length
  CHECK (caption IS NULL OR char_length(caption) <= 280);

CREATE INDEX IF NOT EXISTS idx_member_photos_created
  ON member_photos(created_at DESC) WHERE approved = true;

ALTER TABLE member_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mp_read   ON member_photos;
DROP POLICY IF EXISTS mp_insert ON member_photos;
DROP POLICY IF EXISTS mp_modify ON member_photos;

CREATE POLICY mp_read ON member_photos FOR SELECT TO authenticated
  USING (
    approved = true
    OR uploader_id = (SELECT id FROM public.current_member())
    OR public.is_admin()
  );

CREATE POLICY mp_insert ON member_photos FOR INSERT TO authenticated
  WITH CHECK (uploader_id = (SELECT id FROM public.current_member()));

CREATE POLICY mp_modify ON member_photos FOR UPDATE TO authenticated
  USING (uploader_id = (SELECT id FROM public.current_member()) OR public.is_admin())
  WITH CHECK (uploader_id = (SELECT id FROM public.current_member()) OR public.is_admin());

CREATE POLICY mp_delete ON member_photos FOR DELETE TO authenticated
  USING (uploader_id = (SELECT id FROM public.current_member()) OR public.is_admin());

-- ─── 3. RPC: Avatar setzen ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_my_avatar(p_path text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  UPDATE members SET avatar_path = nullif(btrim(coalesce(p_path,'')), '')
   WHERE auth_user_id = auth.uid();
  IF NOT FOUND THEN RETURN 'not_authorized'; END IF;
  RETURN 'ok';
END $$;

GRANT EXECUTE ON FUNCTION public.set_my_avatar(text) TO authenticated;

-- ─── 4. Verzeichnis-RPC um avatar_path erweitern (Return-Type ändert sich) ─
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
  avatar_path   text,
  created_at    timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    m.id, m.name, m.sauna_name, m.member_number, m.role::text,
    m.is_aufgieser, m.is_present, m.birthday, m.motto, m.avatar_path, m.created_at
  FROM members m
  WHERE m.approved = true
    AND m.revoked_at IS NULL
    AND auth.uid() IS NOT NULL
  ORDER BY m.is_aufgieser DESC, COALESCE(m.sauna_name, m.name);
$$;
GRANT EXECUTE ON FUNCTION public.list_members_directory() TO authenticated;

-- ─── 5. get_member_public um avatar_path erweitern ────────────────────────
DROP FUNCTION IF EXISTS public.get_member_public(uuid);
CREATE FUNCTION public.get_member_public(p_member_id uuid)
RETURNS TABLE(
  id            uuid,
  name          text,
  sauna_name    text,
  member_number int,
  role          text,
  is_aufgieser  boolean,
  birthday      date,
  motto         text,
  avatar_path   text,
  created_at    timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    m.id, m.name, m.sauna_name, m.member_number, m.role::text,
    m.is_aufgieser, m.birthday, m.motto, m.avatar_path, m.created_at
  FROM members m
  WHERE m.id = p_member_id
    AND m.approved = true
    AND m.revoked_at IS NULL
    AND auth.uid() IS NOT NULL;
$$;
GRANT EXECUTE ON FUNCTION public.get_member_public(uuid) TO authenticated;

-- ─── 6. RPC: Foto-Galerie laden (mit Uploader-Name) ───────────────────────
CREATE OR REPLACE FUNCTION public.list_member_photos(p_limit int DEFAULT 30, p_include_pending boolean DEFAULT false)
RETURNS TABLE(
  id            uuid,
  uploader_id   uuid,
  uploader_name text,
  uploader_sauna_name text,
  uploader_avatar_path text,
  photo_path    text,
  caption       text,
  approved      boolean,
  created_at    timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT
    p.id, p.uploader_id,
    u.name, u.sauna_name, u.avatar_path,
    p.photo_path, p.caption, p.approved, p.created_at
  FROM member_photos p
  JOIN members u ON u.id = p.uploader_id
  WHERE auth.uid() IS NOT NULL
    AND (
      p_include_pending
      OR p.approved = true
      OR p.uploader_id = (SELECT id FROM public.current_member())
      OR public.is_admin()
    )
  ORDER BY p.created_at DESC
  LIMIT GREATEST(LEAST(p_limit, 200), 1);
$$;

GRANT EXECUTE ON FUNCTION public.list_member_photos(int, boolean) TO authenticated;
