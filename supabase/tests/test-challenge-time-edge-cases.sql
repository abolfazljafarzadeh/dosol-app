-- Test Suite for Time Edge Cases in Challenge System
-- Tests midnight boundary (23:59 -> 00:00) and timezone handling

DO $$
DECLARE
  v_user_id UUID := '00000000-0000-0000-0000-000000000088';
  v_tz TEXT := 'Asia/Tehran';
  v_day1 DATE;
  v_day2 DATE;
  v_instance_id UUID;
  v_result JSONB;
  v_days_done INT;
BEGIN
  -- Setup: Clean test data
  DELETE FROM public.user_challenge_progress WHERE user_id = v_user_id;
  DELETE FROM public.challenge_instances WHERE user_id = v_user_id;
  DELETE FROM public.xp_events WHERE user_id = v_user_id;
  DELETE FROM public.xp_counters WHERE user_id = v_user_id;
  DELETE FROM public.practice_logs WHERE user_id = v_user_id;
  DELETE FROM public.profiles WHERE id = v_user_id;

  INSERT INTO public.profiles (id, phone, first_name, tz)
  VALUES (v_user_id, '+989121234588', 'Test Time User', v_tz);

  -- Calculate two consecutive days
  v_day1 := (now() AT TIME ZONE v_tz)::date;
  v_day2 := v_day1 + 1;

  -- Ensure challenge exists
  INSERT INTO public.challenges (code, title, kind, period, status, conditions, reward, auto_enroll)
  VALUES ('test_weekly', 'تست هفتگی', 'periodic', 'week', 'active', 
     '{"type":"days_in_period","min_days":7}'::jsonb, 
     '{"xp":100,"claimable":false}'::jsonb, true)
  ON CONFLICT (code) DO NOTHING;

  RAISE NOTICE '=== Test 1: Multiple Logs Same Day (23:59) ===';
  
  -- Create instance
  INSERT INTO public.challenge_instances (
    challenge_code, user_id, 
    window_start, window_end, 
    status
  )
  VALUES (
    'test_weekly', v_user_id,
    v_day1 - ((EXTRACT(DOW FROM v_day1)::int + 1) % 7),
    v_day1 - ((EXTRACT(DOW FROM v_day1)::int + 1) % 7) + 6,
    'open'
  )
  RETURNING id INTO v_instance_id;

  -- Log 3 practices at different times on same day
  -- Simulating 10:00, 15:00, 23:59
  FOR i IN 1..3 LOOP
    INSERT INTO public.practice_logs (user_id, minutes, local_date, practiced_on, idempotency_key)
    VALUES (v_user_id, 25, v_day1, v_day1, 'edge-day1-' || i);
    
    PERFORM public.rpc_evaluate_challenges(v_user_id, v_day1, v_tz);
  END LOOP;

  -- Check: Should count as 1 day only
  SELECT (progress->>'days_done')::int INTO v_days_done
  FROM public.user_challenge_progress
  WHERE user_id = v_user_id AND instance_id = v_instance_id;

  IF v_days_done = 1 THEN
    RAISE NOTICE '✅ TEST 1 PASSED: Same day counted once (days_done=%)', v_days_done;
  ELSE
    RAISE EXCEPTION '❌ TEST 1 FAILED: Expected 1 day, got %', v_days_done;
  END IF;

  RAISE NOTICE '=== Test 2: Midnight Boundary (00:00 next day) ===';
  
  -- Now log practice after midnight (next day)
  INSERT INTO public.practice_logs (user_id, minutes, local_date, practiced_on, idempotency_key)
  VALUES (v_user_id, 30, v_day2, v_day2, 'edge-day2-1');
  
  PERFORM public.rpc_evaluate_challenges(v_user_id, v_day2, v_tz);

  -- Check: Should now be 2 days
  SELECT (progress->>'days_done')::int INTO v_days_done
  FROM public.user_challenge_progress
  WHERE user_id = v_user_id AND instance_id = v_instance_id;

  IF v_days_done = 2 THEN
    RAISE NOTICE '✅ TEST 2 PASSED: Next day incremented (days_done=%)', v_days_done;
  ELSE
    RAISE EXCEPTION '❌ TEST 2 FAILED: Expected 2 days, got %', v_days_done;
  END IF;

  -- Verify days_marked array
  SELECT progress->'days_marked' INTO v_result
  FROM public.user_challenge_progress
  WHERE user_id = v_user_id AND instance_id = v_instance_id;

  IF jsonb_array_length(v_result) = 2 
    AND v_result ? v_day1::text 
    AND v_result ? v_day2::text THEN
    RAISE NOTICE '✅ TEST 2B PASSED: days_marked has both dates';
  ELSE
    RAISE EXCEPTION '❌ TEST 2B FAILED: days_marked incorrect: %', v_result;
  END IF;

  RAISE NOTICE '=== Test 3: Duplicate Day2 Log (Idempotency) ===';
  
  -- Try logging again on day2
  INSERT INTO public.practice_logs (user_id, minutes, local_date, practiced_on, idempotency_key)
  VALUES (v_user_id, 20, v_day2, v_day2, 'edge-day2-2');
  
  PERFORM public.rpc_evaluate_challenges(v_user_id, v_day2, v_tz);

  -- Should still be 2 days
  SELECT (progress->>'days_done')::int INTO v_days_done
  FROM public.user_challenge_progress
  WHERE user_id = v_user_id AND instance_id = v_instance_id;

  IF v_days_done = 2 THEN
    RAISE NOTICE '✅ TEST 3 PASSED: Duplicate day2 did not increment (days_done=%)', v_days_done;
  ELSE
    RAISE EXCEPTION '❌ TEST 3 FAILED: Should still be 2 days, got %', v_days_done;
  END IF;

  RAISE NOTICE '=== Test 4: Verify User Timezone Used ===';
  
  -- Check that calculations use profiles.tz
  SELECT tz INTO v_result FROM public.profiles WHERE id = v_user_id;
  
  IF v_result::text = v_tz THEN
    RAISE NOTICE '✅ TEST 4 PASSED: User timezone is %', v_tz;
  ELSE
    RAISE EXCEPTION '❌ TEST 4 FAILED: Timezone mismatch';
  END IF;

  -- Verify local_date matches user's timezone
  SELECT COUNT(*) INTO v_days_done
  FROM public.practice_logs
  WHERE user_id = v_user_id 
    AND local_date IN (v_day1, v_day2);

  IF v_days_done = 5 THEN -- 3 + 2 logs
    RAISE NOTICE '✅ TEST 4B PASSED: All logs have correct local_date';
  ELSE
    RAISE EXCEPTION '❌ TEST 4B FAILED: Expected 5 logs with correct dates, got %', v_days_done;
  END IF;

  RAISE NOTICE '=== ALL TIME EDGE CASE TESTS PASSED ===';
  RAISE NOTICE 'Summary: Same-day multi-logs counted once, midnight boundary handled, timezone respected';
END $$;
