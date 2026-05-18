-- Migration 0078: Kommentare unter Feed-Posts
-- Bringt Tiefe in den Mini-Insta-Feed — Reactions sind schnell, Kommentare
-- erlauben echte Gespräche.

CREATE TABLE IF NOT EXISTS public.feed_post_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  body        text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_feed_comments_post
  ON public.feed_post_comments (post_id, created_at)
  WHERE deleted_at IS NULL;

ALTER TABLE public.feed_post_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feed_comments_read ON public.feed_post_comments;
CREATE POLICY feed_comments_read ON public.feed_post_comments
  FOR SELECT USING (deleted_at IS NULL OR public.is_admin());

DROP POLICY IF EXISTS feed_comments_no_direct_write ON public.feed_post_comments;
CREATE POLICY feed_comments_no_direct_write ON public.feed_post_comments
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_post_comments;

-- RPCs
CREATE OR REPLACE FUNCTION public.list_post_comments(p_post_id uuid)
RETURNS TABLE(id uuid, author_id uuid, author_name text, author_avatar text,
              body text, created_at timestamptz, is_mine boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT c.id, c.author_id, m.name, m.avatar_path, c.body, c.created_at,
         c.author_id = (SELECT id FROM public.members WHERE auth_user_id = auth.uid())
  FROM public.feed_post_comments c
  JOIN public.members m ON m.id = c.author_id
  WHERE c.post_id = p_post_id AND c.deleted_at IS NULL
  ORDER BY c.created_at ASC;
$$;
GRANT EXECUTE ON FUNCTION public.list_post_comments(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_post_comment(p_post_id uuid, p_body text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_me uuid; v_id uuid; v_author_of_post uuid; v_my_name text;
BEGIN
  SELECT id, name INTO v_me, v_my_name FROM public.members WHERE auth_user_id = auth.uid();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_body IS NULL OR char_length(btrim(p_body)) < 1 THEN RAISE EXCEPTION 'empty_comment'; END IF;
  IF char_length(p_body) > 500 THEN RAISE EXCEPTION 'comment_too_long'; END IF;

  INSERT INTO public.feed_post_comments(post_id, author_id, body)
  VALUES (p_post_id, v_me, btrim(p_body)) RETURNING id INTO v_id;

  SELECT author_id INTO v_author_of_post FROM public.feed_posts WHERE id = p_post_id;
  IF v_author_of_post IS NOT NULL AND v_author_of_post <> v_me THEN
    INSERT INTO public.notification_queue(kind, recipient_id, payload, dedup_key)
    VALUES ('post_commented', v_author_of_post,
      jsonb_build_object('title','💬 Neuer Kommentar',
        'body', v_my_name || ' hat deinen Beitrag kommentiert.',
        'post_id', p_post_id, 'comment_id', v_id, 'author_id', v_me),
      'comment:' || v_id::text);
  END IF;
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_post_comment(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_my_comment(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_me uuid;
BEGIN
  SELECT id INTO v_me FROM public.members WHERE auth_user_id = auth.uid();
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.feed_post_comments SET deleted_at = now()
  WHERE id = p_id AND (author_id = v_me OR public.is_admin()) AND deleted_at IS NULL;
END; $$;
GRANT EXECUTE ON FUNCTION public.delete_my_comment(uuid) TO authenticated;
