-- Preserve contents UUIDs and every user record. This migration classifies the current
-- stored representation; it does not guess or repair metadata corrupted before this fix.
ALTER TABLE public.contents ADD COLUMN source_media_type text NOT NULL DEFAULT '';
UPDATE public.contents
SET source_media_type = CASE WHEN source_api = 'tmdb'
  THEN CASE WHEN content_type = 'movie' THEN 'movie' ELSE 'tv' END ELSE '' END;
ALTER TABLE public.contents
  ADD CONSTRAINT contents_source_media_type_check CHECK (
    (source_api = 'tmdb' AND source_media_type = CASE WHEN content_type = 'movie' THEN 'movie' ELSE 'tv' END)
    OR (source_api <> 'tmdb' AND source_media_type = '')
  );
ALTER TABLE public.contents DROP CONSTRAINT contents_source_unique;
ALTER TABLE public.contents ADD CONSTRAINT contents_source_unique UNIQUE (source_api, source_id, source_media_type);

ALTER TABLE public.content_external_ids ADD COLUMN media_type text NOT NULL DEFAULT '';
UPDATE public.content_external_ids AS external_id
SET media_type = CASE WHEN external_id.api_source = 'tmdb'
  THEN CASE WHEN content.content_type = 'movie' THEN 'movie' ELSE 'tv' END ELSE '' END
FROM public.contents AS content WHERE content.id = external_id.content_id;
ALTER TABLE public.content_external_ids
  ADD CONSTRAINT content_external_ids_media_type_check CHECK (
    (api_source = 'tmdb' AND media_type IN ('movie', 'tv')) OR (api_source <> 'tmdb' AND media_type = '')
  );
ALTER TABLE public.content_external_ids DROP CONSTRAINT content_external_ids_source_unique;
ALTER TABLE public.content_external_ids ADD CONSTRAINT content_external_ids_source_unique UNIQUE (api_source, external_id, media_type);

-- Even a stale or mismatched refresh must never turn a registered movie into a TV work.
CREATE FUNCTION public.guard_tmdb_content_identity() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF OLD.source_api = 'tmdb' AND (
    NEW.source_api IS DISTINCT FROM OLD.source_api
    OR NEW.source_id IS DISTINCT FROM OLD.source_id
    OR NEW.source_media_type IS DISTINCT FROM OLD.source_media_type
  ) THEN
    RAISE EXCEPTION 'CONTENT_IDENTITY_MISMATCH' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_tmdb_content_identity
BEFORE UPDATE ON public.contents FOR EACH ROW EXECUTE FUNCTION public.guard_tmdb_content_identity();
REVOKE ALL ON FUNCTION public.guard_tmdb_content_identity() FROM PUBLIC;

ALTER TABLE public.seasons ADD COLUMN episodes_synced_at timestamptz;
ALTER TABLE public.seasons ADD COLUMN published_episode_numbers integer[];
ALTER TABLE public.seasons ADD CONSTRAINT seasons_published_episode_numbers_check
  CHECK (published_episode_numbers IS NULL OR (
    array_position(published_episode_numbers, NULL) IS NULL
    AND (cardinality(published_episode_numbers) = 0 OR (0 < ALL(published_episode_numbers) AND 50000 >= ALL(published_episode_numbers)))
  ));
COMMENT ON COLUMN public.seasons.episodes_synced_at IS 'Successful complete episode-list sync. First-episode prefetch never sets this marker; unknown totals refresh after 30 minutes.';
COMMENT ON COLUMN public.seasons.published_episode_numbers IS 'Actual published episode numbers from a successful unknown-total provider sync; other stored episode IDs remain untouched.';
COMMENT ON COLUMN public.contents.source_media_type IS 'TMDB movie/tv namespace; empty string for other providers. Raw source_id stays unchanged.';
COMMENT ON COLUMN public.content_external_ids.media_type IS 'TMDB movie/tv namespace; empty string for other providers. Raw external_id stays unchanged.';
