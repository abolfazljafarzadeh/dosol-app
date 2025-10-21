# Test Suite for Practice Logging System

## Overview
This directory contains SQL test scripts for the practice logging system, specifically testing the atomic `rpc_log_practice` function.

## Running Tests

### From Supabase SQL Editor
1. Open your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `test-log-practice.sql`
4. Click "Run" to execute all tests

### Expected Output
All tests should pass with green checkmarks (✅):
- TEST 1: First practice log
- TEST 2: Second practice log (reaching daily XP cap)
- TEST 3: Third practice log attempt (should fail with DAILY_LIMIT)
- TEST 4: Idempotency check (replay should return same result)
- TEST 5: Medal awards verification
- TEST 6: Streak calculation across days
- TEST 7: League lock enforcement

## Test Coverage

### ✅ Acceptance Criteria Covered:

1. **Daily Limits**
   - Maximum 2 practice logs per day (TEST 3)
   - Maximum 240 minutes per day (implicit in TEST 2)
   - Maximum 160 XP per day (TEST 2)

2. **XP Calculation**
   - 10 XP per 15 minutes (TEST 1, TEST 2)
   - Daily cap enforcement (TEST 2)
   - Correct xpToday vs xpTotal (TEST 1, TEST 2, TEST 4)

3. **Idempotency**
   - Unique idempotency_key prevents duplicates (TEST 4)
   - Replay returns exact same response (TEST 4)

4. **Streak Calculation**
   - Consecutive day detection (TEST 6)
   - Timezone-aware date calculation (TEST 6)

5. **League Integration**
   - League lock enforcement (TEST 7)
   - Status code 423 for locked leagues (TEST 7)
   - Only league_scores.xp_week updated (TEST 7)

6. **Medals**
   - First practice medal awarded (TEST 5)
   - Daily cap medal awarded (TEST 5)
   - Unique constraint prevents duplicates (implicit)

## Manual Testing Checklist

In addition to automated tests, verify these scenarios in your application:

- [ ] Practice log with 120 minutes twice in same day → total XP = 160
- [ ] Attempt third log same day → error message shown
- [ ] Submit same idempotency_key → no duplicate, same response
- [ ] Practice at 23:50 and 00:10 (across midnight) → streak increments correctly
- [ ] Join league, practice → league score increases
- [ ] League becomes locked → cannot add more XP, see error message

## Troubleshooting

If tests fail:
1. Check that all required tables exist (run migrations)
2. Verify medals table has required entries ('first_practice', 'daily_cap_reached')
3. Check RLS policies don't interfere (tests use service role)
4. Review console output for specific error messages

## Cleanup

Tests create a test user with ID `00000000-0000-0000-0000-000000000001`. To clean up:

```sql
DELETE FROM public.practice_logs WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.xp_events WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.xp_counters WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.streaks WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.user_medals WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.league_scores WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.league_members WHERE user_id = '00000000-0000-0000-0000-000000000001';
DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000001';
```
