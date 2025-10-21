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

    // Calculate week_start (Saturday) and week_end (Friday)
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sunday, 6=Saturday
    
    // Find next Saturday (week_start)
    let daysUntilSaturday = (6 - dayOfWeek + 7) % 7;
    if (daysUntilSaturday === 0 && now.getHours() > 0) {
      daysUntilSaturday = 7;
    }
    
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + daysUntilSaturday);
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // Friday
    weekEnd.setHours(23, 59, 59, 999);

    // Check if league already exists
    const { data: existingLeague } = await supabase
      .from('weekly_leagues')
      .select('id')
      .eq('week_start', weekStart.toISOString().split('T')[0])
      .single();

    if (existingLeague) {
      console.log('League already exists for this week');
      return new Response(
        JSON.stringify({ ok: true, message: 'League already exists' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new league
    const { data: newLeague, error: leagueError } = await supabase
      .from('weekly_leagues')
      .insert({
        week_start: weekStart.toISOString().split('T')[0],
        week_end: weekEnd.toISOString().split('T')[0],
        status: 'open',
      })
      .select()
      .single();

    if (leagueError) {
      console.error('League creation error:', leagueError);
      return new Response(
        JSON.stringify({ error: 'خطا در ایجاد لیگ' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('New league created:', newLeague);

    return new Response(
      JSON.stringify({ ok: true, league: newLeague }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Open weekly league error:', error);
    return new Response(
      JSON.stringify({ error: 'خطای سرور' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
