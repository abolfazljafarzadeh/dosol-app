-- ==========================================
-- ADMIN RPC FUNCTIONS FOR DASHBOARD
-- ==========================================
-- These functions are SECURITY DEFINER and check admin role
-- They provide comprehensive stats for admin dashboard

-- 1. Admin Users Stats
CREATE OR REPLACE FUNCTION public.rpc_admin_get_users_stats(p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean;
  v_total_users int;
  v_premium_users int;
  v_active_today int;
  v_active_week int;
  v_new_today int;
  v_new_week int;
  v_new_month int;
  v_users jsonb;
BEGIN
  -- Check admin role
  SELECT public.has_role(p_admin_id, 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized - Admin only');
  END IF;

  -- Total users
  SELECT COUNT(*) INTO v_total_users FROM public.profiles;
  
  -- Premium users
  SELECT COUNT(*) INTO v_premium_users 
  FROM public.profiles 
  WHERE is_premium = true 
    AND subscription_expires_at > NOW();
  
  -- Active today (practiced today)
  SELECT COUNT(DISTINCT user_id) INTO v_active_today
  FROM public.practice_logs
  WHERE practiced_on = CURRENT_DATE;
  
  -- Active this week
  SELECT COUNT(DISTINCT user_id) INTO v_active_week
  FROM public.practice_logs
  WHERE practiced_on >= CURRENT_DATE - 7;
  
  -- New users today
  SELECT COUNT(*) INTO v_new_today
  FROM public.profiles
  WHERE created_at::date = CURRENT_DATE;
  
  -- New users this week
  SELECT COUNT(*) INTO v_new_week
  FROM public.profiles
  WHERE created_at >= CURRENT_DATE - 7;
  
  -- New users this month
  SELECT COUNT(*) INTO v_new_month
  FROM public.profiles
  WHERE created_at >= date_trunc('month', CURRENT_DATE);

  -- Get recent users with details
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'phone', p.phone,
      'firstName', p.first_name,
      'lastName', p.last_name,
      'instrument', p.instrument,
      'level', p.level,
      'isPremium', p.is_premium,
      'subscriptionExpiresAt', p.subscription_expires_at,
      'totalXp', COALESCE(xc.total_xp, 0),
      'currentStreak', COALESCE(s.current_streak, 0),
      'createdAt', p.created_at
    ) ORDER BY p.created_at DESC
  ) INTO v_users
  FROM public.profiles p
  LEFT JOIN public.xp_counters xc ON xc.user_id = p.id
  LEFT JOIN public.streaks s ON s.user_id = p.id
  LIMIT 100;

  RETURN jsonb_build_object(
    'ok', true,
    'stats', jsonb_build_object(
      'totalUsers', v_total_users,
      'premiumUsers', v_premium_users,
      'activeToday', v_active_today,
      'activeWeek', v_active_week,
      'newToday', v_new_today,
      'newWeek', v_new_week,
      'newMonth', v_new_month
    ),
    'users', COALESCE(v_users, '[]'::jsonb)
  );
END;
$$;

