import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user timezone
    const { data: profile } = await supabase
      .from('profiles')
      .select('tz, first_name, last_name, instrument')
      .eq('id', user.id)
      .single();

    const userTz = profile?.tz || 'Asia/Tehran';

    // Calculate current week (Saturday to Friday)
    const now = new Date();
    const localNow = new Date(now.toLocaleString('en-US', { timeZone: userTz }));
    const dayOfWeek = localNow.getDay();
    
    // Calculate Saturday (start of week)
    const daysToSaturday = (dayOfWeek + 1) % 7;
    const weekStart = new Date(localNow);
    weekStart.setDate(localNow.getDate() - daysToSaturday);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekEndStr = weekEnd.toISOString().split('T')[0];

    // Find user's league for this week
    const { data: userLeagueMember } = await supabase
      .from('league_members')
      .select('league_id, rank, weekly_leagues!inner(id, week_start, week_end, status)')
      .eq('user_id', user.id)
      .eq('weekly_leagues.week_start', weekStartStr)
      .single();

    // Check if user has practiced this week
    const { data: practiceLogs } = await supabase
      .from('practice_logs')
      .select('id')
      .eq('user_id', user.id)
      .gte('local_date', weekStartStr)
      .lte('local_date', weekEndStr)
      .limit(1);

    const hasPracticedThisWeek = practiceLogs && practiceLogs.length > 0;

    // If user hasn't joined a league yet
    if (!userLeagueMember) {
      return new Response(
        JSON.stringify({
          ok: true,
          hasPracticedThisWeek,
          inLeague: false,
          weekStart: weekStartStr,
          weekEnd: weekEndStr,
          leaguePlayers: [],
          userStatus: null
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const leagueId = userLeagueMember.league_id;

    // Get user's score
    const { data: userScore } = await supabase
      .from('league_scores')
      .select('xp_week')
      .eq('user_id', user.id)
      .eq('league_id', leagueId)
      .single();

    // Get all league members with their scores (limit to top 15)
    const { data: leagueMembers, error: membersError } = await supabase
      .from('league_members')
      .select(`
        user_id,
        rank,
        profiles!inner(first_name, last_name, instrument),
        league_scores!inner(xp_week)
      `)
      .eq('league_id', leagueId)
      .eq('league_scores.league_id', leagueId)
      .order('league_scores(xp_week)', { ascending: false })
      .limit(15);

    if (membersError) {
      console.error('Error fetching league members:', membersError);
      throw membersError;
    }

    // Calculate ranks dynamically based on xp_week
    const sortedMembers = (leagueMembers || [])
      .map((member: any) => ({
        userId: member.user_id,
        name: `${member.profiles.first_name || ''} ${member.profiles.last_name || ''}`.trim() || 'کاربر',
        instrument: member.profiles.instrument || 'پیانو',
        weeklyPoints: member.league_scores[0]?.xp_week || 0,
        isCurrentUser: member.user_id === user.id
      }))
      .sort((a: any, b: any) => b.weeklyPoints - a.weeklyPoints)
      .map((member: any, index: number) => ({
        ...member,
        rank: index + 1
      }));

    // Find current user in sorted list
    const currentUserIndex = sortedMembers.findIndex((m: any) => m.isCurrentUser);
    const currentUserRank = currentUserIndex >= 0 ? currentUserIndex + 1 : null;
    const nextPlayer = currentUserIndex > 0 ? sortedMembers[currentUserIndex - 1] : null;
    const pointsToNext = nextPlayer ? nextPlayer.weeklyPoints - (userScore?.xp_week || 0) : 0;

    return new Response(
      JSON.stringify({
        ok: true,
        hasPracticedThisWeek,
        inLeague: true,
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
        leaguePlayers: sortedMembers,
        userStatus: {
          rank: currentUserRank,
          weeklyPoints: userScore?.xp_week || 0,
          pointsToNext: pointsToNext > 0 ? pointsToNext : 0,
          nextPlayerRank: nextPlayer?.rank || null
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in get-weekly-league:', error);
    return new Response(
      JSON.stringify({ error: 'خطای سرور' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
