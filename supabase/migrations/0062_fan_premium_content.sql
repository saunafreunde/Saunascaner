-- Migration 0062: Premium-Inhalte für Fans+ (Verein-News + exklusive Aroma-Rezepte)

-- 1. org_news: Vereins-Ankündigungen mit rollen-basierter Sichtbarkeit
CREATE TABLE public.org_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) <= 200),
  body text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  published_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  cover_image_url text,
  target_min_role text NOT NULL DEFAULT 'fan'
    CHECK (target_min_role IN ('gast', 'fan', 'member')),
  created_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_news_pinned_published ON public.org_news(pinned DESC, published_at DESC);
CREATE INDEX idx_org_news_expires ON public.org_news(expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE public.org_news ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_news_read_by_role ON public.org_news
  FOR SELECT TO authenticated
  USING (
    (expires_at IS NULL OR expires_at > now())
    AND (
      target_min_role = 'gast'
      OR (target_min_role = 'fan' AND public.is_fan_or_higher())
      OR (target_min_role = 'member' AND EXISTS (
        SELECT 1 FROM public.members
        WHERE auth_user_id = auth.uid()
          AND role IN ('member', 'guest_aufgieser', 'staff', 'admin')
      ))
    )
  );

CREATE POLICY org_news_write_admin ON public.org_news
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 2. aroma_recipes
CREATE TABLE public.aroma_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) <= 120),
  description text,
  ingredients jsonb NOT NULL,
  sauna_type text CHECK (sauna_type IN ('finnisch', 'bio', 'kelo', 'aufguss', 'event')),
  temperature_c integer CHECK (temperature_c BETWEEN 40 AND 110),
  approved boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  approved_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_by uuid NOT NULL REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_aroma_recipes_approved ON public.aroma_recipes(approved, created_at DESC);
CREATE INDEX idx_aroma_recipes_creator ON public.aroma_recipes(created_by);

ALTER TABLE public.aroma_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY aroma_recipes_read ON public.aroma_recipes
  FOR SELECT TO authenticated
  USING (
    (approved = true AND public.is_fan_or_higher())
    OR created_by IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
    OR public.is_admin()
  );

CREATE POLICY aroma_recipes_insert_aufgieser ON public.aroma_recipes
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_aufgieser()
    AND created_by IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
  );

CREATE POLICY aroma_recipes_update_own ON public.aroma_recipes
  FOR UPDATE TO authenticated
  USING (
    public.is_admin()
    OR (
      approved = false
      AND created_by IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
    )
  )
  WITH CHECK (
    public.is_admin()
    OR (
      approved = false
      AND created_by IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
    )
  );

CREATE POLICY aroma_recipes_delete_own ON public.aroma_recipes
  FOR DELETE TO authenticated
  USING (
    public.is_admin()
    OR (
      approved = false
      AND created_by IN (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
    )
  );

-- 3. RPCs
CREATE OR REPLACE FUNCTION public.list_active_news()
RETURNS TABLE(
  id uuid,
  title text,
  body text,
  pinned boolean,
  published_at timestamptz,
  expires_at timestamptz,
  cover_image_url text,
  target_min_role text,
  created_by_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT n.id, n.title, n.body, n.pinned, n.published_at, n.expires_at,
         n.cover_image_url, n.target_min_role,
         m.name AS created_by_name
  FROM public.org_news n
  LEFT JOIN public.members m ON m.id = n.created_by
  WHERE (n.expires_at IS NULL OR n.expires_at > now())
    AND (
      n.target_min_role = 'gast'
      OR (n.target_min_role = 'fan' AND public.is_fan_or_higher())
      OR (n.target_min_role = 'member' AND EXISTS (
        SELECT 1 FROM public.members mm
        WHERE mm.auth_user_id = auth.uid()
          AND mm.role IN ('member', 'guest_aufgieser', 'staff', 'admin')
      ))
    )
  ORDER BY n.pinned DESC, n.published_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.list_active_news() FROM public;
GRANT EXECUTE ON FUNCTION public.list_active_news() TO authenticated;

CREATE OR REPLACE FUNCTION public.list_approved_aroma_recipes()
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  ingredients jsonb,
  sauna_type text,
  temperature_c integer,
  created_by_name text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.id, r.title, r.description, r.ingredients, r.sauna_type, r.temperature_c,
         m.name AS created_by_name,
         r.created_at
  FROM public.aroma_recipes r
  LEFT JOIN public.members m ON m.id = r.created_by
  WHERE r.approved = true AND public.is_fan_or_higher()
  ORDER BY r.created_at DESC;
$$;
REVOKE EXECUTE ON FUNCTION public.list_approved_aroma_recipes() FROM public;
GRANT EXECUTE ON FUNCTION public.list_approved_aroma_recipes() TO authenticated;

-- 4. Trigger: Push bei neuer News
CREATE OR REPLACE FUNCTION public.notify_fans_on_news()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.target_min_role IN ('gast', 'fan', 'member') THEN
    INSERT INTO public.notification_queue(kind, payload, recipient_id, dedup_key)
    SELECT 'org_news_published',
           jsonb_build_object('news_id', NEW.id, 'title', NEW.title),
           m.id,
           'news_' || NEW.id::text || '_' || m.id::text
    FROM public.members m
    WHERE m.revoked_at IS NULL
      AND (
        NEW.target_min_role = 'gast'
        OR (NEW.target_min_role = 'fan' AND m.role IN ('fan','member','guest_aufgieser','staff','admin'))
        OR (NEW.target_min_role = 'member' AND m.role IN ('member','guest_aufgieser','staff','admin'))
      )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_org_news_notify
AFTER INSERT ON public.org_news
FOR EACH ROW EXECUTE FUNCTION public.notify_fans_on_news();

-- 5. updated_at-Trigger
CREATE TRIGGER trg_org_news_updated_at
BEFORE UPDATE ON public.org_news
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER trg_aroma_recipes_updated_at
BEFORE UPDATE ON public.aroma_recipes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
