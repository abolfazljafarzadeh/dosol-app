-- ✅ Test Suite for rpc_log_practice
-- Run these tests to verify all acceptance criteria

-- Setup: Create a test user and required data
DO $$
DECLARE
  v_test_user_id UUID := '00000000-0000-0000-0000-000000000001';
  v_test_idempotency_1 TEXT := 'test-idem-1';
  v_test_idempotency_2 TEXT := 'test-idem-2';
  v_test_idempotency_3 TEXT := 'test-idem-3';
  v_result JSONB;
  v_first_practice_medal_id UUID;
  v_daily_cap_medal_id UUID;
BEGIN
  -- Clean up any existing test data
  DELETE FROM public.practice_logs WHERE user_id = v_test_user_id;
  DELETE FROM public.xp_events WHERE user_id = v_test_user_id;
  DELETE FROM public.xp_counters WHERE user_id = v_test_user_id;
  DELETE FROM public.streaks WHERE user_id = v_test_user_id;
  DELETE FROM public.user_medals WHERE user_id = v_test_user_id;
  DELETE FROM public.league_scores WHERE user_id = v_test_user_id;
  DELETE FROM public.league_members WHERE user_id = v_test_user_id;
  DELETE FROM public.profiles WHERE id = v_test_user_id;

  -- Create test user profile
  INSERT INTO public.profiles (id, phone, first_name, tz)
  VALUES (v_test_user_id, '+989121234567', 'Test User', 'Asia/Tehran');

  -- Ensure medals exist
  INSERT INTO public.medals (code, title, description, kind)
  VALUES ('first_practice', 'اولین تمرین', 'تمرین اول شما', 'badge')
  ON CONFLICT (code) DO NOTHING
  RETURNING id INTO v_first_practice_medal_id;

  INSERT INTO public.medals (code, title, description, kind)
  VALUES ('daily_cap_reached', 'سقف روزانه', 'به سقف روزانه رسیدید', 'badge')
  ON CONFLICT (code) DO NOTHING
  RETURNING id INTO v_daily_cap_medal_id;

  RAISE NOTICE '=== Test Setup Complete ===';
  RAISE NOTICE 'Test User ID: %', v_test_user_id;
  RAISE NOTICE '';

  -- ========================================
  -- TEST 1: First practice log (should succeed)
  -- ========================================
  RAISE NOTICE '=== TEST 1: First Practice Log (120 minutes) ===';
  
  v_result := public.rpc_log_practice(
    v_test_user_id,
    120,
    'تست اول',
    v_test_idempotency_1,
    NOW()
  );

  RAISE NOTICE 'Result: %', v_result;
  RAISE NOTICE 'Expected: ok=true, xpGained=80, xpToday=80, xpTotal=80, streak.current=1';
  
  IF (v_result->>'ok')::boolean = true 
    AND (v_result->>'xpGained')::int = 80 
    AND (v_result->>'xpToday')::int = 80
    AND (v_result->>'xpTotal')::int = 80
    AND (v_result->'streak'->>'current')::int = 1 THEN
    RAISE NOTICE '✅ TEST 1 PASSED';
  ELSE
    RAISE EXCEPTION '❌ TEST 1 FAILED';
  END IF;
  RAISE NOTICE '';

  -- ========================================
  -- TEST 2: Second practice log (should succeed, reach daily cap)
  -- ========================================
  RAISE NOTICE '=== TEST 2: Second Practice Log (120 minutes, should cap at 160 XP total) ===';
  
  v_result := public.rpc_log_practice(
    v_test_user_id,
    120,
    'تست دوم',
    v_test_idempotency_2,
    NOW()
  );

  RAISE NOTICE 'Result: %', v_result;
  RAISE NOTICE 'Expected: ok=true, xpGained=80, xpToday=160, xpTotal=160';
  
  IF (v_result->>'ok')::boolean = true 
    AND (v_result->>'xpGained')::int = 80 
    AND (v_result->>'xpToday')::int = 160
    AND (v_result->>'xpTotal')::int = 160 THEN
    RAISE NOTICE '✅ TEST 2 PASSED';
  ELSE
    RAISE EXCEPTION '❌ TEST 2 FAILED';
  END IF;
  RAISE NOTICE '';

  -- ========================================
  -- TEST 3: Third practice log (should fail - daily limit)
  -- ========================================
  RAISE NOTICE '=== TEST 3: Third Practice Log (should fail - DAILY_LIMIT) ===';
  
  v_result := public.rpc_log_practice(
    v_test_user_id,
    30,
    'تست سوم',
    v_test_idempotency_3,
    NOW()
  );

  RAISE NOTICE 'Result: %', v_result;
  RAISE NOTICE 'Expected: ok=false, code=DAILY_LIMIT';
  
  IF (v_result->>'ok')::boolean = false 
    AND (v_result->>'code') = 'DAILY_LIMIT' THEN
    RAISE NOTICE '✅ TEST 3 PASSED';
  ELSE
    RAISE EXCEPTION '❌ TEST 3 FAILED';
  END IF;
  RAISE NOTICE '';

  -- ========================================
  -- TEST 4: Idempotency check (replay first request)
  -- ========================================
  RAISE NOTICE '=== TEST 4: Idempotency Check (replay first request) ===';
  
  v_result := public.rpc_log_practice(
    v_test_user_id,
    120,
    'تست اول',
    v_test_idempotency_1,
    NOW()
  );

  RAISE NOTICE 'Result: %', v_result;
  RAISE NOTICE 'Expected: Same as TEST 1 - xpGained=80, xpToday=160, xpTotal=160';
  
  IF (v_result->>'ok')::boolean = true 
    AND (v_result->>'xpGained')::int = 80 
    AND (v_result->>'xpToday')::int = 160
    AND (v_result->>'xpTotal')::int = 160 THEN
    RAISE NOTICE '✅ TEST 4 PASSED (Idempotency works correctly)';
  ELSE
    RAISE EXCEPTION '❌ TEST 4 FAILED';
  END IF;
  RAISE NOTICE '';

  -- ========================================
  -- TEST 5: Check medals awarded
  -- ========================================
  RAISE NOTICE '=== TEST 5: Check Medals Awarded ===';
  
  IF EXISTS (SELECT 1 FROM public.user_medals WHERE user_id = v_test_user_id AND medal_id = v_first_practice_medal_id) THEN
    RAISE NOTICE '✅ First practice medal awarded';
  ELSE
    RAISE EXCEPTION '❌ First practice medal NOT awarded';
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_medals WHERE user_id = v_test_user_id AND medal_id = v_daily_cap_medal_id) THEN
    RAISE NOTICE '✅ Daily cap medal awarded';
  ELSE
    RAISE EXCEPTION '❌ Daily cap medal NOT awarded';
  END IF;
  RAISE NOTICE '';

  -- ========================================
  -- TEST 6: Streak calculation across midnight
  -- ========================================
  RAISE NOTICE '=== TEST 6: Streak Calculation (next day) ===';
  
  -- Simulate next day by using yesterday as last_active_date
  UPDATE public.streaks 
  SET last_active_local_date = CURRENT_DATE - INTERVAL '1 day'
  WHERE user_id = v_test_user_id;

  -- Reset daily limits for next day test
  DELETE FROM public.practice_logs WHERE user_id = v_test_user_id AND idempotency_key = 'test-next-day';
  
  v_result := public.rpc_log_practice(
    v_test_user_id,
    30,
    'تست روز بعد',
    'test-next-day',
    NOW()
  );

  RAISE NOTICE 'Result: %', v_result;
  RAISE NOTICE 'Expected: streak.current=2 (consecutive day)';
  
  IF (v_result->'streak'->>'current')::int = 2 THEN
    RAISE NOTICE '✅ TEST 6 PASSED (Streak incremented correctly)';
  ELSE
    RAISE EXCEPTION '❌ TEST 6 FAILED - Expected streak=2, got %', (v_result->'streak'->>'current')::int;
  END IF;
  RAISE NOTICE '';

  -- ========================================
  -- TEST 7: League lock check
  -- ========================================
  RAISE NOTICE '=== TEST 7: League Lock Check ===';
  
  -- Create a locked league and add user
  DECLARE
    v_league_id UUID;
  BEGIN
    INSERT INTO public.weekly_leagues (week_start, week_end, status, start_local_week, end_local_week)
    VALUES (CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days', 'locked', CURRENT_DATE, CURRENT_DATE + INTERVAL '7 days')
    RETURNING id INTO v_league_id;

    INSERT INTO public.league_members (user_id, league_id)
    VALUES (v_test_user_id, v_league_id);

    INSERT INTO public.league_scores (user_id, league_id, xp_week)
    VALUES (v_test_user_id, v_league_id, 0);

    -- Reset daily limits
    UPDATE public.streaks SET last_active_local_date = CURRENT_DATE - INTERVAL '2 days' WHERE user_id = v_test_user_id;

    v_result := public.rpc_log_practice(
      v_test_user_id,
      30,
      'تست لیگ قفل',
      'test-league-locked',
      NOW()
    );

    RAISE NOTICE 'Result: %', v_result;
    RAISE NOTICE 'Expected: ok=false, code=LEAGUE_LOCKED';
    
    IF (v_result->>'ok')::boolean = false 
      AND (v_result->>'code') = 'LEAGUE_LOCKED' THEN
      RAISE NOTICE '✅ TEST 7 PASSED (League lock enforced)';
    ELSE
      RAISE EXCEPTION '❌ TEST 7 FAILED';
    END IF;
  END;

  RAISE NOTICE '';
  RAISE NOTICE '=== ALL TESTS COMPLETED SUCCESSFULLY ===';

END $$;
