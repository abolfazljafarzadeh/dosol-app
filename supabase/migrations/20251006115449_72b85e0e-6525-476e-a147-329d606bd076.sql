-- ═══════════════════════════════════════════════════════════
-- Migration Phase 3: Data Migration
-- Migrate existing data to new structure
-- ═══════════════════════════════════════════════════════════

-- Step 1: Fill local_date and idempotency_key for existing practice_logs
UPDATE public.practice_logs
SET 
  local_date = practiced_on,
  idempotency_key = CONCAT('migrated-', id::text)
WHERE local_date IS NULL;

-- Step 2: Create streaks for existing users based on practice history
INSERT INTO public.streaks (user_id, current_streak, best_streak, last_active_local_date)
SELECT DISTINCT
  pl.user_id,
  0 as current_streak, -- Will be recalculated
  0 as best_streak,
  MAX(pl.local_date) as last_active_local_date
FROM public.practice_logs pl
WHERE NOT EXISTS (
  SELECT 1 FROM public.streaks s WHERE s.user_id = pl.user_id
)
GROUP BY pl.user_id;

-- Step 3: Create xp_events from existing practice_logs
INSERT INTO public.xp_events (user_id, source, delta, practice_log_id, local_date)
SELECT 
  pl.user_id,
  'practice' as source,
  LEAST(FLOOR(pl.minutes / 15) * 10, 160) as delta,
  pl.id,
  pl.local_date
FROM public.practice_logs pl
WHERE NOT EXISTS (
  SELECT 1 FROM public.xp_events xe WHERE xe.practice_log_id = pl.id
);

-- Step 4: Ensure all users have xp_counters
INSERT INTO public.xp_counters (user_id, total_xp)
SELECT 
  p.id,
  COALESCE(SUM(xe.delta), 0) as total_xp
FROM public.profiles p
LEFT JOIN public.xp_events xe ON xe.user_id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM public.xp_counters xc WHERE xc.user_id = p.id
)
GROUP BY p.id;

-- Step 5: Update existing xp_counters with correct totals
UPDATE public.xp_counters xc
SET total_xp = (
  SELECT COALESCE(SUM(xe.delta), 0)
  FROM public.xp_events xe
  WHERE xe.user_id = xc.user_id
);

-- ═══════════════════════════════════════════════════════════
-- Migration Phase 3 Complete
-- Next: Frontend Update (Phase 4)
-- ═══════════════════════════════════════════════════════════