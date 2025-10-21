ALTER TABLE public.challenges DROP COLUMN IF EXISTS prerequisite_code, DROP COLUMN IF EXISTS level, DROP COLUMN IF EXISTS active_week, DROP COLUMN IF EXISTS rules;
ALTER TABLE public.challenges
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'periodic' CHECK (kind IN ('periodic', 'rolling')),
  ADD COLUMN IF NOT EXISTS period text CHECK (period IN ('week', 'month', 'none')),
  ADD COLUMN IF NOT EXISTS auto_enroll boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS conditions jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS unlock jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive'));

CREATE TABLE IF NOT EXISTS public.challenge_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), challenge_code text NOT NULL REFERENCES public.challenges(code) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE, window_start date, window_end date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'finalized')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (challenge_code, user_id, window_start)
);
CREATE INDEX IF NOT EXISTS idx_challenge_instances_user ON public.challenge_instances(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_instances_code_status ON public.challenge_instances(challenge_code, status);
ALTER TABLE public.challenge_instances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own challenge instances" ON public.challenge_instances;
CREATE POLICY "Users can view own challenge instances" ON public.challenge_instances FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);

CREATE TABLE IF NOT EXISTS public.user_challenge_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  instance_id uuid NOT NULL REFERENCES public.challenge_instances(id) ON DELETE CASCADE, progress jsonb NOT NULL DEFAULT '{}',
  is_completed boolean NOT NULL DEFAULT false, completed_at timestamptz, is_claimable boolean NOT NULL DEFAULT false,
  claimed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE (user_id, instance_id)
);
CREATE INDEX IF NOT EXISTS idx_user_challenge_progress_user ON public.user_challenge_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_challenge_progress_claimable ON public.user_challenge_progress(user_id, is_claimable) WHERE is_claimable = true;
ALTER TABLE public.user_challenge_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own challenge progress" ON public.user_challenge_progress;
CREATE POLICY "Users can view own challenge progress" ON public.user_challenge_progress FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.rpc_evaluate_challenges(p_user_id uuid, p_local_date date, p_user_tz text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_instance RECORD; v_progress jsonb; v_days_done int; v_days_marked jsonb; v_current_streak int; v_is_new_day boolean;
BEGIN
  FOR v_instance IN SELECT ci.id, ci.challenge_code, c.conditions, c.reward, c.unlock, COALESCE(ucp.progress, '{}'::jsonb) as progress
    FROM public.challenge_instances ci JOIN public.challenges c ON c.code = ci.challenge_code
    LEFT JOIN public.user_challenge_progress ucp ON ucp.instance_id = ci.id AND ucp.user_id = p_user_id
    WHERE ci.user_id = p_user_id AND ci.status = 'open' AND c.status = 'active'
      AND (ci.window_start IS NULL OR p_local_date >= ci.window_start) AND (ci.window_end IS NULL OR p_local_date <= ci.window_end)
      AND (ucp.is_completed IS NULL OR ucp.is_completed = false)
  LOOP
    v_progress := v_instance.progress;
    IF v_instance.conditions->>'type' = 'days_in_period' THEN
      v_days_marked := COALESCE(v_progress->'days_marked', '[]'::jsonb); v_is_new_day := NOT (v_days_marked ? p_local_date::text);
      IF v_is_new_day THEN
        v_days_done := COALESCE((v_progress->>'days_done')::int, 0) + 1; v_days_marked := v_days_marked || jsonb_build_array(p_local_date);
        v_progress := jsonb_build_object('days_done', v_days_done, 'days_marked', v_days_marked);
        IF v_days_done >= (v_instance.conditions->>'min_days')::int THEN
          INSERT INTO public.user_challenge_progress (user_id, instance_id, progress, is_completed, completed_at, is_claimable)
          VALUES (p_user_id, v_instance.id, v_progress, true, now(), COALESCE((v_instance.reward->>'claimable')::boolean, false))
          ON CONFLICT (user_id, instance_id) DO UPDATE SET progress = v_progress, is_completed = true, completed_at = now(),
            is_claimable = COALESCE((v_instance.reward->>'claimable')::boolean, false), updated_at = now();
          IF NOT COALESCE((v_instance.reward->>'claimable')::boolean, false) THEN
            INSERT INTO public.xp_events (user_id, source, delta, local_date) VALUES (p_user_id, 'challenge:' || v_instance.challenge_code, (v_instance.reward->>'xp')::int, p_local_date);
            UPDATE public.xp_counters SET total_xp = total_xp + (v_instance.reward->>'xp')::int, updated_at = now() WHERE user_id = p_user_id;
            IF v_instance.reward->>'badge_code' IS NOT NULL THEN
              INSERT INTO public.user_medals (user_id, medal_id, earned_at) SELECT p_user_id, m.id, now() FROM public.medals m WHERE m.code = v_instance.reward->>'badge_code'
              ON CONFLICT (user_id, medal_id) DO NOTHING;
            END IF;
            UPDATE public.user_challenge_progress SET claimed_at = now() WHERE user_id = p_user_id AND instance_id = v_instance.id;
          END IF;
          IF v_instance.unlock IS NOT NULL AND v_instance.unlock->'on_complete_unlock_codes' IS NOT NULL THEN
            INSERT INTO public.challenge_instances (challenge_code, user_id, window_start, window_end, status)
            SELECT unlock_code::text, p_user_id,
              CASE WHEN c2.kind = 'periodic' AND c2.period = 'month' THEN date_trunc('month', now() AT TIME ZONE p_user_tz)::date
                   WHEN c2.kind = 'periodic' AND c2.period = 'week' THEN (now() AT TIME ZONE p_user_tz)::date - ((EXTRACT(DOW FROM (now() AT TIME ZONE p_user_tz)::date)::int + 1) % 7) ELSE NULL END,
              CASE WHEN c2.kind = 'periodic' AND c2.period = 'month' THEN (date_trunc('month', now() AT TIME ZONE p_user_tz) + interval '1 month' - interval '1 day')::date
                   WHEN c2.kind = 'periodic' AND c2.period = 'week' THEN (now() AT TIME ZONE p_user_tz)::date - ((EXTRACT(DOW FROM (now() AT TIME ZONE p_user_tz)::date)::int + 1) % 7) + 6 ELSE NULL END, 'open'
            FROM jsonb_array_elements_text(v_instance.unlock->'on_complete_unlock_codes') AS unlock_code
            JOIN public.challenges c2 ON c2.code = unlock_code::text ON CONFLICT (challenge_code, user_id, window_start) DO NOTHING;
          END IF;
        ELSE
          INSERT INTO public.user_challenge_progress (user_id, instance_id, progress) VALUES (p_user_id, v_instance.id, v_progress)
          ON CONFLICT (user_id, instance_id) DO UPDATE SET progress = v_progress, updated_at = now();
        END IF;
      END IF;
    ELSIF v_instance.conditions->>'type' = 'streak' THEN
      SELECT current_streak INTO v_current_streak FROM public.streaks WHERE user_id = p_user_id;
      v_progress := jsonb_build_object('current', COALESCE(v_current_streak, 0));
      IF COALESCE(v_current_streak, 0) >= (v_instance.conditions->>'min_days')::int THEN
        INSERT INTO public.user_challenge_progress (user_id, instance_id, progress, is_completed, completed_at, is_claimable)
        VALUES (p_user_id, v_instance.id, v_progress, true, now(), COALESCE((v_instance.reward->>'claimable')::boolean, false))
        ON CONFLICT (user_id, instance_id) DO UPDATE SET progress = v_progress, is_completed = true, completed_at = now(),
          is_claimable = COALESCE((v_instance.reward->>'claimable')::boolean, false), updated_at = now() WHERE NOT user_challenge_progress.is_completed;
        IF NOT COALESCE((v_instance.reward->>'claimable')::boolean, false) THEN
          IF NOT EXISTS (SELECT 1 FROM public.user_challenge_progress WHERE user_id = p_user_id AND instance_id = v_instance.id AND claimed_at IS NOT NULL) THEN
            INSERT INTO public.xp_events (user_id, source, delta, local_date) VALUES (p_user_id, 'challenge:' || v_instance.challenge_code, (v_instance.reward->>'xp')::int, p_local_date);
            UPDATE public.xp_counters SET total_xp = total_xp + (v_instance.reward->>'xp')::int, updated_at = now() WHERE user_id = p_user_id;
            IF v_instance.reward->>'badge_code' IS NOT NULL THEN
              INSERT INTO public.user_medals (user_id, medal_id, earned_at) SELECT p_user_id, m.id, now() FROM public.medals m WHERE m.code = v_instance.reward->>'badge_code'
              ON CONFLICT (user_id, medal_id) DO NOTHING;
            END IF;
            UPDATE public.user_challenge_progress SET claimed_at = now() WHERE user_id = p_user_id AND instance_id = v_instance.id;
          END IF;
        END IF;
      ELSE
        INSERT INTO public.user_challenge_progress (user_id, instance_id, progress) VALUES (p_user_id, v_instance.id, v_progress)
        ON CONFLICT (user_id, instance_id) DO UPDATE SET progress = v_progress, updated_at = now();
      END IF;
    END IF;
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_log_practice(p_user_id uuid, p_minutes integer, p_note text, p_idempotency_key text, p_now_utc timestamp with time zone)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $function$
DECLARE v_user_tz TEXT; v_local_date DATE; v_today_logs INTEGER; v_today_minutes INTEGER; v_existing_log RECORD; v_new_log_id UUID; v_xp_today_before INTEGER;
  v_xp_gained INTEGER; v_xp_today_after INTEGER; v_xp_total INTEGER; v_current_streak INTEGER; v_best_streak INTEGER; v_yesterday_str DATE; v_last_active_date DATE;
  v_league_id UUID; v_league_status league_status; v_league_xp_week INTEGER; v_first_practice_medal_id UUID; v_daily_cap_medal_id UUID; v_practice_count INTEGER;
BEGIN
  SELECT tz INTO v_user_tz FROM public.profiles WHERE id = p_user_id; IF v_user_tz IS NULL THEN v_user_tz := 'Asia/Tehran'; END IF; v_local_date := (p_now_utc AT TIME ZONE v_user_tz)::DATE;
  SELECT pl.id, pl.local_date INTO v_existing_log FROM public.practice_logs pl WHERE pl.idempotency_key = p_idempotency_key LIMIT 1;
  IF FOUND THEN
    SELECT COALESCE(SUM(delta), 0) INTO v_xp_today_after FROM public.xp_events WHERE user_id = p_user_id AND local_date = v_existing_log.local_date;
    SELECT total_xp INTO v_xp_total FROM public.xp_counters WHERE user_id = p_user_id;
    SELECT current_streak, best_streak INTO v_current_streak, v_best_streak FROM public.streaks WHERE user_id = p_user_id;
    SELECT delta INTO v_xp_gained FROM public.xp_events WHERE user_id = p_user_id AND practice_log_id = v_existing_log.id LIMIT 1;
    RETURN jsonb_build_object('ok', true, 'xpGained', COALESCE(v_xp_gained, 0), 'xpToday', COALESCE(v_xp_today_after, 0), 'xpTotal', COALESCE(v_xp_total, 0),
      'streak', jsonb_build_object('current', COALESCE(v_current_streak, 0), 'best', COALESCE(v_best_streak, 0)), 'challenge', NULL, 'league', NULL);
  END IF;
  IF p_minutes < 5 OR p_minutes > 240 THEN RETURN jsonb_build_object('ok', false, 'code', 'MIN_DURATION', 'message', 'Minutes must be between 5 and 240'); END IF;
  SELECT COUNT(*), COALESCE(SUM(minutes), 0) INTO v_today_logs, v_today_minutes FROM public.practice_logs WHERE user_id = p_user_id AND local_date = v_local_date;
  IF v_today_logs >= 2 THEN RETURN jsonb_build_object('ok', false, 'code', 'DAILY_LIMIT', 'message', 'Maximum 2 practice logs per day'); END IF;
  IF v_today_minutes + p_minutes > 240 THEN RETURN jsonb_build_object('ok', false, 'code', 'DAILY_LIMIT', 'message', 'Daily minutes limit exceeded (240 max)'); END IF;
  INSERT INTO public.practice_logs (user_id, minutes, note, local_date, practiced_on, idempotency_key) VALUES (p_user_id, p_minutes, p_note, v_local_date, v_local_date, p_idempotency_key) RETURNING id INTO v_new_log_id;
  SELECT COALESCE(SUM(delta), 0) INTO v_xp_today_before FROM public.xp_events WHERE user_id = p_user_id AND local_date = v_local_date;
  v_xp_gained := LEAST((p_minutes / 15) * 10, GREATEST(0, 160 - v_xp_today_before));
  INSERT INTO public.xp_events (user_id, source, delta, practice_log_id, local_date) VALUES (p_user_id, 'practice', v_xp_gained, v_new_log_id, v_local_date); v_xp_today_after := v_xp_today_before + v_xp_gained;
  INSERT INTO public.xp_counters (user_id, total_xp, updated_at) VALUES (p_user_id, v_xp_gained, p_now_utc)
  ON CONFLICT (user_id) DO UPDATE SET total_xp = xp_counters.total_xp + v_xp_gained, updated_at = p_now_utc RETURNING total_xp INTO v_xp_total;
  SELECT current_streak, best_streak, last_active_local_date INTO v_current_streak, v_best_streak, v_last_active_date FROM public.streaks WHERE user_id = p_user_id; v_yesterday_str := v_local_date - INTERVAL '1 day';
  IF v_last_active_date IS NULL THEN v_current_streak := 1; v_best_streak := 1; ELSIF v_last_active_date = v_local_date THEN NULL;
  ELSIF v_last_active_date = v_yesterday_str THEN v_current_streak := v_current_streak + 1; v_best_streak := GREATEST(v_best_streak, v_current_streak); ELSE v_current_streak := 1; END IF;
  INSERT INTO public.streaks (user_id, current_streak, best_streak, last_active_local_date, updated_at) VALUES (p_user_id, v_current_streak, v_best_streak, v_local_date, p_now_utc)
  ON CONFLICT (user_id) DO UPDATE SET current_streak = v_current_streak, best_streak = v_best_streak, last_active_local_date = v_local_date, updated_at = p_now_utc;
  SELECT COUNT(*) INTO v_practice_count FROM public.practice_logs WHERE user_id = p_user_id;
  IF v_practice_count = 1 THEN SELECT id INTO v_first_practice_medal_id FROM public.medals WHERE code = 'first_practice' LIMIT 1;
    IF v_first_practice_medal_id IS NOT NULL THEN INSERT INTO public.user_medals (user_id, medal_id, earned_at) VALUES (p_user_id, v_first_practice_medal_id, p_now_utc) ON CONFLICT (user_id, medal_id) DO NOTHING; END IF;
  END IF;
  IF v_xp_today_after >= 160 THEN SELECT id INTO v_daily_cap_medal_id FROM public.medals WHERE code = 'daily_cap_reached' LIMIT 1;
    IF v_daily_cap_medal_id IS NOT NULL THEN INSERT INTO public.user_medals (user_id, medal_id, earned_at) VALUES (p_user_id, v_daily_cap_medal_id, p_now_utc) ON CONFLICT (user_id, medal_id) DO NOTHING; END IF;
  END IF;
  SELECT lm.league_id, wl.status INTO v_league_id, v_league_status FROM public.league_members lm JOIN public.weekly_leagues wl ON wl.id = lm.league_id WHERE lm.user_id = p_user_id LIMIT 1;
  IF v_league_id IS NOT NULL THEN
    IF v_league_status = 'locked' OR v_league_status = 'finalized' THEN RETURN jsonb_build_object('ok', false, 'code', 'LEAGUE_LOCKED', 'message', 'این لیگ بسته شده و نمی‌توانید امتیاز اضافه کنید.'); END IF;
    UPDATE public.league_scores SET xp_week = xp_week + v_xp_gained WHERE user_id = p_user_id AND league_id = v_league_id RETURNING xp_week INTO v_league_xp_week;
  END IF;
  PERFORM public.rpc_evaluate_challenges(p_user_id, v_local_date, v_user_tz);
  RETURN jsonb_build_object('ok', true, 'xpGained', v_xp_gained, 'xpToday', v_xp_today_after, 'xpTotal', v_xp_total,
    'streak', jsonb_build_object('current', v_current_streak, 'best', v_best_streak), 'challenge', NULL,
    'league', CASE WHEN v_league_id IS NOT NULL THEN jsonb_build_object('id', v_league_id, 'xpWeek', v_league_xp_week, 'rank', NULL) ELSE NULL END);
END; $function$;

CREATE OR REPLACE FUNCTION public.rpc_get_challenges_view(p_user_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_user_tz TEXT; v_today DATE; v_active jsonb; v_claimable jsonb; v_upcoming jsonb;
BEGIN
  SELECT tz INTO v_user_tz FROM public.profiles WHERE id = p_user_id; IF v_user_tz IS NULL THEN v_user_tz := 'Asia/Tehran'; END IF; v_today := (now() AT TIME ZONE v_user_tz)::date;
  SELECT jsonb_agg(jsonb_build_object('code', c.code, 'title', c.title, 'kind', c.kind, 'type', c.conditions->>'type', 'targetDays', (c.conditions->>'min_days')::int,
    'daysDone', COALESCE((ucp.progress->>'days_done')::int, 0), 'current', COALESCE((ucp.progress->>'current')::int, 0), 'status', ci.status,
    'isCompleted', COALESCE(ucp.is_completed, false), 'isClaimable', COALESCE(ucp.is_claimable, false), 'windowStart', ci.window_start, 'windowEnd', ci.window_end)) INTO v_active
  FROM public.challenge_instances ci JOIN public.challenges c ON c.code = ci.challenge_code
  LEFT JOIN public.user_challenge_progress ucp ON ucp.instance_id = ci.id AND ucp.user_id = p_user_id
  WHERE ci.user_id = p_user_id AND ci.status = 'open' AND c.status = 'active' AND (ci.window_start IS NULL OR v_today >= ci.window_start) AND (ci.window_end IS NULL OR v_today <= ci.window_end)
    AND (ucp.is_completed IS NULL OR ucp.is_completed = false);
  SELECT jsonb_agg(jsonb_build_object('code', c.code, 'title', c.title, 'instanceId', ci.id, 'reward', c.reward, 'completedAt', ucp.completed_at)) INTO v_claimable
  FROM public.challenge_instances ci JOIN public.challenges c ON c.code = ci.challenge_code JOIN public.user_challenge_progress ucp ON ucp.instance_id = ci.id AND ucp.user_id = p_user_id
  WHERE ci.user_id = p_user_id AND ucp.is_claimable = true AND ucp.claimed_at IS NULL;
  SELECT jsonb_agg(jsonb_build_object('code', c.code, 'title', c.title, 'kind', c.kind, 'period', c.period, 'windowStart', ci.window_start, 'windowEnd', ci.window_end)) INTO v_upcoming
  FROM public.challenge_instances ci JOIN public.challenges c ON c.code = ci.challenge_code WHERE ci.user_id = p_user_id AND ci.window_start > v_today AND c.status = 'active';
  RETURN jsonb_build_object('ok', true, 'active', COALESCE(v_active, '[]'::jsonb), 'claimable', COALESCE(v_claimable, '[]'::jsonb), 'upcoming', COALESCE(v_upcoming, '[]'::jsonb),
    'currentWeek', jsonb_build_object('start', v_today - ((EXTRACT(DOW FROM v_today)::int + 1) % 7), 'end', v_today - ((EXTRACT(DOW FROM v_today)::int + 1) % 7) + 6));
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_claim_challenge_reward(p_user_id uuid, p_instance_id uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_user_tz TEXT; v_local_date DATE; v_progress RECORD; v_xp_awarded int; v_badge_granted boolean := false;
BEGIN
  SELECT tz INTO v_user_tz FROM public.profiles WHERE id = p_user_id; IF v_user_tz IS NULL THEN v_user_tz := 'Asia/Tehran'; END IF; v_local_date := (now() AT TIME ZONE v_user_tz)::date;
  SELECT ucp.is_completed, ucp.is_claimable, ucp.claimed_at, c.reward, c.code INTO v_progress FROM public.user_challenge_progress ucp JOIN public.challenge_instances ci ON ci.id = ucp.instance_id
  JOIN public.challenges c ON c.code = ci.challenge_code WHERE ucp.user_id = p_user_id AND ucp.instance_id = p_instance_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'Challenge instance not found'); END IF;
  IF NOT v_progress.is_completed THEN RETURN jsonb_build_object('ok', false, 'error', 'Challenge not completed yet'); END IF;
  IF NOT v_progress.is_claimable THEN RETURN jsonb_build_object('ok', false, 'error', 'Challenge rewards are not claimable'); END IF;
  IF v_progress.claimed_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'Rewards already claimed'); END IF;
  v_xp_awarded := (v_progress.reward->>'xp')::int;
  INSERT INTO public.xp_events (user_id, source, delta, local_date) VALUES (p_user_id, 'challenge:' || v_progress.code, v_xp_awarded, v_local_date);
  UPDATE public.xp_counters SET total_xp = total_xp + v_xp_awarded, updated_at = now() WHERE user_id = p_user_id;
  IF v_progress.reward->>'badge_code' IS NOT NULL THEN
    INSERT INTO public.user_medals (user_id, medal_id, earned_at) SELECT p_user_id, m.id, now() FROM public.medals m WHERE m.code = v_progress.reward->>'badge_code'
    ON CONFLICT (user_id, medal_id) DO NOTHING; v_badge_granted := true;
  END IF;
  UPDATE public.user_challenge_progress SET claimed_at = now(), is_claimable = false, updated_at = now() WHERE user_id = p_user_id AND instance_id = p_instance_id;
  RETURN jsonb_build_object('ok', true, 'xpAwarded', v_xp_awarded, 'badgeGranted', v_badge_granted);
END; $$;

CREATE OR REPLACE FUNCTION public.rpc_challenge_rollover_periodic() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_tz TEXT := 'Asia/Tehran'; v_today DATE; v_week_start DATE; v_week_end DATE; v_month_start DATE; v_month_end DATE;
BEGIN
  v_today := (now() AT TIME ZONE v_tz)::date; v_week_start := v_today - ((EXTRACT(DOW FROM v_today)::int + 1) % 7); v_week_end := v_week_start + 6;
  v_month_start := date_trunc('month', v_today)::date; v_month_end := (date_trunc('month', v_today) + interval '1 month' - interval '1 day')::date;
  UPDATE public.challenge_instances SET status = 'locked', updated_at = now() WHERE status = 'open' AND window_end < v_today AND EXISTS (
    SELECT 1 FROM public.challenges c WHERE c.code = challenge_instances.challenge_code AND c.kind = 'periodic');
  INSERT INTO public.challenge_instances (challenge_code, user_id, window_start, window_end, status)
  SELECT c.code, p.id, v_week_start, v_week_end, 'open' FROM public.challenges c CROSS JOIN public.profiles p
  WHERE c.kind = 'periodic' AND c.period = 'week' AND c.status = 'active' AND c.auto_enroll = true ON CONFLICT (challenge_code, user_id, window_start) DO NOTHING;
  INSERT INTO public.challenge_instances (challenge_code, user_id, window_start, window_end, status)
  SELECT c.code, p.id, v_month_start, v_month_end, 'open' FROM public.challenges c CROSS JOIN public.profiles p
  WHERE c.kind = 'periodic' AND c.period = 'month' AND c.status = 'active' AND c.auto_enroll = true ON CONFLICT (challenge_code, user_id, window_start) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'weekStart', v_week_start, 'weekEnd', v_week_end, 'monthStart', v_month_start, 'monthEnd', v_month_end);
