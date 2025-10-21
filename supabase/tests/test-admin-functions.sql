-- Test Suite for Admin RPC Functions

DO $$
DECLARE
  v_result JSONB;
  v_league_id UUID;
  v_user_id UUID := '00000000-0000-0000-0000-000000000005';
BEGIN
  -- Setup
  DELETE FROM public.league_scores WHERE user_id = v_user_id;
  DELETE FROM public.league_members WHERE user_id = v_user_id;
  DELETE FROM public.weekly_leagues WHERE status = 'locked';
  DELETE FROM public.profiles WHERE id = v_user_id;
  DELETE FROM public.challenges WHERE active_week IS NOT NULL;

  INSERT INTO public.profiles (id, phone, first_name, tz)
  VALUES (v_user_id, '+989121234571', 'Test User 5', 'Asia/Tehran');

  RAISE NOTICE '=== Test 1: Finalize weekly leagues ===';
  
  -- Create a locked league
  INSERT INTO public.weekly_leagues (week_start, week_end, status, start_local_week, end_local_week)
  VALUES (CURRENT_DATE, CURRENT_DATE + 7, 'locked', CURRENT_DATE, CURRENT_DATE + 7)
  RETURNING id INTO v_league_id;

  INSERT INTO public.league_members (user_id, league_id)
  VALUES (v_user_id, v_league_id);

  INSERT INTO public.league_scores (user_id, league_id, xp_week)
  VALUES (v_user_id, v_league_id, 100);

  v_result := public.rpc_finalize_weekly_leagues();

  IF (v_result->>'ok')::BOOLEAN = true 
    AND (v_result->>'finalized')::INT > 0 THEN
    RAISE NOTICE '✅ TEST 1 PASSED';
  ELSE
    RAISE EXCEPTION '❌ TEST 1 FAILED: %', v_result;
  END IF;

  RAISE NOTICE '=== Test 2: Rollover weekly challenge ===';
  
  v_result := public.rpc_rollover_weekly_challenge();

  IF (v_result->>'ok')::BOOLEAN = true THEN
    RAISE NOTICE '✅ TEST 2 PASSED';
    RAISE NOTICE 'Result: %', v_result;
  ELSE
    RAISE EXCEPTION '❌ TEST 2 FAILED: %', v_result;
  END IF;

  RAISE NOTICE '=== ALL TESTS PASSED ===';
END $$;