-- 2. Admin Practice Stats
CREATE OR REPLACE FUNCTION public.rpc_admin_get_practice_stats(p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean;
  v_total_logs int;
  v_total_minutes int;
  v_logs_today int;
  v_minutes_today int;
  v_logs_week int;
  v_minutes_week int;
  v_avg_minutes_per_session numeric;
  v_daily_stats jsonb;
  v_top_practitioners jsonb;
BEGIN
  SELECT public.has_role(p_admin_id, 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  -- Total stats
  SELECT COUNT(*), COALESCE(SUM(minutes), 0) 
  INTO v_total_logs, v_total_minutes
  FROM public.practice_logs;
  
  -- Today stats
  SELECT COUNT(*), COALESCE(SUM(minutes), 0)
  INTO v_logs_today, v_minutes_today
  FROM public.practice_logs
  WHERE practiced_on = CURRENT_DATE;
  
  -- Week stats
  SELECT COUNT(*), COALESCE(SUM(minutes), 0)
  INTO v_logs_week, v_minutes_week
  FROM public.practice_logs
  WHERE practiced_on >= CURRENT_DATE - 7;
  
  -- Average minutes per session
  SELECT COALESCE(AVG(minutes), 0)
  INTO v_avg_minutes_per_session
  FROM public.practice_logs;

  -- Daily stats for last 30 days
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', practiced_on,
      'logs', log_count,
      'minutes', total_minutes
    ) ORDER BY practiced_on DESC
  ) INTO v_daily_stats
  FROM (
    SELECT 
      practiced_on,
      COUNT(*) as log_count,
      SUM(minutes) as total_minutes
    FROM public.practice_logs
    WHERE practiced_on >= CURRENT_DATE - 30
    GROUP BY practiced_on
  ) daily;

  -- Top practitioners
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', user_id,
      'firstName', p.first_name,
      'lastName', p.last_name,
      'totalMinutes', total_minutes,
      'totalLogs', log_count
    ) ORDER BY total_minutes DESC
  ) INTO v_top_practitioners
  FROM (
    SELECT 
      pl.user_id,
      SUM(pl.minutes) as total_minutes,
      COUNT(*) as log_count
    FROM public.practice_logs pl
    GROUP BY pl.user_id
    ORDER BY total_minutes DESC
    LIMIT 20
  ) top
  JOIN public.profiles p ON p.id = top.user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'stats', jsonb_build_object(
      'totalLogs', v_total_logs,
      'totalMinutes', v_total_minutes,
      'logsToday', v_logs_today,
      'minutesToday', v_minutes_today,
      'logsWeek', v_logs_week,
      'minutesWeek', v_minutes_week,
      'avgMinutesPerSession', ROUND(v_avg_minutes_per_session, 1)
    ),
    'dailyStats', COALESCE(v_daily_stats, '[]'::jsonb),
    'topPractitioners', COALESCE(v_top_practitioners, '[]'::jsonb)
  );
END;
$$;

