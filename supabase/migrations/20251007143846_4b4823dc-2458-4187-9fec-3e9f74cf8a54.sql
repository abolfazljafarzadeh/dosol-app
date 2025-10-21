-- Improve RPC claim idempotency and logging

-- Add logging to evaluate_challenges (lightweight)
CREATE OR REPLACE FUNCTION public.rpc_evaluate_challenges(p_user_id uuid, p_local_date date, p_user_tz text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
          
          -- Log completion event
          INSERT INTO public.outbox_events (topic, payload)
          VALUES ('challenge.completed', jsonb_build_object(
            'userId', p_user_id,
            'challengeCode', v_instance.challenge_code,
            'instanceId', v_instance.id,
            'completedAt', now(),
            'isClaimable', COALESCE((v_instance.reward->>'claimable')::boolean, false)
          ));

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

        -- Log completion
        INSERT INTO public.outbox_events (topic, payload)
        VALUES ('challenge.completed', jsonb_build_object(
          'userId', p_user_id,
          'challengeCode', v_instance.challenge_code,
          'instanceId', v_instance.id,
          'completedAt', now(),
          'isClaimable', COALESCE((v_instance.reward->>'claimable')::boolean, false)
        ))
        ON CONFLICT DO NOTHING;

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
END; $function$;

-- Add index for performance on challenge queries
CREATE INDEX IF NOT EXISTS idx_challenge_instances_user_status ON public.challenge_instances(user_id, status) WHERE status = 'open';
CREATE INDEX IF NOT EXISTS idx_user_challenge_progress_claimable ON public.user_challenge_progress(user_id, is_claimable) WHERE is_claimable = true AND claimed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_outbox_events_processed ON public.outbox_events(processed, created_at) WHERE NOT processed;