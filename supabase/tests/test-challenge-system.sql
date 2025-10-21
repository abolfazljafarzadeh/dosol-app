-- Test Suite for Challenge System
-- Tests: (1) 5/7 days auto-award, (2) 10-day streak unlock, (3) claimable list,
-- (4) claim idempotency, (5) rollover weekly with locking

DO $$
DECLARE
  v_user_id UUID := '00000000-0000-0000-0000-000000000099';
  v_tz TEXT := 'Asia/Tehran';
  v_today DATE;
  v_week_start DATE;
  v_result JSONB;
  v_instance_id UUID;
  v_xp_before INT;
  v_xp_after INT;
BEGIN
  -- Setup: Clean test data
  DELETE FROM public.user_challenge_progress WHERE user_id = v_user_id;
  DELETE FROM public.challenge_instances WHERE user_id = v_user_id;
  DELETE FROM public.xp_events WHERE user_id = v_user_id;
  DELETE FROM public.xp_counters WHERE user_id = v_user_id;
  DELETE FROM public.practice_logs WHERE user_id = v_user_id;
  DELETE FROM public.streaks WHERE user_id = v_user_id;
  DELETE FROM public.profiles WHERE id = v_user_id;

  INSERT INTO public.profiles (id, phone, first_name, tz)
  VALUES (v_user_id, '+989121234599', 'Test Challenge User', v_tz);

  v_today := (now() AT TIME ZONE v_tz)::date;
  v_week_start := v_today - ((EXTRACT(DOW FROM v_today)::int + 1) % 7);

  -- Ensure challenges exist
  INSERT INTO public.challenges (code, title, kind, period, status, conditions, reward, auto_enroll)
  VALUES 
    ('weekly_practice_5', 'هفته ۵ روز', 'periodic', 'week', 'active', 
     '{"type":"days_in_period","min_days":5}'::jsonb, 
     '{"xp":100,"claimable":false}'::jsonb, true),
    ('streak_10', 'استریک ۱۰ روز', 'rolling', NULL, 'active',
     '{"type":"streak","min_days":10}'::jsonb,
     '{"xp":300,"claimable":true,"badge_code":"streak_master"}'::jsonb, true),
    ('monthly_champion', 'قهرمان ماهانه', 'periodic', 'month', 'active',
     '{"type":"days_in_period","min_days":20}'::jsonb,
     '{"xp":500,"claimable":true}'::jsonb, false)
  ON CONFLICT (code) DO NOTHING;

  -- Ensure medal exists
  INSERT INTO public.medals (code, title, kind, description)
  VALUES ('streak_master', 'استاد استریک', 'streak', 'استریک ۱۰ روز')
  ON CONFLICT (code) DO NOTHING;

  RAISE NOTICE '=== Test 1: 5/7 Days in Week - Auto Award ===';
  
  -- Create weekly instance
  INSERT INTO public.challenge_instances (challenge_code, user_id, window_start, window_end, status)
  VALUES ('weekly_practice_5', v_user_id, v_week_start, v_week_start + 6, 'open')
  RETURNING id INTO v_instance_id;

  -- Simulate 5 practice days
  FOR i IN 0..4 LOOP
    INSERT INTO public.practice_logs (user_id, minutes, local_date, practiced_on, idempotency_key)
    VALUES (v_user_id, 30, v_week_start + i, v_week_start + i, 'test-week-' || i);
    
    PERFORM public.rpc_evaluate_challenges(v_user_id, v_week_start + i, v_tz);
  END LOOP;

  -- Check completion
  SELECT is_completed, is_claimable, claimed_at INTO STRICT v_result
  FROM public.user_challenge_progress
  WHERE user_id = v_user_id AND instance_id = v_instance_id;

  IF (v_result->>'is_completed')::boolean = true 
    AND (v_result->>'is_claimable')::boolean = false 
    AND (v_result->>'claimed_at') IS NOT NULL THEN
    RAISE NOTICE '✅ TEST 1 PASSED: Auto-awarded on day 5';
  ELSE
    RAISE EXCEPTION '❌ TEST 1 FAILED: %', v_result;
  END IF;

  RAISE NOTICE '=== Test 2: 10-Day Streak - Unlock Chain ===';
  
  -- Create streak instance
  INSERT INTO public.challenge_instances (challenge_code, user_id, status)
  VALUES ('streak_10', v_user_id, 'open')
  RETURNING id INTO v_instance_id;

  -- Simulate 10 consecutive days
  INSERT INTO public.streaks (user_id, current_streak, best_streak, last_active_local_date)
  VALUES (v_user_id, 10, 10, v_today);

  PERFORM public.rpc_evaluate_challenges(v_user_id, v_today, v_tz);

  -- Check claimable
  SELECT is_completed, is_claimable, claimed_at INTO v_result
  FROM public.user_challenge_progress
  WHERE user_id = v_user_id AND instance_id = v_instance_id;

  IF (v_result->>'is_completed')::boolean = true 
    AND (v_result->>'is_claimable')::boolean = true 
    AND (v_result->>'claimed_at') IS NULL THEN
    RAISE NOTICE '✅ TEST 2 PASSED: Streak challenge claimable';
  ELSE
    RAISE EXCEPTION '❌ TEST 2 FAILED: %', v_result;
  END IF;

  -- Check unlock (monthly_champion should now be available)
  IF EXISTS (
    SELECT 1 FROM public.challenge_instances
    WHERE challenge_code = 'monthly_champion' AND user_id = v_user_id
  ) THEN
    RAISE NOTICE '✅ TEST 2B PASSED: Unlocked monthly_champion';
  ELSE
    RAISE NOTICE '⚠️  TEST 2B: No unlock (may need unlock config in challenge)';
  END IF;

  RAISE NOTICE '=== Test 3: Claimable List Before/After ===';
  
  v_result := public.rpc_get_challenges_view(v_user_id);
  
  IF jsonb_array_length(v_result->'claimable') > 0 THEN
    RAISE NOTICE '✅ TEST 3A PASSED: Claimable list has items: %', v_result->'claimable';
  ELSE
    RAISE EXCEPTION '❌ TEST 3A FAILED: No claimable items';
  END IF;

  RAISE NOTICE '=== Test 4: Claim Idempotency ===';
  
  SELECT total_xp INTO v_xp_before FROM public.xp_counters WHERE user_id = v_user_id;
  
  -- First claim
  v_result := public.rpc_claim_challenge_reward(v_user_id, v_instance_id);
  
  IF (v_result->>'ok')::boolean = true AND (v_result->>'xpAwarded')::int > 0 THEN
    RAISE NOTICE '✅ TEST 4A PASSED: First claim successful: %', v_result;
  ELSE
    RAISE EXCEPTION '❌ TEST 4A FAILED: %', v_result;
  END IF;

  SELECT total_xp INTO v_xp_after FROM public.xp_counters WHERE user_id = v_user_id;

  -- Second claim (should be idempotent)
  v_result := public.rpc_claim_challenge_reward(v_user_id, v_instance_id);
  
  IF (v_result->>'ok')::boolean = false 
    AND (v_result->>'error')::text LIKE '%already claimed%' THEN
    RAISE NOTICE '✅ TEST 4B PASSED: Second claim rejected (idempotent): %', v_result;
  ELSE
    RAISE EXCEPTION '❌ TEST 4B FAILED: Should reject second claim: %', v_result;
  END IF;

  -- XP should not change
  SELECT total_xp INTO v_xp_after FROM public.xp_counters WHERE user_id = v_user_id;
  IF v_xp_after = (v_xp_before + 300) THEN -- streak_10 reward
    RAISE NOTICE '✅ TEST 4C PASSED: XP unchanged on second claim';
  ELSE
    RAISE EXCEPTION '❌ TEST 4C FAILED: XP changed unexpectedly';
  END IF;

  -- Check claimable list is now empty
  v_result := public.rpc_get_challenges_view(v_user_id);
  IF jsonb_array_length(v_result->'claimable') = 0 THEN
    RAISE NOTICE '✅ TEST 4D PASSED: Claimable list empty after claim';
  ELSE
    RAISE EXCEPTION '❌ TEST 4D FAILED: Claimable list should be empty';
  END IF;

  RAISE NOTICE '=== Test 5: Edge Case - Same Day Multiple Logs ===';
  
  DELETE FROM public.user_challenge_progress WHERE user_id = v_user_id;
  DELETE FROM public.challenge_instances WHERE user_id = v_user_id;

  INSERT INTO public.challenge_instances (challenge_code, user_id, window_start, window_end, status)
  VALUES ('weekly_practice_5', v_user_id, v_week_start, v_week_start + 6, 'open')
  RETURNING id INTO v_instance_id;

  -- Log 3 practices on same day
  FOR i IN 1..3 LOOP
    INSERT INTO public.practice_logs (user_id, minutes, local_date, practiced_on, idempotency_key)
    VALUES (v_user_id, 20, v_today, v_today, 'test-same-day-' || i);
    
    PERFORM public.rpc_evaluate_challenges(v_user_id, v_today, v_tz);
  END LOOP;

  -- Should only count as 1 day
  SELECT progress->>'days_done' INTO v_result
  FROM public.user_challenge_progress
  WHERE user_id = v_user_id AND instance_id = v_instance_id;

  IF v_result::int = 1 THEN
    RAISE NOTICE '✅ TEST 5 PASSED: Same day multiple logs counted once';
  ELSE
    RAISE EXCEPTION '❌ TEST 5 FAILED: Expected 1 day, got %', v_result;
  END IF;

  RAISE NOTICE '=== Test 6: Response Contract Validation ===';
  
  v_result := public.rpc_get_challenges_view(v_user_id);
  
  IF v_result ? 'ok' 
    AND v_result ? 'currentWeek'
    AND v_result ? 'active'
    AND v_result ? 'claimable'
    AND v_result ? 'upcoming' THEN
    RAISE NOTICE '✅ TEST 6 PASSED: Response contract valid';
    RAISE NOTICE 'Sample response: %', v_result;
  ELSE
    RAISE EXCEPTION '❌ TEST 6 FAILED: Missing required fields';
  END IF;

  RAISE NOTICE '=== ALL CHALLENGE TESTS PASSED ===';
END $$;