-- 3. Admin Gamification Stats
CREATE OR REPLACE FUNCTION public.rpc_admin_get_gamification_stats(p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean;
  v_total_xp bigint;
  v_xp_today int;
  v_xp_week int;
  v_avg_user_xp numeric;
  v_total_medals_earned int;
  v_level_distribution jsonb;
  v_top_xp_users jsonb;
  v_medals_stats jsonb;
BEGIN
  SELECT public.has_role(p_admin_id, 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  -- Total XP
  SELECT COALESCE(SUM(total_xp), 0) INTO v_total_xp
  FROM public.xp_counters;
  
  -- XP today
  SELECT COALESCE(SUM(delta), 0) INTO v_xp_today
  FROM public.xp_events
  WHERE local_date = CURRENT_DATE;
  
  -- XP this week
  SELECT COALESCE(SUM(delta), 0) INTO v_xp_week
  FROM public.xp_events
  WHERE local_date >= CURRENT_DATE - 7;
  
  -- Average XP per user
  SELECT COALESCE(AVG(total_xp), 0) INTO v_avg_user_xp
  FROM public.xp_counters;
  
  -- Total medals earned
  SELECT COUNT(*) INTO v_total_medals_earned
  FROM public.user_medals;

  -- Level distribution
  SELECT jsonb_agg(
    jsonb_build_object(
      'level', level,
      'count', user_count
    )
  ) INTO v_level_distribution
  FROM (
    SELECT 
      COALESCE(level, '1') as level,
      COUNT(*) as user_count
    FROM public.profiles
    GROUP BY level
    ORDER BY level
  ) levels;

  -- Top XP users
  SELECT jsonb_agg(
    jsonb_build_object(
      'userId', xc.user_id,
      'firstName', p.first_name,
      'lastName', p.last_name,
      'totalXp', xc.total_xp,
      'level', p.level,
      'currentStreak', COALESCE(s.current_streak, 0)
    ) ORDER BY xc.total_xp DESC
  ) INTO v_top_xp_users
  FROM public.xp_counters xc
  JOIN public.profiles p ON p.id = xc.user_id
  LEFT JOIN public.streaks s ON s.user_id = xc.user_id
  ORDER BY xc.total_xp DESC
  LIMIT 20;

  -- Medals stats
  SELECT jsonb_agg(
    jsonb_build_object(
      'medalCode', m.code,
      'medalTitle', m.title,
      'earnedCount', COALESCE(earned.count, 0)
    )
  ) INTO v_medals_stats
  FROM public.medals m
  LEFT JOIN (
    SELECT medal_id, COUNT(*) as count
    FROM public.user_medals
    GROUP BY medal_id
  ) earned ON earned.medal_id = m.id;

  RETURN jsonb_build_object(
    'ok', true,
    'stats', jsonb_build_object(
      'totalXp', v_total_xp,
      'xpToday', v_xp_today,
      'xpWeek', v_xp_week,
      'avgUserXp', ROUND(v_avg_user_xp, 0),
      'totalMedalsEarned', v_total_medals_earned
    ),
    'levelDistribution', COALESCE(v_level_distribution, '[]'::jsonb),
    'topXpUsers', COALESCE(v_top_xp_users, '[]'::jsonb),
    'medalsStats', COALESCE(v_medals_stats, '[]'::jsonb)
  );
END;
$$;

-- 4. Admin Challenges Stats
CREATE OR REPLACE FUNCTION public.rpc_admin_get_challenges_stats(p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean;
  v_total_challenges int;
  v_active_challenges int;
  v_total_instances int;
  v_completed_instances int;
  v_completion_rate numeric;
  v_challenges_list jsonb;
BEGIN
  SELECT public.has_role(p_admin_id, 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  -- Total challenges
  SELECT COUNT(*) INTO v_total_challenges
  FROM public.challenges;
  
  -- Active challenges
  SELECT COUNT(*) INTO v_active_challenges
  FROM public.challenges
  WHERE status = 'active';
  
  -- Total instances
  SELECT COUNT(*) INTO v_total_instances
  FROM public.challenge_instances;
  
  -- Completed instances
  SELECT COUNT(*) INTO v_completed_instances
  FROM public.user_challenge_progress
  WHERE is_completed = true;
  
  -- Completion rate
  IF v_total_instances > 0 THEN
    v_completion_rate := (v_completed_instances::numeric / v_total_instances) * 100;
  ELSE
    v_completion_rate := 0;
  END IF;

  -- Challenges list with stats
  SELECT jsonb_agg(
    jsonb_build_object(
      'code', c.code,
      'title', c.title,
      'kind', c.kind,
      'status', c.status,
      'totalInstances', COALESCE(inst.count, 0),
      'completedInstances', COALESCE(comp.count, 0),
      'completionRate', CASE 
        WHEN COALESCE(inst.count, 0) > 0 
        THEN ROUND((COALESCE(comp.count, 0)::numeric / inst.count) * 100, 1)
        ELSE 0
      END
    )
  ) INTO v_challenges_list
  FROM public.challenges c
  LEFT JOIN (
    SELECT challenge_code, COUNT(*) as count
    FROM public.challenge_instances
    GROUP BY challenge_code
  ) inst ON inst.challenge_code = c.code
  LEFT JOIN (
    SELECT ci.challenge_code, COUNT(*) as count
    FROM public.user_challenge_progress ucp
    JOIN public.challenge_instances ci ON ci.id = ucp.instance_id
    WHERE ucp.is_completed = true
    GROUP BY ci.challenge_code
  ) comp ON comp.challenge_code = c.code;

  RETURN jsonb_build_object(
    'ok', true,
    'stats', jsonb_build_object(
      'totalChallenges', v_total_challenges,
      'activeChallenges', v_active_challenges,
      'totalInstances', v_total_instances,
      'completedInstances', v_completed_instances,
      'completionRate', ROUND(v_completion_rate, 1)
    ),
    'challenges', COALESCE(v_challenges_list, '[]'::jsonb)
  );
END;
$$;

-- 5. Admin Leagues Stats
CREATE OR REPLACE FUNCTION public.rpc_admin_get_leagues_stats(p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean;
  v_total_leagues int;
  v_open_leagues int;
  v_locked_leagues int;
  v_finalized_leagues int;
  v_total_members int;
  v_avg_members_per_league numeric;
  v_leagues_list jsonb;
BEGIN
  SELECT public.has_role(p_admin_id, 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  -- Total leagues
  SELECT COUNT(*) INTO v_total_leagues
  FROM public.weekly_leagues;
  
  -- Open leagues
  SELECT COUNT(*) INTO v_open_leagues
  FROM public.weekly_leagues
  WHERE status = 'open';
  
  -- Locked leagues
  SELECT COUNT(*) INTO v_locked_leagues
  FROM public.weekly_leagues
  WHERE status = 'locked';
  
  -- Finalized leagues
  SELECT COUNT(*) INTO v_finalized_leagues
  FROM public.weekly_leagues
  WHERE status = 'finalized';
  
  -- Total members
  SELECT COUNT(*) INTO v_total_members
  FROM public.league_members;
  
  -- Average members per league
  IF v_total_leagues > 0 THEN
    v_avg_members_per_league := v_total_members::numeric / v_total_leagues;
  ELSE
    v_avg_members_per_league := 0;
  END IF;

  -- Leagues list
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', wl.id,
      'weekStart', wl.week_start,
      'weekEnd', wl.week_end,
      'status', wl.status,
      'bucketTier', wl.bucket_tier,
      'memberCount', wl.member_count,
      'capacity', wl.capacity
    ) ORDER BY wl.week_start DESC
  ) INTO v_leagues_list
  FROM public.weekly_leagues wl
  LIMIT 50;

  RETURN jsonb_build_object(
    'ok', true,
    'stats', jsonb_build_object(
      'totalLeagues', v_total_leagues,
      'openLeagues', v_open_leagues,
      'lockedLeagues', v_locked_leagues,
      'finalizedLeagues', v_finalized_leagues,
      'totalMembers', v_total_members,
      'avgMembersPerLeague', ROUND(v_avg_members_per_league, 1)
    ),
    'leagues', COALESCE(v_leagues_list, '[]'::jsonb)
  );
END;
$$;

-- 6. Admin Monetization Stats
CREATE OR REPLACE FUNCTION public.rpc_admin_get_monetization_stats(p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean;
  v_total_purchases int;
  v_successful_purchases int;
  v_total_revenue bigint;
  v_revenue_today bigint;
  v_revenue_week bigint;
  v_revenue_month bigint;
  v_active_subscriptions int;
  v_expired_subscriptions int;
  v_recent_purchases jsonb;
BEGIN
  SELECT public.has_role(p_admin_id, 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  -- Total purchases
  SELECT COUNT(*) INTO v_total_purchases
  FROM public.purchases;
  
  -- Successful purchases
  SELECT COUNT(*) INTO v_successful_purchases
  FROM public.purchases
  WHERE status = 'verified';
  
  -- Total revenue
  SELECT COALESCE(SUM(amount), 0) INTO v_total_revenue
  FROM public.purchases
  WHERE status = 'verified';
  
  -- Revenue today
  SELECT COALESCE(SUM(amount), 0) INTO v_revenue_today
  FROM public.purchases
  WHERE status = 'verified'
    AND created_at::date = CURRENT_DATE;
  
  -- Revenue this week
  SELECT COALESCE(SUM(amount), 0) INTO v_revenue_week
  FROM public.purchases
  WHERE status = 'verified'
    AND created_at >= CURRENT_DATE - 7;
  
  -- Revenue this month
  SELECT COALESCE(SUM(amount), 0) INTO v_revenue_month
  FROM public.purchases
  WHERE status = 'verified'
    AND created_at >= date_trunc('month', CURRENT_DATE);
  
  -- Active subscriptions
  SELECT COUNT(*) INTO v_active_subscriptions
  FROM public.profiles
  WHERE is_premium = true
    AND subscription_expires_at > NOW();
  
  -- Expired subscriptions
  SELECT COUNT(*) INTO v_expired_subscriptions
  FROM public.profiles
  WHERE is_premium = true
    AND subscription_expires_at <= NOW();

  -- Recent purchases
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', pu.id,
      'userId', pu.user_id,
      'userName', COALESCE(p.first_name || ' ' || COALESCE(p.last_name, ''), 'کاربر'),
      'amount', pu.amount,
      'status', pu.status,
      'createdAt', pu.created_at,
      'courseId', pu.course_id
    ) ORDER BY pu.created_at DESC
  ) INTO v_recent_purchases
  FROM public.purchases pu
  JOIN public.profiles p ON p.id = pu.user_id
  LIMIT 50;

  RETURN jsonb_build_object(
    'ok', true,
    'stats', jsonb_build_object(
      'totalPurchases', v_total_purchases,
      'successfulPurchases', v_successful_purchases,
      'totalRevenue', v_total_revenue,
      'revenueToday', v_revenue_today,
      'revenueWeek', v_revenue_week,
      'revenueMonth', v_revenue_month,
      'activeSubscriptions', v_active_subscriptions,
      'expiredSubscriptions', v_expired_subscriptions
    ),
    'recentPurchases', COALESCE(v_recent_purchases, '[]'::jsonb)
  );
END;
$$;

-- 7. Admin Courses Stats
CREATE OR REPLACE FUNCTION public.rpc_admin_get_courses_stats(p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean;
  v_total_courses int;
  v_active_courses int;
  v_courses_list jsonb;
BEGIN
  SELECT public.has_role(p_admin_id, 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  -- Total courses
  SELECT COUNT(*) INTO v_total_courses
  FROM public.courses;
  
  -- Active courses
  SELECT COUNT(*) INTO v_active_courses
  FROM public.courses
  WHERE active = true;

  -- Courses list with purchase stats
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'title', c.title,
      'price', c.price,
      'active', c.active,
      'totalPurchases', COALESCE(pu.count, 0),
      'revenue', COALESCE(pu.revenue, 0),
      'createdAt', c.created_at
    ) ORDER BY c.created_at DESC
  ) INTO v_courses_list
  FROM public.courses c
  LEFT JOIN (
    SELECT 
      course_id,
      COUNT(*) as count,
      SUM(amount) as revenue
    FROM public.purchases
    WHERE status = 'verified'
      AND course_id IS NOT NULL
    GROUP BY course_id
  ) pu ON pu.course_id = c.id;

  RETURN jsonb_build_object(
    'ok', true,
    'stats', jsonb_build_object(
      'totalCourses', v_total_courses,
      'activeCourses', v_active_courses
    ),
    'courses', COALESCE(v_courses_list, '[]'::jsonb)
  );
END;
$$;

-- 8. Admin App Health Stats
CREATE OR REPLACE FUNCTION public.rpc_admin_get_app_health(p_admin_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin boolean;
  v_db_size text;
  v_total_tables int;
  v_table_sizes jsonb;
BEGIN
  SELECT public.has_role(p_admin_id, 'admin') INTO v_is_admin;
  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unauthorized');
  END IF;

  -- Database size
  SELECT pg_size_pretty(pg_database_size(current_database())) INTO v_db_size;
  
  -- Total tables
  SELECT COUNT(*) INTO v_total_tables
  FROM information_schema.tables
  WHERE table_schema = 'public';

  -- Table sizes
  SELECT jsonb_agg(
    jsonb_build_object(
      'tableName', tablename,
      'rowCount', n_live_tup,
      'size', pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
    ) ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
  ) INTO v_table_sizes
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  LIMIT 20;

  RETURN jsonb_build_object(
    'ok', true,
    'health', jsonb_build_object(
      'dbSize', v_db_size,
      'totalTables', v_total_tables
    ),
    'tableSizes', COALESCE(v_table_sizes, '[]'::jsonb)
  );
END;
$$;