import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    console.log('🏆 User joining league:', user.id);

    // Get user profile with all required fields
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('tz, level, first_name, instrument, is_premium, subscription_expires_at')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
      throw new Error('Failed to fetch user profile');
    }

    // ✅ Validation: Check required profile fields
    if (!profile.first_name || !profile.instrument || !profile.level) {
      console.log('❌ Incomplete profile:', { 
        first_name: !!profile.first_name, 
        instrument: !!profile.instrument, 
        level: !!profile.level 
      });
      return new Response(
        JSON.stringify({ 
          ok: false, 
          code: 'INCOMPLETE_PROFILE',
          message: 'پروفایل شما ناقص است. لطفاً نام، ساز و سطح مهارت خود را تکمیل کنید.',
          missingFields: {
            first_name: !profile.first_name,
            instrument: !profile.instrument,
            level: !profile.level
          }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ Validation: Check premium subscription
    const isPremiumActive = profile.is_premium === true && 
                           profile.subscription_expires_at !== null &&
                           new Date(profile.subscription_expires_at) > new Date();

    if (!isPremiumActive) {
      console.log('❌ Premium subscription required');
      return new Response(
        JSON.stringify({ 
          ok: false, 
          code: 'PREMIUM_REQUIRED',
          message: 'برای شرکت در لیگ هفتگی، باید اشتراک پریمیوم داشته باشید.'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User eligible for league:', { 
      name: profile.first_name, 
      instrument: profile.instrument, 
      level: profile.level,
      premium: isPremiumActive
    });

    const userTz = profile?.tz || 'Asia/Tehran';
    const now = new Date();
    
    // Calculate current week (Saturday to Friday)
    const dayOfWeek = now.getDay();
    const daysSinceSaturday = dayOfWeek === 6 ? 0 : (dayOfWeek + 1);
    
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - daysSinceSaturday);
    const weekStartStr = new Intl.DateTimeFormat('en-CA', { 
      timeZone: userTz, 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(weekStart);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndStr = new Intl.DateTimeFormat('en-CA', { 
      timeZone: userTz, 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).format(weekEnd);

    // Get user's skill tier
    const { data: tierData, error: tierError } = await supabaseClient.rpc('get_user_bucket_tier', {
      p_user_id: user.id
    });

    if (tierError) {
      console.error('❌ Error getting user tier:', tierError);
      throw tierError;
    }

    const userTier = tierData as 'beginner' | 'intermediate' | 'advanced';
    console.log('📊 User tier:', userTier);

    // Check if user is already in a league for this week
    const { data: existingMembership } = await supabaseClient
      .from('league_members')
      .select('league_id, weekly_leagues!inner(week_start)')
      .eq('user_id', user.id)
      .eq('weekly_leagues.week_start', weekStartStr)
      .maybeSingle();

    if (existingMembership) {
      console.log('✅ User already in league:', existingMembership.league_id);
      return new Response(
        JSON.stringify({ 
          ok: true, 
          message: 'Already in league',
          leagueId: existingMembership.league_id 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find or create a league for this week with matching tier
    let leagueId: string;

    // Find an open league with available space (capacity 10-15)
    const { data: availableLeagues } = await supabaseClient
      .from('weekly_leagues')
      .select('id, member_count, capacity')
      .eq('week_start', weekStartStr)
      .eq('status', 'open')
      .eq('bucket_tier', userTier)
      .lt('member_count', 15)
      .order('member_count', { ascending: false }); // Fill leagues closer to capacity first

    console.log('🔍 Available leagues for tier', userTier, ':', availableLeagues?.length || 0);

    if (availableLeagues && availableLeagues.length > 0) {
      // Join an existing league
      leagueId = availableLeagues[0].id;
      console.log('➕ Joining existing league:', leagueId);
    } else {
      // Create a new league with random capacity between 10-15
      const capacity = Math.floor(Math.random() * 6) + 10;
      console.log('🆕 Creating new league with capacity:', capacity);
      
      const { data: newLeague, error: leagueError } = await supabaseClient
        .from('weekly_leagues')
        .insert({
          week_start: weekStartStr,
          week_end: weekEndStr,
          start_local_week: weekStartStr,
          end_local_week: weekEndStr,
          status: 'open',
          bucket_tier: userTier,
          capacity: capacity,
          member_count: 0,
        })
        .select('id')
        .single();

      if (leagueError) {
        console.error('❌ Error creating league:', leagueError);
        throw leagueError;
      }
      leagueId = newLeague.id;
      console.log('✅ New league created:', leagueId);
    }

    // Add user to league
    const { error: memberError } = await supabaseClient
      .from('league_members')
      .insert({
        league_id: leagueId,
        user_id: user.id,
        weekly_xp: 0,
      });

    if (memberError) {
      console.error('❌ Error adding member:', memberError);
      throw memberError;
    }

    // Initialize league score
    const { error: scoreError } = await supabaseClient
      .from('league_scores')
      .insert({
        league_id: leagueId,
        user_id: user.id,
        xp_week: 0,
      });

    if (scoreError) {
      console.error('❌ Error initializing score:', scoreError);
      throw scoreError;
    }

    // Increment member count
    const { data: currentLeague } = await supabaseClient
      .from('weekly_leagues')
      .select('member_count')
      .eq('id', leagueId)
      .single();
    
    if (currentLeague) {
      await supabaseClient
        .from('weekly_leagues')
        .update({ member_count: (currentLeague.member_count || 0) + 1 })
        .eq('id', leagueId);
    }

    console.log('✅ User successfully joined league:', leagueId);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        leagueId: leagueId,
        tier: userTier,
        message: 'Joined league successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in join-weekly-league:', error);
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
