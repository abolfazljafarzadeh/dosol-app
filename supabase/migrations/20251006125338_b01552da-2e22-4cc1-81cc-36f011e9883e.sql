-- ================================================================
-- RPC: rpc_save_training_plan
-- ================================================================
CREATE OR REPLACE FUNCTION public.rpc_save_training_plan(
  p_user_id UUID,
  p_days INT[],
  p_times JSONB,
  p_tz TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate days (must be 0-6)
  IF p_days IS NOT NULL AND EXISTS (
    SELECT 1 FROM unnest(p_days) AS day WHERE day < 0 OR day > 6
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid days: must be 0-6');
  END IF;

  -- Update user timezone if provided
  IF p_tz IS NOT NULL THEN
    UPDATE public.profiles
    SET tz = p_tz, updated_at = NOW()
    WHERE id = p_user_id;
  END IF;

  -- Upsert training plan
  INSERT INTO public.training_plans (user_id, days, times, updated_at)
  VALUES (p_user_id, p_days, p_times, NOW())
  ON CONFLICT (user_id)
  DO UPDATE SET
    days = EXCLUDED.days,
    times = EXCLUDED.times,
    updated_at = NOW();

  RETURN jsonb_build_object('ok', true);
END;
$function$;

-- ================================================================
-- RPC: rpc_get_dashboard
-- ================================================================
CREATE OR REPLACE FUNCTION public.rpc_get_dashboard(p_user_id UUID)
RETURNS JSONB
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

  -- Return dashboard data
  RETURN jsonb_build_object(
    'ok', true,
    'today', jsonb_build_object(
      'minutes', v_today_minutes,
      'logs', v_today_logs,
      'xpToday', v_today_xp
    ),
    'xpTotal', v_total_xp,
    'streak', jsonb_build_object(
      'current', v_current_streak,
      'best', v_best_streak
    ),
    'challenge', v_challenge,
    'league', v_league
  );
END;
$function$;

-- ================================================================
-- RPC: rpc_get_achievements
-- ================================================================
CREATE OR REPLACE FUNCTION public.rpc_get_achievements(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_total_xp INT;
  v_current_level INT;
  v_xp_for_next_level INT;
  v_xp_in_current_level INT;
  v_progress_percent INT;
  v_badges JSONB;
  v_league JSONB;
  v_league_id UUID;
  v_rank INT;
  v_week_start DATE;
  v_week_end DATE;
BEGIN
  -- Get total XP
  SELECT COALESCE(total_xp, 0) INTO v_total_xp
  FROM public.xp_counters
  WHERE user_id = p_user_id;

  -- Calculate level (100 XP per level)
  v_current_level := FLOOR(v_total_xp / 100.0);
  v_xp_for_next_level := (v_current_level + 1) * 100;
  v_xp_in_current_level := v_total_xp - (v_current_level * 100);
  v_progress_percent := FLOOR((v_xp_in_current_level * 100.0) / 100.0);

  -- Get user badges (medals)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'code', m.code,
      'title', m.title,
      'description', m.description,
      'kind', m.kind,
      'earnedAt', um.earned_at
    )
  )
  INTO v_badges
  FROM public.user_medals um
  JOIN public.medals m ON m.id = um.medal_id
  WHERE um.user_id = p_user_id;

  -- Get current/latest league
  SELECT lm.league_id, wl.week_start, wl.week_end
  INTO v_league_id, v_week_start, v_week_end
  FROM public.league_members lm
  JOIN public.weekly_leagues wl ON wl.id = lm.league_id
  WHERE lm.user_id = p_user_id
  ORDER BY wl.week_start DESC
  LIMIT 1;

  IF v_league_id IS NOT NULL THEN
    -- Calculate rank
    SELECT lm.rank INTO v_rank
    FROM public.league_members lm
    WHERE lm.user_id = p_user_id AND lm.league_id = v_league_id;

    v_league := jsonb_build_object(
      'id', v_league_id,
      'weekStart', v_week_start,
      'weekEnd', v_week_end,
      'rank', v_rank
    );
  ELSE
    v_league := NULL;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'level', jsonb_build_object(
      'current', v_current_level,
      'xpTotal', v_total_xp,
      'xpForNextLevel', v_xp_for_next_level,
      'progressPercent', v_progress_percent
    ),
    'badges', COALESCE(v_badges, '[]'::jsonb),
    'league', v_league
  );
END;
$function$;

-- ================================================================
-- RPC: rpc_finalize_weekly_leagues (Admin only - Service Role)
-- ================================================================
CREATE OR REPLACE FUNCTION public.rpc_finalize_weekly_leagues()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_league RECORD;
  v_finalized_count INT := 0;
BEGIN
  -- Find all locked leagues and finalize them
  FOR v_league IN
    SELECT id FROM public.weekly_leagues
    WHERE status = 'locked'
  LOOP
    -- Update ranks based on xp_week
    WITH ranked_scores AS (
      SELECT
        user_id,
        RANK() OVER (ORDER BY xp_week DESC) AS new_rank
      FROM public.league_scores
      WHERE league_id = v_league.id
    )
    UPDATE public.league_members lm
    SET rank = rs.new_rank, updated_at = NOW()
    FROM ranked_scores rs
    WHERE lm.user_id = rs.user_id AND lm.league_id = v_league.id;

    -- Mark league as finalized
    UPDATE public.weekly_leagues
    SET status = 'finalized'
    WHERE id = v_league.id;

    v_finalized_count := v_finalized_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'finalized', v_finalized_count);
END;
$function$;

-- ================================================================
-- RPC: rpc_rollover_weekly_challenge (Admin only - Service Role)
-- ================================================================
CREATE OR REPLACE FUNCTION public.rpc_rollover_weekly_challenge()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_tz TEXT := 'Asia/Tehran';
  v_current_week_start DATE;
  v_current_week_end DATE;
  v_existing_challenge RECORD;
  v_new_challenge_id UUID;
BEGIN
  -- Calculate current week (Saturday to Friday in Asia/Tehran)
  v_current_week_start := (NOW() AT TIME ZONE v_user_tz)::DATE;
  v_current_week_start := v_current_week_start - ((EXTRACT(DOW FROM v_current_week_start)::INT + 1) % 7);
  v_current_week_end := v_current_week_start + INTERVAL '6 days';

  -- Check if challenge already exists for this week
  SELECT * INTO v_existing_challenge
  FROM public.challenges
  WHERE active_week = v_current_week_start;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'message', 'Challenge already exists for this week',
      'challengeId', v_existing_challenge.id
    );
  END IF;

  -- Deactivate previous week's challenge
  UPDATE public.challenges
  SET active_week = NULL
  WHERE active_week IS NOT NULL;

  -- Create new challenge
  INSERT INTO public.challenges (code, title, rules, reward, active_week, level)
  VALUES (
    'weekly_' || to_char(v_current_week_start, 'YYYY_WW'),
    'چالش هفتگی',
    jsonb_build_object('type', 'practice_days', 'target', 5),
    jsonb_build_object('xp', 100),
    v_current_week_start,
    'beginner'
  )
  RETURNING id INTO v_new_challenge_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'New weekly challenge created',
    'challengeId', v_new_challenge_id,
    'weekStart', v_current_week_start,
    'weekEnd', v_current_week_end
  );
END;
$function$;