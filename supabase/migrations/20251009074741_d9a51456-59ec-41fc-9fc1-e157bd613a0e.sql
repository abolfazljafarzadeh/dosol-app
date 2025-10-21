-- Update rpc_log_practice to calculate and update user level
-- Level algorithm: Every 100 XP = 1 level

CREATE OR REPLACE FUNCTION public.rpc_log_practice(
  p_user_id uuid,
  p_minutes integer,
  p_note text,
  p_idempotency_key text,
  p_now_utc timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE 
  v_user_tz TEXT; 
  v_local_date DATE; 
  v_today_logs INTEGER; 
  v_today_minutes INTEGER; 
  v_existing_log RECORD; 
  v_new_log_id UUID; 
  v_xp_today_before INTEGER;
  v_xp_gained INTEGER; 
  v_xp_today_after INTEGER; 
  v_xp_total INTEGER; 
  v_current_streak INTEGER; 
  v_best_streak INTEGER; 
  v_yesterday_str DATE; 
  v_last_active_date DATE;
  v_league_id UUID; 
  v_league_status league_status; 
  v_league_xp_week INTEGER; 
  v_first_practice_medal_id UUID; 
  v_daily_cap_medal_id UUID; 
  v_practice_count INTEGER;
  v_new_level INTEGER;
BEGIN
  -- Get user timezone
  SELECT tz INTO v_user_tz FROM public.profiles WHERE id = p_user_id; 
  IF v_user_tz IS NULL THEN 
    v_user_tz := 'Asia/Tehran'; 
  END IF; 
  v_local_date := (p_now_utc AT TIME ZONE v_user_tz)::DATE;
  
  -- Check idempotency
  SELECT pl.id, pl.local_date INTO v_existing_log 
  FROM public.practice_logs pl 
  WHERE pl.idempotency_key = p_idempotency_key 
  LIMIT 1;
  
  IF FOUND THEN
    -- Return cached result
    SELECT COALESCE(SUM(delta), 0) INTO v_xp_today_after 
    FROM public.xp_events 
    WHERE user_id = p_user_id AND local_date = v_existing_log.local_date;
    
    SELECT total_xp INTO v_xp_total FROM public.xp_counters WHERE user_id = p_user_id;
    SELECT current_streak, best_streak INTO v_current_streak, v_best_streak FROM public.streaks WHERE user_id = p_user_id;
    SELECT delta INTO v_xp_gained FROM public.xp_events WHERE user_id = p_user_id AND practice_log_id = v_existing_log.id LIMIT 1;
    
    RETURN jsonb_build_object(
      'ok', true, 
      'xpGained', COALESCE(v_xp_gained, 0), 
      'xpToday', COALESCE(v_xp_today_after, 0), 
      'xpTotal', COALESCE(v_xp_total, 0),
      'streak', jsonb_build_object('current', COALESCE(v_current_streak, 0), 'best', COALESCE(v_best_streak, 0)), 
      'challenge', NULL, 
      'league', NULL
    );
  END IF;
  
  -- Validate input
  IF p_minutes < 5 OR p_minutes > 240 THEN 
    RETURN jsonb_build_object('ok', false, 'code', 'MIN_DURATION', 'message', 'Minutes must be between 5 and 240'); 
  END IF;
  
  -- Check daily limits
  SELECT COUNT(*), COALESCE(SUM(minutes), 0) INTO v_today_logs, v_today_minutes 
  FROM public.practice_logs 
  WHERE user_id = p_user_id AND local_date = v_local_date;
  
  IF v_today_logs >= 2 THEN 
    RETURN jsonb_build_object('ok', false, 'code', 'DAILY_LIMIT', 'message', 'Maximum 2 practice logs per day'); 
  END IF;
  
  IF v_today_minutes + p_minutes > 240 THEN 
    RETURN jsonb_build_object('ok', false, 'code', 'DAILY_LIMIT', 'message', 'Daily minutes limit exceeded (240 max)'); 
  END IF;
  
  -- Insert practice log
  INSERT INTO public.practice_logs (user_id, minutes, note, local_date, practiced_on, idempotency_key) 
  VALUES (p_user_id, p_minutes, p_note, v_local_date, v_local_date, p_idempotency_key) 
  RETURNING id INTO v_new_log_id;
  
  -- Calculate XP (10 XP per 15 minutes, max 160 XP per day)
  SELECT COALESCE(SUM(delta), 0) INTO v_xp_today_before 
  FROM public.xp_events 
  WHERE user_id = p_user_id AND local_date = v_local_date;
  
  v_xp_gained := LEAST((p_minutes / 15) * 10, GREATEST(0, 160 - v_xp_today_before));
  
  -- Insert XP event
  INSERT INTO public.xp_events (user_id, source, delta, practice_log_id, local_date) 
  VALUES (p_user_id, 'practice', v_xp_gained, v_new_log_id, v_local_date); 
  
  v_xp_today_after := v_xp_today_before + v_xp_gained;
  
  -- Update total XP
  INSERT INTO public.xp_counters (user_id, total_xp, updated_at) 
  VALUES (p_user_id, v_xp_gained, p_now_utc)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    total_xp = xp_counters.total_xp + v_xp_gained, 
    updated_at = p_now_utc 
  RETURNING total_xp INTO v_xp_total;
  
  -- Calculate and update level (100 XP per level)
  v_new_level := FLOOR(v_xp_total / 100.0);
  UPDATE public.profiles 
  SET level = v_new_level::text, updated_at = p_now_utc 
  WHERE id = p_user_id;
  
  -- Update streak
  SELECT current_streak, best_streak, last_active_local_date 
  INTO v_current_streak, v_best_streak, v_last_active_date 
  FROM public.streaks 
  WHERE user_id = p_user_id; 
  
  v_yesterday_str := v_local_date - INTERVAL '1 day';
  
  IF v_last_active_date IS NULL THEN 
    v_current_streak := 1; 
    v_best_streak := 1; 
  ELSIF v_last_active_date = v_local_date THEN 
    NULL;
  ELSIF v_last_active_date = v_yesterday_str THEN 
    v_current_streak := v_current_streak + 1; 
    v_best_streak := GREATEST(v_best_streak, v_current_streak); 
  ELSE 
    v_current_streak := 1; 
  END IF;
  
  INSERT INTO public.streaks (user_id, current_streak, best_streak, last_active_local_date, updated_at) 
  VALUES (p_user_id, v_current_streak, v_best_streak, v_local_date, p_now_utc)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    current_streak = v_current_streak, 
    best_streak = v_best_streak, 
    last_active_local_date = v_local_date, 
    updated_at = p_now_utc;
  
  -- Award medals
  SELECT COUNT(*) INTO v_practice_count FROM public.practice_logs WHERE user_id = p_user_id;
  
  IF v_practice_count = 1 THEN 
    SELECT id INTO v_first_practice_medal_id FROM public.medals WHERE code = 'first_practice' LIMIT 1;
    IF v_first_practice_medal_id IS NOT NULL THEN 
      INSERT INTO public.user_medals (user_id, medal_id, earned_at) 
      VALUES (p_user_id, v_first_practice_medal_id, p_now_utc) 
      ON CONFLICT (user_id, medal_id) DO NOTHING; 
    END IF;
  END IF;
  
  IF v_xp_today_after >= 160 THEN 
    SELECT id INTO v_daily_cap_medal_id FROM public.medals WHERE code = 'daily_cap_reached' LIMIT 1;
    IF v_daily_cap_medal_id IS NOT NULL THEN 
      INSERT INTO public.user_medals (user_id, medal_id, earned_at) 
      VALUES (p_user_id, v_daily_cap_medal_id, p_now_utc) 
      ON CONFLICT (user_id, medal_id) DO NOTHING; 
    END IF;
  END IF;
  
  -- Update league scores
  SELECT lm.league_id, wl.status INTO v_league_id, v_league_status 
  FROM public.league_members lm 
  JOIN public.weekly_leagues wl ON wl.id = lm.league_id 
  WHERE lm.user_id = p_user_id 
  LIMIT 1;
  
  IF v_league_id IS NOT NULL THEN
    IF v_league_status = 'locked' OR v_league_status = 'finalized' THEN 
      RETURN jsonb_build_object('ok', false, 'code', 'LEAGUE_LOCKED', 'message', 'این لیگ بسته شده و نمی‌توانید امتیاز اضافه کنید.'); 
    END IF;
    
    UPDATE public.league_scores 
    SET xp_week = xp_week + v_xp_gained 
    WHERE user_id = p_user_id AND league_id = v_league_id 
    RETURNING xp_week INTO v_league_xp_week;
  END IF;
  
  -- Evaluate challenges
  PERFORM public.rpc_evaluate_challenges(p_user_id, v_local_date, v_user_tz);
  
  -- Return result
  RETURN jsonb_build_object(
    'ok', true, 
    'xpGained', v_xp_gained, 
    'xpToday', v_xp_today_after, 
    'xpTotal', v_xp_total,
    'level', v_new_level,
    'streak', jsonb_build_object('current', v_current_streak, 'best', v_best_streak), 
    'challenge', NULL,
    'league', CASE 
      WHEN v_league_id IS NOT NULL THEN jsonb_build_object('id', v_league_id, 'xpWeek', v_league_xp_week, 'rank', NULL) 
      ELSE NULL 
    END
  );
END; 
$$;