-- Test Suite for rpc_get_dashboard

DO $$
DECLARE
  v_test_user_id UUID := '00000000-0000-0000-0000-000000000003';
  v_result JSONB;
  v_local_date DATE;
BEGIN
  -- Setup
  DELETE FROM public.practice_logs WHERE user_id = v_test_user_id;
  DELETE FROM public.xp_events WHERE user_id = v_test_user_id;
  DELETE FROM public.xp_counters WHERE user_id = v_test_user_id;
  DELETE FROM public.streaks WHERE user_id = v_test_user_id;
  DELETE FROM public.profiles WHERE id = v_test_user_id;

  INSERT INTO public.profiles (id, phone, first_name, tz)
  VALUES (v_test_user_id, '+989121234569', 'Test User 3', 'Asia/Tehran');

  v_local_date := (NOW() AT TIME ZONE 'Asia/Tehran')::DATE;

  -- Add some practice data
  INSERT INTO public.practice_logs (user_id, minutes, local_date, practiced_on)
  VALUES (v_test_user_id, 60, v_local_date, v_local_date);

  INSERT INTO public.xp_events (user_id, source, delta, local_date)
  VALUES (v_test_user_id, 'practice', 40, v_local_date);

  INSERT INTO public.xp_counters (user_id, total_xp)
  VALUES (v_test_user_id, 40);

  INSERT INTO public.streaks (user_id, current_streak, best_streak, last_active_local_date)
  VALUES (v_test_user_id, 1, 1, v_local_date);

  RAISE NOTICE '=== Test: Get dashboard ===';
  
  v_result := public.rpc_get_dashboard(v_test_user_id);

  IF (v_result->>'ok')::BOOLEAN = true 
    AND (v_result->'today'->>'minutes')::INT = 60
    AND (v_result->'today'->>'xpToday')::INT = 40
    AND (v_result->>'xpTotal')::INT = 40
    AND (v_result->'streak'->>'current')::INT = 1 THEN
    RAISE NOTICE '✅ TEST PASSED';
  ELSE
    RAISE EXCEPTION '❌ TEST FAILED: %', v_result;
  END IF;

  RAISE NOTICE '=== ALL TESTS PASSED ===';
END $$;
