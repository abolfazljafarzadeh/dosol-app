-- Add bucket tier enum for skill-based league grouping
CREATE TYPE public.bucket_tier AS ENUM ('beginner', 'intermediate', 'advanced');

-- Add capacity tracking to weekly_leagues
ALTER TABLE public.weekly_leagues 
  ADD COLUMN IF NOT EXISTS bucket_tier bucket_tier,
  ADD COLUMN IF NOT EXISTS capacity integer DEFAULT 15,
  ADD COLUMN IF NOT EXISTS member_count integer DEFAULT 0;

-- Create index for efficient league lookup
CREATE INDEX IF NOT EXISTS idx_weekly_leagues_bucket_status 
  ON public.weekly_leagues(bucket_tier, status, week_start) 
  WHERE status = 'open';

-- Function to get user's bucket tier based on level
CREATE OR REPLACE FUNCTION public.get_user_bucket_tier(p_user_id uuid)
RETURNS bucket_tier
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_level int;
BEGIN
  SELECT COALESCE(level::int, 1) INTO v_level
  FROM public.profiles
  WHERE id = p_user_id;
  
  IF v_level <= 5 THEN
    RETURN 'beginner'::bucket_tier;
  ELSIF v_level <= 10 THEN
    RETURN 'intermediate'::bucket_tier;
  ELSE
    RETURN 'advanced'::bucket_tier;
  END IF;
END;
$$;

-- Update finalize function to award medals and send notifications
CREATE OR REPLACE FUNCTION public.rpc_finalize_weekly_leagues()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_league RECORD;
  v_member RECORD;
  v_finalized_count INT := 0;
  v_medal_code TEXT;
BEGIN
  -- Find all locked leagues and finalize them
  FOR v_league IN
    SELECT id FROM public.weekly_leagues
    WHERE status = 'locked'
  LOOP
    -- Update ranks based on xp_week
    WITH ranked_scores AS (
      SELECT
        user_id,
        RANK() OVER (ORDER BY xp_week DESC) AS new_rank
      FROM public.league_scores
      WHERE league_id = v_league.id
    )
    UPDATE public.league_members lm
    SET rank = rs.new_rank, updated_at = NOW()
    FROM ranked_scores rs
    WHERE lm.user_id = rs.user_id AND lm.league_id = v_league.id;

    -- Award medals to top 3
    FOR v_member IN
      SELECT lm.user_id, lm.rank
      FROM public.league_members lm
      WHERE lm.league_id = v_league.id AND lm.rank <= 3
      ORDER BY lm.rank
    LOOP
      -- Determine medal code
      v_medal_code := CASE v_member.rank
        WHEN 1 THEN 'league-first'
        WHEN 2 THEN 'league-second'
        WHEN 3 THEN 'league-third'
      END;
      
      -- Award medal if not already earned
      INSERT INTO public.user_medals (user_id, medal_id, earned_at)
      SELECT v_member.user_id, m.id, NOW()
      FROM public.medals m
      WHERE m.code = v_medal_code
      ON CONFLICT (user_id, medal_id) DO NOTHING;
      
      -- Send congratulations notification
      INSERT INTO public.notifications (user_id, type, status, payload, created_at)
      VALUES (
        v_member.user_id,
        'league_winner',
        'queued',
        jsonb_build_object(
          'rank', v_member.rank,
          'medal_code', v_medal_code,
          'league_id', v_league.id,
          'message', CASE v_member.rank
            WHEN 1 THEN '🥇 تبریک! رتبه اول لیگ هفتگی رو کسب کردی!'
            WHEN 2 THEN '🥈 تبریک! رتبه دوم لیگ هفتگی رو کسب کردی!'
            WHEN 3 THEN '🥉 تبریک! رتبه سوم لیگ هفتگی رو کسب کردی!'
          END
        ),
        NOW()
      );
    END LOOP;

    -- Mark league as finalized
    UPDATE public.weekly_leagues
    SET status = 'finalized'
    WHERE id = v_league.id;

    v_finalized_count := v_finalized_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'finalized', v_finalized_count);
END;
$$;

-- Setup pg_cron for automatic league management
-- Lock leagues every Friday at 23:59 Tehran time
SELECT cron.schedule(
  'lock-weekly-leagues',
  '59 23 * * 5',
  $$
  UPDATE public.weekly_leagues
  SET status = 'locked', updated_at = NOW()
  WHERE status = 'open'
    AND week_end <= CURRENT_DATE;
  $$
);

-- Finalize leagues every Saturday at 00:15 Tehran time
SELECT cron.schedule(
  'finalize-weekly-leagues-auto',
  '15 0 * * 6',
  $$
  SELECT public.rpc_finalize_weekly_leagues();
  $$
);