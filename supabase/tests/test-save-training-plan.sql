-- Test Suite for rpc_save_training_plan

DO $$
DECLARE
  v_test_user_id UUID := '00000000-0000-0000-0000-000000000002';
  v_result JSONB;
BEGIN
  -- Setup
  DELETE FROM public.training_plans WHERE user_id = v_test_user_id;
  DELETE FROM public.profiles WHERE id = v_test_user_id;

  INSERT INTO public.profiles (id, phone, first_name, tz)
  VALUES (v_test_user_id, '+989121234568', 'Test User 2', 'Asia/Tehran');

  RAISE NOTICE '=== Test 1: Save training plan ===';
  
  v_result := public.rpc_save_training_plan(
    v_test_user_id,
    ARRAY[0, 2, 4]::INT[],
    '{"08:00": true, "18:00": true}'::JSONB,
    'UTC'
  );

  IF (v_result->>'ok')::BOOLEAN = true THEN
    RAISE NOTICE '✅ TEST 1 PASSED';
  ELSE
    RAISE EXCEPTION '❌ TEST 1 FAILED: %', v_result;
  END IF;

  RAISE NOTICE '=== Test 2: Invalid days ===';
  
  v_result := public.rpc_save_training_plan(
    v_test_user_id,
    ARRAY[0, 7]::INT[],
    '{"08:00": true}'::JSONB,
    NULL
  );

  IF (v_result->>'ok')::BOOLEAN = false THEN
    RAISE NOTICE '✅ TEST 2 PASSED (rejected invalid days)';
  ELSE
    RAISE EXCEPTION '❌ TEST 2 FAILED';
  END IF;

  RAISE NOTICE '=== ALL TESTS PASSED ===';
END $$;
