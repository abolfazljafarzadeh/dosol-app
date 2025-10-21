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

    const today = new Date().toISOString().split('T')[0];

    // Find leagues to close
    const { data: leagues, error: leaguesError } = await supabase
      .from('weekly_leagues')
      .select('*')
      .eq('status', 'open')
      .lte('week_end', today);

    if (leaguesError) {
      console.error('Leagues fetch error:', leaguesError);
      return new Response(
        JSON.stringify({ error: 'خطا در دریافت لیگ‌ها' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!leagues || leagues.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: 'No leagues to close' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    for (const league of leagues) {
      // Get all members and calculate ranks
      const { data: members, error: membersError } = await supabase
        .from('league_members')
        .select('*')
        .eq('league_id', league.id)
        .order('weekly_xp', { ascending: false });

      if (membersError) {
        console.error('Members fetch error:', membersError);
        continue;
      }

      if (members && members.length > 0) {
        // Update ranks
        for (let i = 0; i < members.length; i++) {
          const member = members[i];
          const rank = i + 1;

          await supabase
            .from('league_members')
            .update({ rank, updated_at: new Date().toISOString() })
            .eq('id', member.id);

          // Award medals based on rank
          let medalCode: string | null = null;
          if (rank === 1) {
            medalCode = 'league-first';
          } else if (rank === 2) {
            medalCode = 'league-second';
          } else if (rank === 3) {
            medalCode = 'league-third';
          }

          if (medalCode) {
            const { data: medal } = await supabase
              .from('medals')
              .select('id')
              .eq('code', medalCode)
              .single();

            if (medal) {
              const { data: existingMedal } = await supabase
                .from('user_medals')
                .select('id')
                .eq('user_id', member.user_id)
                .eq('medal_id', medal.id)
                .single();

              if (!existingMedal) {
                await supabase
                  .from('user_medals')
                  .insert({
                    user_id: member.user_id,
                    medal_id: medal.id,
                  });
              }
            }
          }
        }
      }

      // Lock the league
      await supabase
        .from('weekly_leagues')
        .update({ status: 'locked' })
        .eq('id', league.id);

      console.log('League closed:', league.id);
    }

    return new Response(
      JSON.stringify({ ok: true, closed_count: leagues.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Close weekly league error:', error);
    return new Response(
      JSON.stringify({ error: 'خطای سرور' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
