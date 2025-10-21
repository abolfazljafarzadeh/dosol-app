-- Add level to rpc_get_dashboard output
-- Level calculation: FLOOR(total_xp / 100)

CREATE OR REPLACE FUNCTION public.rpc_get_dashboard(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_tz TEXT;
  v_local_date DATE;
  v_today_minutes INT;
  v_today_logs INT;
  v_today_xp INT;
  v_total_xp INT;
  v_current_streak INT;
  v_best_streak INT;
  v_current_level INT;
  v_challenge JSONB;
  v_league JSONB;
  v_challenge_code TEXT;
  v_target INT;
  v_days_done INT;
  v_is_completed BOOLEAN;
  v_league_id UUID;
  v_xp_week INT;
  v_rank INT;
BEGIN
  -- Get user timezone
  SELECT tz INTO v_user_tz FROM public.profiles WHERE id = p_user_id;
  IF v_user_tz IS NULL THEN
    v_user_tz := 'Asia/Tehran';
  END IF;

  -- Calculate local date
  v_local_date := (NOW() AT TIME ZONE v_user_tz)::DATE;

  -- Get today's practice stats
  SELECT COALESCE(SUM(minutes), 0), COUNT(*)
  INTO v_today_minutes, v_today_logs
  FROM public.practice_logs
  WHERE user_id = p_user_id AND local_date = v_local_date;

  -- Get today's XP
  SELECT COALESCE(SUM(delta), 0)
  INTO v_today_xp
  FROM public.xp_events
  WHERE user_id = p_user_id AND local_date = v_local_date;

  -- Get total XP
  SELECT COALESCE(total_xp, 0)
  INTO v_total_xp
  FROM public.xp_counters
  WHERE user_id = p_user_id;

  -- Calculate level (100 XP per level)
  v_current_level := FLOOR(v_total_xp / 100.0);

  -- Get streak
  SELECT COALESCE(current_streak, 0), COALESCE(best_streak, 0)
  INTO v_current_streak, v_best_streak
  FROM public.streaks
  WHERE user_id = p_user_id;

  -- Get active challenge
  SELECT c.code, (c.rules->>'target')::INT
  INTO v_challenge_code, v_target
  FROM public.challenges c
  WHERE c.active_week IS NOT NULL
  LIMIT 1;

  IF v_challenge_code IS NOT NULL THEN
    SELECT COALESCE(jsonb_array_length(progress->'days_practiced'), 0),
           (status = 'completed')
    INTO v_days_done, v_is_completed
    FROM public.challenge_progress
    WHERE user_id = p_user_id AND challenge_code = v_challenge_code;

    v_challenge := jsonb_build_object(
      'daysDone', COALESCE(v_days_done, 0),
      'target', v_target,
      'isCompleted', COALESCE(v_is_completed, false)
    );
  ELSE
    v_challenge := NULL;
  END IF;

  -- Get league info
  SELECT lm.league_id, ls.xp_week
  INTO v_league_id, v_xp_week
  FROM public.league_members lm
  JOIN public.league_scores ls ON ls.user_id = lm.user_id AND ls.league_id = lm.league_id
  WHERE lm.user_id = p_user_id
  ORDER BY lm.created_at DESC
  LIMIT 1;

  IF v_league_id IS NOT NULL THEN
    -- Calculate rank
    SELECT COUNT(*) + 1 INTO v_rank
    FROM public.league_scores
    WHERE league_id = v_league_id AND xp_week > v_xp_week;

    v_league := jsonb_build_object(
      'id', v_league_id,
      'xpWeek', v_xp_week,
      'rank', v_rank
    );
  ELSE
    v_league := NULL;
  END IF;

  -- Return dashboard data with level
  RETURN jsonb_build_object(
    'ok', true,
    'today', jsonb_build_object(
      'minutes', v_today_minutes,
      'logs', v_today_logs,
      'xpToday', v_today_xp
    ),
    'xpTotal', v_total_xp,
    'level', v_current_level,
    'streak', jsonb_build_object(
      'current', v_current_streak,
      'best', v_best_streak
    ),
    'challenge', v_challenge,
    'league', v_league
  );
END;
$function$;