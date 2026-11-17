-- Pin contents and tag links commit together. Retried creates keep one client-generated id.
CREATE OR REPLACE FUNCTION public.save_timeline_pin(
  p_pin_id uuid,
  p_is_create boolean,
  p_content_id uuid,
  p_episode_id uuid,
  p_timestamp_seconds integer,
  p_memo text,
  p_emotion public.emotion_type,
  p_is_spoiler boolean,
  p_tag_names text[]
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_pin public.timeline_pins%ROWTYPE;
  v_memo text := nullif(btrim(p_memo), '');
  v_names text[];
  v_existing_names text[];
  v_tag_id uuid;
  v_name text;
  v_created boolean := false;
  v_content_id uuid;
  v_episode_id uuid;
  v_content_type public.content_type;
  v_duration integer;
  v_label text;
  v_tags jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'LOGIN_REQUIRED' USING ERRCODE = '42501';
  END IF;
  IF p_pin_id IS NULL OR p_is_create IS NULL
    OR (p_timestamp_seconds IS NULL AND v_memo IS NULL)
    OR p_timestamp_seconds < 0 OR char_length(v_memo) > 500 THEN
    RAISE EXCEPTION 'PIN_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM unnest(coalesce(p_tag_names, ARRAY[]::text[])) AS input(name)
    WHERE name IS NULL OR char_length(btrim(name)) NOT BETWEEN 1 AND 20
  ) THEN
    RAISE EXCEPTION 'PIN_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;
  SELECT coalesce(array_agg(name ORDER BY name), ARRAY[]::text[]) INTO v_names
  FROM (SELECT DISTINCT btrim(name) AS name FROM unnest(coalesce(p_tag_names, ARRAY[]::text[])) AS input(name)) AS names;
  IF cardinality(v_names) > 10 THEN
    RAISE EXCEPTION 'PIN_INVALID_INPUT' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_pin FROM public.timeline_pins
    WHERE id = p_pin_id AND user_id = v_user_id FOR UPDATE;
  IF NOT p_is_create AND NOT FOUND THEN
    RAISE EXCEPTION 'PIN_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF NOT p_is_create AND p_content_id IS NOT NULL AND p_content_id <> v_pin.content_id THEN
    RAISE EXCEPTION 'PIN_CONTENT_MISMATCH' USING ERRCODE = '22023';
  END IF;
  v_content_id := CASE WHEN p_is_create THEN p_content_id ELSE v_pin.content_id END;
  v_episode_id := CASE WHEN p_is_create THEN p_episode_id ELSE v_pin.episode_id END;
  SELECT content_type INTO v_content_type FROM public.contents WHERE id = v_content_id;
  IF NOT FOUND OR (v_content_type = 'movie' AND v_episode_id IS NOT NULL) THEN
    RAISE EXCEPTION 'PIN_CONTENT_MISMATCH' USING ERRCODE = '22023';
  END IF;
  IF v_episode_id IS NOT NULL THEN
    SELECT duration_seconds INTO v_duration FROM public.episodes
      WHERE id = v_episode_id AND content_id = v_content_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PIN_CONTENT_MISMATCH' USING ERRCODE = '22023';
    END IF;
    IF v_duration > 0 AND p_timestamp_seconds > v_duration THEN
      RAISE EXCEPTION 'PIN_INVALID_INPUT' USING ERRCODE = '22023';
    END IF;
  END IF;
  v_label := CASE
    WHEN p_timestamp_seconds IS NULL THEN NULL
    WHEN p_timestamp_seconds >= 3600 THEN (p_timestamp_seconds / 3600)::text || ':' ||
      lpad(((p_timestamp_seconds % 3600) / 60)::text, 2, '0') || ':' || lpad((p_timestamp_seconds % 60)::text, 2, '0')
    ELSE lpad((p_timestamp_seconds / 60)::text, 2, '0') || ':' || lpad((p_timestamp_seconds % 60)::text, 2, '0')
  END;

  IF p_is_create THEN
    INSERT INTO public.timeline_pins(id, user_id, content_id, episode_id, timestamp_seconds, display_time_label, memo, emotion, is_spoiler)
    VALUES (p_pin_id, v_user_id, v_content_id, v_episode_id, p_timestamp_seconds, v_label, v_memo, p_emotion, coalesce(p_is_spoiler, false))
    ON CONFLICT (id) DO NOTHING RETURNING * INTO v_pin;
    v_created := FOUND;
    IF NOT v_created THEN
      -- A concurrent identical retry waits for the first transaction, then reads its complete result.
      SELECT * INTO v_pin FROM public.timeline_pins
        WHERE id = p_pin_id AND user_id = v_user_id FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'PIN_NOT_FOUND' USING ERRCODE = 'P0002';
      END IF;
      SELECT coalesce(array_agg(t.name ORDER BY t.name), ARRAY[]::text[]) INTO v_existing_names
      FROM public.timeline_pin_tags AS pt JOIN public.tags AS t ON t.id = pt.tag_id WHERE pt.pin_id = p_pin_id;
      IF v_pin.content_id IS DISTINCT FROM v_content_id OR v_pin.episode_id IS DISTINCT FROM v_episode_id
        OR v_pin.timestamp_seconds IS DISTINCT FROM p_timestamp_seconds OR v_pin.memo IS DISTINCT FROM v_memo
        OR v_pin.emotion IS DISTINCT FROM p_emotion OR v_pin.is_spoiler IS DISTINCT FROM coalesce(p_is_spoiler, false)
        OR v_existing_names IS DISTINCT FROM v_names THEN
        RAISE EXCEPTION 'PIN_REQUEST_CONFLICT' USING ERRCODE = '22023';
      END IF;
    END IF;
  ELSE
    UPDATE public.timeline_pins SET timestamp_seconds = p_timestamp_seconds, display_time_label = v_label,
      memo = v_memo, emotion = p_emotion, is_spoiler = coalesce(p_is_spoiler, false)
      WHERE id = p_pin_id AND user_id = v_user_id RETURNING * INTO v_pin;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PIN_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  IF v_created OR NOT p_is_create THEN
    -- Any error below rolls back the pin body and the old links as part of this function call.
    DELETE FROM public.timeline_pin_tags WHERE pin_id = p_pin_id;
    FOREACH v_name IN ARRAY v_names LOOP
      INSERT INTO public.tags(user_id, name) VALUES (v_user_id, v_name)
        ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;
      INSERT INTO public.timeline_pin_tags(pin_id, tag_id) VALUES (p_pin_id, v_tag_id);
    END LOOP;
  END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.name), '[]'::jsonb) INTO v_tags
    FROM public.timeline_pin_tags AS pt JOIN public.tags AS t ON t.id = pt.tag_id WHERE pt.pin_id = p_pin_id;
  RETURN to_jsonb(v_pin) || jsonb_build_object('tags', v_tags);
END;
$$;

REVOKE ALL ON FUNCTION public.save_timeline_pin(uuid, boolean, uuid, uuid, integer, text, public.emotion_type, boolean, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_timeline_pin(uuid, boolean, uuid, uuid, integer, text, public.emotion_type, boolean, text[]) TO authenticated;
