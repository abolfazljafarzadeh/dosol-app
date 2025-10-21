-- Create enums
CREATE TYPE league_status AS ENUM ('open', 'locked', 'archived');
CREATE TYPE medal_kind AS ENUM ('permanent', 'temporary');
CREATE TYPE challenge_status AS ENUM ('active', 'done');
CREATE TYPE purchase_status AS ENUM ('pending', 'completed', 'failed');
CREATE TYPE invite_status AS ENUM ('pending', 'accepted');

-- XP Counters table
CREATE TABLE public.xp_counters (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_practice DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.xp_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own xp" ON public.xp_counters
  FOR SELECT USING (auth.uid() = user_id);

-- Practice logs table
CREATE TABLE public.practice_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  minutes INTEGER NOT NULL CHECK (minutes >= 5 AND minutes <= 240),
  note TEXT,
  practiced_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.practice_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own practice logs" ON public.practice_logs
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX idx_practice_logs_user_date ON public.practice_logs(user_id, practiced_on);

-- Weekly leagues table
CREATE TABLE public.weekly_leagues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  status league_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(week_start)
);

ALTER TABLE public.weekly_leagues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view leagues" ON public.weekly_leagues
  FOR SELECT USING (true);

-- League members table
CREATE TABLE public.league_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id UUID NOT NULL REFERENCES public.weekly_leagues(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weekly_xp INTEGER NOT NULL DEFAULT 0,
  rank INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(league_id, user_id)
);

ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view league members" ON public.league_members
  FOR SELECT USING (true);

CREATE INDEX idx_league_members_league ON public.league_members(league_id, weekly_xp DESC);

-- Medals table
CREATE TABLE public.medals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  kind medal_kind NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.medals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view medals" ON public.medals
  FOR SELECT USING (true);

-- User medals table
CREATE TABLE public.user_medals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  medal_id UUID NOT NULL REFERENCES public.medals(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, medal_id)
);

ALTER TABLE public.user_medals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own medals" ON public.user_medals
  FOR SELECT USING (auth.uid() = user_id);

-- Challenges table
CREATE TABLE public.challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  rules JSONB NOT NULL,
  level TEXT,
  prerequisite_code TEXT,
  reward JSONB,
  active_week DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view challenges" ON public.challenges
  FOR SELECT USING (true);

-- Challenge progress table
CREATE TABLE public.challenge_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  challenge_code TEXT NOT NULL,
  progress JSONB NOT NULL DEFAULT '{}',
  status challenge_status NOT NULL DEFAULT 'active',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, challenge_code)
);

ALTER TABLE public.challenge_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own challenge progress" ON public.challenge_progress
  FOR SELECT USING (auth.uid() = user_id);

-- Courses table
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  image_url TEXT,
  price INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active courses" ON public.courses
  FOR SELECT USING (active = true);

-- Purchases table
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  status purchase_status NOT NULL DEFAULT 'pending',
  amount INTEGER NOT NULL,
  transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases" ON public.purchases
  FOR SELECT USING (auth.uid() = user_id);

-- Invites table
CREATE TABLE public.invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  invite_code TEXT UNIQUE NOT NULL,
  invitee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status invite_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own invites" ON public.invites
  FOR SELECT USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- OTP codes table
CREATE TABLE public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_otp_phone ON public.otp_codes(phone, expires_at);

-- Processed requests table (for idempotency)
CREATE TABLE public.processed_requests (
  idempotency_key TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.processed_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_processed_requests_created ON public.processed_requests(created_at);

-- Training plans table
CREATE TABLE public.training_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  days INTEGER[] NOT NULL,
  times JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own training plan" ON public.training_plans
  FOR SELECT USING (auth.uid() = user_id);

-- Enable realtime for xp_counters and league_members
ALTER PUBLICATION supabase_realtime ADD TABLE public.xp_counters;
ALTER PUBLICATION supabase_realtime ADD TABLE public.league_members;