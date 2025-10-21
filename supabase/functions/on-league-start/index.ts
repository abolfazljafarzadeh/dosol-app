import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🏁 Weekly league start notification triggered');

    const tz = 'Asia/Tehran';
    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });

    // پیدا کردن لیگ‌های جدیدی که امروز شروع شدند
    const { data: newLeagues, error: leagueError } = await supabase
      .from('weekly_leagues')
      .select('id, week_start, week_end')
      .eq('week_start', today)
      .eq('status', 'open');

    if (leagueError) {
      throw leagueError;
    }

    if (!newLeagues || newLeagues.length === 0) {
      console.log('ℹ️ No new leagues starting today');
      return new Response(
        JSON.stringify({ ok: true, message: 'No new leagues today' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // پیدا کردن همه کاربران فعال با نوتیفیکیشن فعال و push_token
    const { data: activeUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, push_token')
      .eq('notifications_enabled', true)
      .not('push_token', 'is', null);

    if (usersError) {
      throw usersError;
    }

    if (!activeUsers || activeUsers.length === 0) {
      console.log('ℹ️ No active users with notifications enabled');
      return new Response(
        JSON.stringify({ ok: true, message: 'No active users found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ایجاد notification برای همه کاربران فعال
    const notifications = activeUsers.map(user => ({
      user_id: user.id,
      type: 'league_start',
      status: 'queued',
      payload: {
        league_id: newLeagues[0].id,
        message: 'لیگ جدید شروع شد 🎯 با اولین تمرین وارد رقابت شو!',
        week_start: newLeagues[0].week_start,
        week_end: newLeagues[0].week_end
      }
    }));

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('❌ Error inserting notifications:', insertError);
      throw insertError;
    }

    console.log(`✅ Created ${notifications.length} league start notifications`);

    // ارسال به n8n برای push notification
    const n8nUrl = Deno.env.get('N8N_BASE_URL');
    const n8nToken = Deno.env.get('N8N_WEBHOOK_TOKEN');

    if (n8nUrl && n8nToken) {
      const n8nPayload = activeUsers.map(user => ({
        user_id: user.id,
        push_token: user.push_token,
        title: '🎯 لیگ جدید شروع شد!',
        body: 'با اولین تمرین وارد رقابت شو و امتیاز بگیر!',
        type: 'league',
        phase: 'start',
        data: {
          type: 'league',
          phase: 'start',
          league_id: newLeagues[0].id
        }
      }));

      const n8nResponse = await fetch(`${n8nUrl}/push/league/${n8nToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(n8nPayload)
      });

      if (!n8nResponse.ok) {
        console.error('❌ n8n webhook error:', await n8nResponse.text());
      } else {
        console.log('✅ Sent league start notifications to n8n');
      }
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        notificationsSent: notifications.length,
        leagues: newLeagues.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in on-league-start:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ ok: false, error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
