-- ✅ Phase 1: Add Unique Index on idempotency_key
CREATE UNIQUE INDEX IF NOT EXISTS idx_practice_logs_idempotency_key 
ON public.practice_logs(idempotency_key) 
WHERE idempotency_key IS NOT NULL;

-- ✅ Phase 2: Add Unique Constraint on user_medals to prevent duplicate badges
ALTER TABLE public.user_medals 
DROP CONSTRAINT IF EXISTS user_medals_user_medal_unique;

ALTER TABLE public.user_medals 
ADD CONSTRAINT user_medals_user_medal_unique 
UNIQUE (user_id, medal_id);

-- ✅ Phase 3: Add Performance Indexes
CREATE INDEX IF NOT EXISTS idx_practice_logs_user_date 
ON public.practice_logs(user_id, local_date);

CREATE INDEX IF NOT EXISTS idx_xp_events_user_date 
ON public.xp_events(user_id, local_date);

CREATE INDEX IF NOT EXISTS idx_league_scores_league 
ON public.league_scores(league_id);

CREATE INDEX IF NOT EXISTS idx_user_medals_user 
ON public.user_medals(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_status 
ON public.notifications(user_id, status, scheduled_at);

-- ✅ Phase 4: Add 'locked' status to league_status enum
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e 
    JOIN pg_type t ON e.enumtypid = t.oid 
    WHERE t.typname = 'league_status' AND e.enumlabel = 'locked'
  ) THEN
    ALTER TYPE public.league_status ADD VALUE 'locked';
  END IF;
END $$;

-- ✅ Phase 5: Drop processed_requests table (not needed)
DROP TABLE IF EXISTS public.processed_requests CASCADE;

-- ✅ Phase 6: Backfill XP Events with Daily Cap (160 XP per day)
-- This corrects any existing xp_events that exceed daily caps
DO $$
DECLARE
  user_rec RECORD;
  day_rec RECORD;
  total_xp_for_day INTEGER;
  remaining_cap INTEGER;
  log_rec RECORD;
  xp_to_award INTEGER;
BEGIN
  -- Delete existing xp_events to rebuild them correctly
  DELETE FROM public.xp_events WHERE source = 'practice';

  -- For each user
  FOR user_rec IN 
    SELECT DISTINCT user_id FROM public.practice_logs ORDER BY user_id
  LOOP
    -- For each unique day
    FOR day_rec IN 
      SELECT DISTINCT local_date 
      FROM public.practice_logs 
      WHERE user_id = user_rec.user_id 
      ORDER BY local_date
    LOOP
      total_xp_for_day := 0;
      remaining_cap := 160; -- Daily XP cap

      -- Process logs for this day in chronological order
      FOR log_rec IN 
        SELECT id, minutes, created_at
        FROM public.practice_logs
        WHERE user_id = user_rec.user_id 
          AND local_date = day_rec.local_date
        ORDER BY created_at
      LOOP
        -- Calculate XP: 10 XP per 15 minutes
        xp_to_award := (log_rec.minutes / 15) * 10;
        
        -- Apply daily cap
        IF xp_to_award > remaining_cap THEN
          xp_to_award := remaining_cap;
        END IF;

        -- Insert xp_event if there's XP to award
        IF xp_to_award > 0 THEN
          INSERT INTO public.xp_events (user_id, local_date, delta, source, practice_log_id)
          VALUES (user_rec.user_id, day_rec.local_date, xp_to_award, 'practice', log_rec.id);

          total_xp_for_day := total_xp_for_day + xp_to_award;
          remaining_cap := remaining_cap - xp_to_award;
        END IF;

        -- Stop if we've hit the cap
        EXIT WHEN remaining_cap <= 0;
      END LOOP;
    END LOOP;
  END LOOP;

  -- Recalculate total_xp in xp_counters
  UPDATE public.xp_counters xc
  SET total_xp = (
    SELECT COALESCE(SUM(delta), 0)
    FROM public.xp_events
    WHERE user_id = xc.user_id
  );

END $$;