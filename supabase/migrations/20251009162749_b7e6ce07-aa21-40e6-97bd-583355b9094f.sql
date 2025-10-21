-- First, clean up ALL existing duplicates thoroughly
-- For streak challenges (window_start IS NULL)
WITH streak_duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY challenge_code, user_id
    ORDER BY created_at DESC
  ) AS rn
  FROM public.challenge_instances
  WHERE window_start IS NULL
)
DELETE FROM public.challenge_instances
WHERE id IN (SELECT id FROM streak_duplicates WHERE rn > 1);

-- For periodic challenges (window_start IS NOT NULL)
WITH periodic_duplicates AS (
  SELECT id, ROW_NUMBER() OVER (
    PARTITION BY challenge_code, user_id, window_start 
    ORDER BY created_at DESC
  ) AS rn
  FROM public.challenge_instances
  WHERE window_start IS NOT NULL
)
DELETE FROM public.challenge_instances
WHERE id IN (SELECT id FROM periodic_duplicates WHERE rn > 1);

-- Now create unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_challenge_instances_periodic_unique
ON public.challenge_instances (challenge_code, user_id, window_start)
WHERE window_start IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_challenge_instances_streak_unique
ON public.challenge_instances (challenge_code, user_id)
WHERE window_start IS NULL AND status = 'open';

-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Schedule nightly rollover at 00:10 Tehran (20:40 UTC)
SELECT cron.schedule(
  'challenge-rollover-nightly',
  '40 20 * * *', -- 20:40 UTC = 00:10 Tehran
  $$
  SELECT
    net.http_post(
      url := 'https://dbogjyuqeereyeqybwrj.supabase.co/functions/v1/challenge-rollover-periodic',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRib2dqeXVxZWVyZXllcXlid3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NzEwNTUsImV4cCI6MjA3NTE0NzA1NX0.5jGTH4GxE20k94L7yHzx1AD4-SgSuESfqKGgQk_zzSE',
        'X-CRON-SECRET', current_setting('app.settings.cron_secret', true)
      ),
      body := jsonb_build_object('time', now())
    ) AS request_id;
  $$
);