-- Add cron job for auto-joining weekly leagues
-- Runs every Saturday at 00:30 (Asia/Tehran)
SELECT cron.schedule(
  'league-auto-join',
  '30 0 * * 6',
  $$
  SELECT
    net.http_post(
        url := 'https://dbogjyuqeereyeqybwrj.supabase.co/functions/v1/auto-join-weekly-leagues',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRib2dqeXVxZWVyZXllcXlid3JqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NzEwNTUsImV4cCI6MjA3NTE0NzA1NX0.5jGTH4GxE20k94L7yHzx1AD4-SgSuESfqKGgQk_zzSE',
          'x-cron-secret', current_setting('app.settings.cron_secret', true)
        ),
        body := jsonb_build_object('scheduled', now())
    ) AS request_id;
  $$
);
