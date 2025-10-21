-- Fix SQL aggregate error in rpc_get_challenges_view
CREATE OR REPLACE FUNCTION public.rpc_get_challenges_view(p_user_id uuid) 
RETURNS jsonb 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = 'public' 
AS $$
DECLARE 
  v_user_tz TEXT; 
  v_today DATE; 
  v_active jsonb; 
  v_claimable jsonb; 
  v_upcoming jsonb;
BEGIN
  SELECT tz INTO v_user_tz FROM public.profiles WHERE id = p_user_id; 
  IF v_user_tz IS NULL THEN v_user_tz := 'Asia/Tehran'; END IF; 
  v_today := (now() AT TIME ZONE v_user_tz)::date;
  
  -- Active challenges with markedDates field
  SELECT jsonb_agg(
    jsonb_build_object(
      'code', c.code, 
      'title', c.title, 
      'kind', c.kind, 
      'type', c.conditions->>'type', 
      'targetDays', (c.conditions->>'min_days')::int,
      'daysDone', COALESCE((ucp.progress->>'days_done')::int, 0), 
      'current', COALESCE((ucp.progress->>'current')::int, 0), 
      'status', ci.status,
      'isCompleted', COALESCE(ucp.is_completed, false), 
      'isClaimable', COALESCE(ucp.is_claimable, false), 
      'windowStart', ci.window_start, 
      'windowEnd', ci.window_end,
      'markedDates', COALESCE(ucp.progress->'days_marked', '[]'::jsonb)
    )
  ) INTO v_active
  FROM public.challenge_instances ci 
  JOIN public.challenges c ON c.code = ci.challenge_code
  LEFT JOIN public.user_challenge_progress ucp ON ucp.instance_id = ci.id AND ucp.user_id = p_user_id
  WHERE ci.user_id = p_user_id 
    AND ci.status = 'open' 
    AND c.status = 'active' 
    AND (ci.window_start IS NULL OR v_today >= ci.window_start) 
    AND (ci.window_end IS NULL OR v_today <= ci.window_end);
  
  -- Claimable challenges (completed but not yet claimed)
  SELECT jsonb_agg(
    jsonb_build_object(
      'code', c.code, 
      'title', c.title, 
      'instanceId', ci.id, 
      'kind', c.kind, 
      'reward', c.reward
    )
  ) INTO v_claimable
  FROM public.user_challenge_progress ucp
  JOIN public.challenge_instances ci ON ci.id = ucp.instance_id
  JOIN public.challenges c ON c.code = ci.challenge_code
  WHERE ucp.user_id = p_user_id 
    AND ucp.is_claimable = true 
    AND ucp.claimed_at IS NULL;
  
  -- Upcoming challenges (future windows) - fixed ORDER BY issue
  SELECT jsonb_agg(row_to_json(sub))
  INTO v_upcoming
  FROM (
    SELECT 
      c.code, 
      c.title, 
      c.kind, 
      c.period, 
      ci.window_start AS "windowStart", 
      ci.window_end AS "windowEnd"
    FROM public.challenge_instances ci
    JOIN public.challenges c ON c.code = ci.challenge_code
    WHERE (ci.user_id = p_user_id OR ci.user_id IS NULL) 
      AND ci.status = 'open' 
      AND c.status = 'active' 
      AND ci.window_start IS NOT NULL 
      AND v_today < ci.window_start
    ORDER BY ci.window_start
    LIMIT 10
  ) sub;
  
  RETURN jsonb_build_object(
    'ok', true, 
    'active', COALESCE(v_active, '[]'::jsonb), 
    'claimable', COALESCE(v_claimable, '[]'::jsonb), 
    'upcoming', COALESCE(v_upcoming, '[]'::jsonb), 
    'currentWeek', jsonb_build_object(
      'start', (date_trunc('week', v_today) + interval '1 day')::date,
      'end', (date_trunc('week', v_today) + interval '7 days')::date
    )
  );
END;
$$;