END; $$;

INSERT INTO public.challenges (code, title, kind, period, auto_enroll, conditions, reward, unlock, status)
VALUES
  ('weekly_5of7', 'چالش هفتگی ۵ از ۷', 'periodic', 'week', true, '{"type":"days_in_period","min_days":5,"period":"week"}'::jsonb,
   '{"xp":100,"badge_code":"weekly_challenge","claimable":false}'::jsonb, NULL, 'active'),
  ('streak_10_days', 'استمرار ۱۰ روزه', 'rolling', 'none', true, '{"type":"streak","min_days":10,"source":"practice"}'::jsonb,
   '{"xp":150,"badge_code":"streak_10","claimable":false}'::jsonb, '{"on_complete_unlock_codes":["monthly_champion"]}'::jsonb, 'active'),
  ('monthly_champion', 'قهرمان ماه', 'periodic', 'month', false, '{"type":"days_in_period","min_days":20,"period":"month"}'::jsonb,
   '{"xp":300,"badge_code":"monthly_champion","claimable":true}'::jsonb, NULL, 'active')
ON CONFLICT (code) DO UPDATE SET title = EXCLUDED.title, kind = EXCLUDED.kind, period = EXCLUDED.period,
  auto_enroll = EXCLUDED.auto_enroll, conditions = EXCLUDED.conditions, reward = EXCLUDED.reward, unlock = EXCLUDED.unlock, status = EXCLUDED.status;

INSERT INTO public.challenge_instances (challenge_code, user_id, window_start, window_end, status)
SELECT 'weekly_5of7', p.id, (now() AT TIME ZONE 'Asia/Tehran')::date - ((EXTRACT(DOW FROM (now() AT TIME ZONE 'Asia/Tehran')::date)::int + 1) % 7),
  (now() AT TIME ZONE 'Asia/Tehran')::date - ((EXTRACT(DOW FROM (now() AT TIME ZONE 'Asia/Tehran')::date)::int + 1) % 7) + 6, 'open'
FROM public.profiles p ON CONFLICT (challenge_code, user_id, window_start) DO NOTHING;

INSERT INTO public.challenge_instances (challenge_code, user_id, window_start, window_end, status)
SELECT 'streak_10_days', p.id, NULL, NULL, 'open' FROM public.profiles p ON CONFLICT (challenge_code, user_id, window_start) DO NOTHING;