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
    // Verify cron secret
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== Deno.env.get('CRON_SECRET')) {
      console.error('❌ Invalid cron secret');
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('🏆 Auto-joining eligible users to weekly leagues...');

    const now = new Date();
    const userTz = 'Asia/Tehran';
    
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

    // Find all eligible users:
    // 1. Premium subscription active
    // 2. Profile complete (first_name, instrument, level)
    // 3. Not already in this week's league
    const { data: eligibleUsers, error: usersError } = await supabaseAdmin
      .from('profiles')
      .select('id, first_name, instrument, level, is_premium, subscription_expires_at')
      .eq('is_premium', true)
      .not('first_name', 'is', null)
      .not('instrument', 'is', null)
      .not('level', 'is', null)
      .gt('subscription_expires_at', now.toISOString());

    if (usersError) {
      console.error('❌ Error fetching eligible users:', usersError);
      throw usersError;
    }

    console.log(`📊 Found ${eligibleUsers?.length || 0} eligible users`);

    if (!eligibleUsers || eligibleUsers.length === 0) {
      return new Response(
        JSON.stringify({ 
          ok: true, 
          message: 'No eligible users found',
          joined: 0,
          skipped: 0
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let joinedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Join each eligible user to the league
    for (const user of eligibleUsers) {
      try {
        // Check if already in this week's league
        const { data: existingMembership } = await supabaseAdmin
          .from('league_members')
          .select('league_id, weekly_leagues!inner(week_start)')
          .eq('user_id', user.id)
          .eq('weekly_leagues.week_start', weekStartStr)
          .maybeSingle();

        if (existingMembership) {
          console.log(`⏭️  User ${user.id} already in league`);
          skippedCount++;
          continue;
        }

        // Call join-weekly-league function
        const { data: joinResult, error: joinError } = await supabaseAdmin.functions.invoke(
          'join-weekly-league',
          {
            headers: {
              Authorization: `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
            },
            body: { userId: user.id }
          }
        );

        if (joinError) {
          console.error(`❌ Error joining user ${user.id}:`, joinError);
          errors.push(`User ${user.id}: ${joinError.message}`);
          continue;
        }

        if (joinResult?.ok) {
          console.log(`✅ User ${user.id} joined league ${joinResult.leagueId}`);
          joinedCount++;
        } else {
          console.log(`⚠️  User ${user.id} join failed:`, joinResult?.error || joinResult?.message);
          skippedCount++;
        }

      } catch (err) {
        console.error(`❌ Exception joining user ${user.id}:`, err);
        errors.push(`User ${user.id}: ${(err as Error).message}`);
      }
    }

    console.log(`✅ Auto-join complete: ${joinedCount} joined, ${skippedCount} skipped`);

    return new Response(
      JSON.stringify({ 
        ok: true,
        message: 'Auto-join complete',
        joined: joinedCount,
        skipped: skippedCount,
        errors: errors.length > 0 ? errors : undefined
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in auto-join-weekly-leagues:', error);
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
