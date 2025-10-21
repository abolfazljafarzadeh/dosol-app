
-- ================================================================
-- Add condition field to medals table
-- ================================================================
ALTER TABLE public.medals 
ADD COLUMN IF NOT EXISTS condition JSONB DEFAULT NULL;

-- Add reward field to medals table
ALTER TABLE public.medals 
ADD COLUMN IF NOT EXISTS reward JSONB DEFAULT NULL;

-- Update existing medals with proper conditions and rewards
UPDATE public.medals SET 
  condition = jsonb_build_object('type', 'xp_total', 'threshold', 1000),
  reward = jsonb_build_object('xp', 50)
WHERE code = 'xp-1000';

UPDATE public.medals SET 
  condition = jsonb_build_object('type', 'xp_total', 'threshold', 5000),
  reward = jsonb_build_object('xp', 100)
WHERE code = 'xp-5000';

UPDATE public.medals SET 
  condition = jsonb_build_object('type', 'streak_days', 'threshold', 7),
  reward = jsonb_build_object('xp', 30)
WHERE code = 'streak-7';

UPDATE public.medals SET 
  condition = jsonb_build_object('type', 'streak_days', 'threshold', 30),
  reward = jsonb_build_object('xp', 100)
WHERE code = 'streak-30';

UPDATE public.medals SET 
  condition = jsonb_build_object('type', 'league_rank', 'threshold', 1),
  reward = jsonb_build_object('xp', 200)
WHERE code = 'league-first';

UPDATE public.medals SET 
  condition = jsonb_build_object('type', 'league_rank', 'threshold', 2),
  reward = jsonb_build_object('xp', 150)
WHERE code = 'league-second';

UPDATE public.medals SET 
  condition = jsonb_build_object('type', 'league_rank', 'threshold', 3),
  reward = jsonb_build_object('xp', 100)
WHERE code = 'league-third';

-- ================================================================
-- Update rpc_get_achievements with new level formula (N * 500)
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
  v_current_streak INT;
  v_best_streak INT;
BEGIN
  -- Get total XP
  SELECT COALESCE(total_xp, 0) INTO v_total_xp
  FROM public.xp_counters
  WHERE user_id = p_user_id;

  -- Calculate level using formula: Level N requires N * 500 XP
  -- Level 1: 0-499, Level 2: 500-999, Level 3: 1000-1499, etc.
  v_current_level := FLOOR(v_total_xp / 500.0) + 1;
  
  -- Calculate XP needed for next level
  v_xp_for_next_level := v_current_level * 500;
  
  -- XP in current level
  v_xp_in_current_level := v_total_xp - ((v_current_level - 1) * 500);
  
  -- Progress percentage
  v_progress_percent := FLOOR((v_xp_in_current_level::FLOAT / 500.0) * 100);

  -- Get streaks
  SELECT COALESCE(current_streak, 0), COALESCE(best_streak, 0)
  INTO v_current_streak, v_best_streak
  FROM public.streaks
  WHERE user_id = p_user_id;

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
      'progressPercent', LEAST(100, GREATEST(0, v_progress_percent))
    ),
    'streak', jsonb_build_object(
      'current', v_current_streak,
      'best', v_best_streak
    ),
    'badges', COALESCE(v_badges, '[]'::jsonb),
    'league', v_league
  );
END;
$function$;

