-- ═══════════════════════════════════════════════════════════
-- Migration Phase 1: Schema Setup (No Data Changes)
-- ═══════════════════════════════════════════════════════════

-- 1) Add timezone column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tz text NOT NULL DEFAULT 'Asia/Tehran';

-- 2) Enhance practice_logs with local_date, idempotency, constraints
ALTER TABLE public.practice_logs
  ADD COLUMN IF NOT EXISTS local_date date,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Add minutes constraint (5-240)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_minutes_5_240'
  ) THEN
    ALTER TABLE public.practice_logs
      ADD CONSTRAINT chk_minutes_5_240 CHECK (minutes BETWEEN 5 AND 240);
  END IF;
END $$;

-- Unique index for idempotency (allows nulls temporarily)
CREATE UNIQUE INDEX IF NOT EXISTS ux_practice_logs_idem
  ON public.practice_logs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 3) Create new tables

-- 3.1 Streaks table
CREATE TABLE IF NOT EXISTS public.streaks (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak int NOT NULL DEFAULT 0,
  best_streak int NOT NULL DEFAULT 0,
  last_active_local_date date,
  updated_at timestamptz DEFAULT now()
);

-- 3.2 XP Events (history)
CREATE TABLE IF NOT EXISTS public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source text NOT NULL,
  delta int NOT NULL,
  practice_log_id uuid REFERENCES public.practice_logs(id) ON DELETE SET NULL,
  local_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- 3.3 Enhance xp_counters (ensure unique user_id)
ALTER TABLE public.xp_counters
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'ux_xp_counters_user'
  ) THEN
    ALTER TABLE public.xp_counters
      ADD CONSTRAINT ux_xp_counters_user UNIQUE (user_id);
  END IF;
END $$;

-- 3.4 Enhance weekly_leagues
ALTER TABLE public.weekly_leagues
  ADD COLUMN IF NOT EXISTS start_local_week date,
  ADD COLUMN IF NOT EXISTS end_local_week date,
  ADD COLUMN IF NOT EXISTS bucket text;

-- Add status column with check constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'weekly_leagues' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.weekly_leagues
      ADD COLUMN status text DEFAULT 'open'
      CHECK (status IN ('open', 'locked', 'finalized'));
  END IF;
END $$;

-- 3.5 League scores (weekly XP per user per league)
CREATE TABLE IF NOT EXISTS public.league_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES public.weekly_leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  xp_week int NOT NULL DEFAULT 0,
  UNIQUE (league_id, user_id)
);

-- 3.6 Notifications queue
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb,
  scheduled_at timestamptz,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz DEFAULT now()
);

-- 3.7 Outbox events (optional, for domain events)
CREATE TABLE IF NOT EXISTS public.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  processed boolean NOT NULL DEFAULT false
);

-- 4) Create indexes for performance

CREATE INDEX IF NOT EXISTS ix_practice_logs_user_date
  ON public.practice_logs (user_id, local_date);

CREATE INDEX IF NOT EXISTS ix_xp_events_user_date
  ON public.xp_events (user_id, local_date);

CREATE INDEX IF NOT EXISTS ix_notifications_user_status_sched
  ON public.notifications (user_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS ix_league_scores_league
  ON public.league_scores (league_id);

CREATE INDEX IF NOT EXISTS ix_user_medals_user
  ON public.user_medals (user_id);

-- 5) Enable RLS and create policies

-- Streaks
ALTER TABLE public.streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own streak" ON public.streaks;
CREATE POLICY "Users can view own streak"
  ON public.streaks FOR SELECT
  USING (user_id = auth.uid());

-- XP Events
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own xp events" ON public.xp_events;
CREATE POLICY "Users can view own xp events"
  ON public.xp_events FOR SELECT
  USING (user_id = auth.uid());

-- Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- League Scores: Security definer function to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.is_league_member(_league_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.league_members
    WHERE league_id = _league_id
      AND user_id = _user_id
  )
$$;

ALTER TABLE public.league_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view scores in their league" ON public.league_scores;
CREATE POLICY "Users can view scores in their league"
  ON public.league_scores FOR SELECT
  USING (public.is_league_member(league_id, auth.uid()));

-- Outbox events (service role only, no user access)
ALTER TABLE public.outbox_events ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════
-- Migration Phase 1 Complete
-- Next: Edge Functions (Phase 2)
-- ═══════════════════════════════════════════════════════════