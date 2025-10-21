-- Drop and recreate the function with correct SQL
DROP FUNCTION IF EXISTS public.rpc_get_global_ranking(uuid);

CREATE OR REPLACE FUNCTION public.rpc_get_global_ranking(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_rank INT;
  v_user_xp INT;
  v_total_users INT;
  v_top_three jsonb;
  v_surrounding jsonb;
BEGIN
  -- Get total active users (users with at least 1 XP)
  SELECT COUNT(*) INTO v_total_users
  FROM public.xp_counters
  WHERE total_xp > 0;

  -- Get user's XP and rank
  SELECT 
    xc1.total_xp,
    (SELECT COUNT(*) + 1 FROM public.xp_counters xc2 WHERE xc2.total_xp > xc1.total_xp) as rank
  INTO v_user_xp, v_user_rank
  FROM public.xp_counters xc1
  WHERE xc1.user_id = p_user_id;

  -- Get top 3 users
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', ranked.id,
      'name', ranked.name,
      'instrument', ranked.instrument,
      'totalPoints', ranked.total_xp,
      'rank', ranked.row_number
    )
  )
  INTO v_top_three
  FROM (
    SELECT 
      p.id,
      COALESCE(p.first_name || ' ' || COALESCE(p.last_name, ''), 'کاربر') as name,
      COALESCE(p.instrument, 'پیانو') as instrument,
      xc.total_xp,
      ROW_NUMBER() OVER (ORDER BY xc.total_xp DESC) as row_number
    FROM public.profiles p
    JOIN public.xp_counters xc ON xc.user_id = p.id
    WHERE xc.total_xp > 0
    ORDER BY xc.total_xp DESC
    LIMIT 3
  ) ranked;

  -- Get surrounding users (2 above current user, current user, 2 below)
  WITH ranked_users AS (
    SELECT 
      p.id,
      COALESCE(p.first_name || ' ' || COALESCE(p.last_name, ''), 'کاربر') as name,
      COALESCE(p.instrument, 'پیانو') as instrument,
      xc.total_xp,
      ROW_NUMBER() OVER (ORDER BY xc.total_xp DESC) as rank
    FROM public.profiles p
    JOIN public.xp_counters xc ON xc.user_id = p.id
    WHERE xc.total_xp > 0
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'name', name,
      'instrument', instrument,
      'totalPoints', total_xp,
      'rank', rank,
      'isCurrentUser', id = p_user_id
    )
  )
  INTO v_surrounding
  FROM (
    SELECT *
    FROM ranked_users
    WHERE rank BETWEEN GREATEST(1, v_user_rank - 2) AND v_user_rank + 2
    ORDER BY rank
  ) sub;

  RETURN jsonb_build_object(
    'ok', true,
    'userRank', COALESCE(v_user_rank, v_total_users + 1),
    'userXp', COALESCE(v_user_xp, 0),
    'totalUsers', v_total_users,
    'topThree', COALESCE(v_top_three, '[]'::jsonb),
    'surrounding', COALESCE(v_surrounding, '[]'::jsonb)
  );
END;
$function$;