-- ================================================================
-- Create check_achievements function
-- ================================================================
CREATE OR REPLACE FUNCTION public.check_achievements(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_medal RECORD;
  v_total_xp INT;
  v_current_streak INT;
  v_best_streak INT;
  v_practice_count INT;
  v_challenge_count INT;
  v_user_tz TEXT;
  v_local_date DATE;
  v_xp_reward INT;
BEGIN
  -- Get user stats
  SELECT COALESCE(total_xp, 0) INTO v_total_xp
  FROM public.xp_counters WHERE user_id = p_user_id;
  
  SELECT COALESCE(current_streak, 0), COALESCE(best_streak, 0)
  INTO v_current_streak, v_best_streak
  FROM public.streaks WHERE user_id = p_user_id;
  
  SELECT COUNT(*) INTO v_practice_count
  FROM public.practice_logs WHERE user_id = p_user_id;
  
  SELECT COUNT(*) INTO v_challenge_count
  FROM public.user_challenge_progress 
  WHERE user_id = p_user_id AND is_completed = true;
  
  -- Get user timezone for notifications
  SELECT tz INTO v_user_tz FROM public.profiles WHERE id = p_user_id;
  IF v_user_tz IS NULL THEN v_user_tz := 'Asia/Tehran'; END IF;
  v_local_date := (NOW() AT TIME ZONE v_user_tz)::DATE;

  -- Check all medals that user hasn't earned yet
  FOR v_medal IN
    SELECT m.id, m.code, m.title, m.condition, m.reward
    FROM public.medals m
    WHERE m.condition IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.user_medals um 
        WHERE um.user_id = p_user_id AND um.medal_id = m.id
      )
  LOOP
    DECLARE
      v_condition_type TEXT := v_medal.condition->>'type';
      v_threshold INT := (v_medal.condition->>'threshold')::INT;
      v_earned BOOLEAN := false;
    BEGIN
      -- Check condition based on type
      IF v_condition_type = 'xp_total' THEN
        v_earned := v_total_xp >= v_threshold;
      ELSIF v_condition_type = 'streak_days' THEN
        v_earned := v_best_streak >= v_threshold;
      ELSIF v_condition_type = 'practice_count' THEN
        v_earned := v_practice_count >= v_threshold;
      ELSIF v_condition_type = 'challenge_completed' THEN
        v_earned := v_challenge_count >= v_threshold;
      END IF;

      -- Award medal if condition met
      IF v_earned THEN
        -- Insert medal
        INSERT INTO public.user_medals (user_id, medal_id, earned_at)
        VALUES (p_user_id, v_medal.id, NOW())
        ON CONFLICT (user_id, medal_id) DO NOTHING;
        
        -- Award XP reward if exists
        IF v_medal.reward IS NOT NULL AND v_medal.reward->>'xp' IS NOT NULL THEN
          v_xp_reward := (v_medal.reward->>'xp')::INT;
          
          INSERT INTO public.xp_events (user_id, source, delta, local_date)
          VALUES (p_user_id, 'medal:' || v_medal.code, v_xp_reward, v_local_date);
          
          UPDATE public.xp_counters 
          SET total_xp = total_xp + v_xp_reward, updated_at = NOW()
          WHERE user_id = p_user_id;
        END IF;
        
        -- Create notification
        INSERT INTO public.notifications (user_id, type, status, payload, created_at)
        VALUES (
          p_user_id, 
          'medal_unlocked', 
          'queued',
          jsonb_build_object(
            'medal_code', v_medal.code,
            'medal_title', v_medal.title,
            'xp_reward', COALESCE(v_xp_reward, 0)
          ),
          NOW()
        );
        
        RAISE NOTICE '🏅 Medal awarded: % to user %', v_medal.code, p_user_id;
      END IF;
    END;
  END LOOP;
END;
$function$;

-- ================================================================
-- Update rpc_log_practice to call check_achievements
-- ================================================================
CREATE OR REPLACE FUNCTION public.rpc_log_practice(
  p_user_id UUID,
  p_minutes INT,
  p_note TEXT,
  p_idempotency_key TEXT,
  p_now_utc TIMESTAMP WITH TIME ZONE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  IF v_user_tz IS NULL THEN v_user_tz := 'Asia/Tehran'; END IF; 
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
  
  -- Calculate and update level (500 XP per level)
  v_new_level := FLOOR(v_xp_total / 500.0) + 1;
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
  
  -- Check and award achievements
  PERFORM public.check_achievements(p_user_id);
  
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
$function$;
