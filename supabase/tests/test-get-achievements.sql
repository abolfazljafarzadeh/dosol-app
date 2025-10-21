-- Test Suite for rpc_get_achievements

DO $$
DECLARE
  v_test_user_id UUID := '00000000-0000-0000-0000-000000000004';
  v_result JSONB;
  v_medal_id UUID;
BEGIN
  -- Setup
  DELETE FROM public.user_medals WHERE user_id = v_test_user_id;
  DELETE FROM public.xp_counters WHERE user_id = v_test_user_id;
  DELETE FROM public.profiles WHERE id = v_test_user_id;

  INSERT INTO public.profiles (id, phone, first_name, tz)
  VALUES (v_test_user_id, '+989121234570', 'Test User 4', 'Asia/Tehran');

  -- Add XP (250 = level 2)
  INSERT INTO public.xp_counters (user_id, total_xp)
  VALUES (v_test_user_id, 250);

  -- Add a medal
  SELECT id INTO v_medal_id FROM public.medals LIMIT 1;
  IF v_medal_id IS NOT NULL THEN
    INSERT INTO public.user_medals (user_id, medal_id)
    VALUES (v_test_user_id, v_medal_id);
  END IF;

  RAISE NOTICE '=== Test: Get achievements ===';
  
  v_result := public.rpc_get_achievements(v_test_user_id);

  IF (v_result->>'ok')::BOOLEAN = true 
    AND (v_result->'level'->>'current')::INT = 2
    AND (v_result->'level'->>'xpTotal')::INT = 250 THEN
    RAISE NOTICE '✅ TEST PASSED';
    RAISE NOTICE 'Result: %', v_result;
  ELSE
    RAISE EXCEPTION '❌ TEST FAILED: %', v_result;
  END IF;

  RAISE NOTICE '=== ALL TESTS PASSED ===';
END $$;
