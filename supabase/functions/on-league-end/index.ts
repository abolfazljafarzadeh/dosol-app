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

    console.log('🏁 Weekly league end notification triggered');

    const tz = 'Asia/Tehran';
    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });

    // پیدا کردن لیگ‌هایی که امروز تمام شدند
    const { data: endingLeagues, error: leagueError } = await supabase
      .from('weekly_leagues')
      .select('id, week_start, week_end')
      .eq('week_end', today)
      .eq('status', 'finalized');

    if (leagueError) {
      throw leagueError;
    }

    if (!endingLeagues || endingLeagues.length === 0) {
      console.log('ℹ️ No leagues ending today');
      return new Response(
        JSON.stringify({ ok: true, message: 'No leagues ending today' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const leagueIds = endingLeagues.map(l => l.id);

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

    // پیدا کردن اعضای لیگ با رتبه نهایی
    const { data: members, error: membersError } = await supabase
      .from('league_members')
      .select(`
        user_id,
        league_id,
        rank,
        league_scores!inner(xp_week)
      `)
      .in('league_id', leagueIds);

    if (membersError) {
      throw membersError;
    }

    // محاسبه تعداد کل اعضا هر لیگ
    const leagueMemberCounts: Record<string, number> = {};
    members?.forEach(m => {
      leagueMemberCounts[m.league_id] = (leagueMemberCounts[m.league_id] || 0) + 1;
    });

    // ساخت Map از اعضای لیگ برای دسترسی سریع
    const memberMap = new Map(members?.map(m => [m.user_id, m]) || []);

    // ایجاد notification برای همه کاربران فعال
    const notifications = activeUsers.map(user => {
      const member = memberMap.get(user.id);
      
      if (member) {
        // کاربر عضو لیگ بود - پیام شخصی‌سازی شده با رتبه
        const totalMembers = leagueMemberCounts[member.league_id];
        const rank = member.rank || totalMembers;
        const xpWeek = member.league_scores?.[0]?.xp_week || 0;

        let message = '';
        if (rank === 1) {
          message = `🏆 لیگ تموم شد! رتبه اول شدی با ${xpWeek} امتیاز!`;
        } else if (rank <= 3) {
          message = `🥈 لیگ تموم شد! رتبه ${rank} از ${totalMembers} نفر - عالی بودی!`;
        } else {
          message = `لیگ تموم شد! رتبه‌ت: #${rank} از ${totalMembers} نفر 👏`;
        }

        return {
          user_id: user.id,
          type: 'league_end',
          status: 'queued',
          payload: {
            league_id: member.league_id,
            rank,
            total_members: totalMembers,
            xp_week: xpWeek,
            message
          }
        };
      } else {
        // کاربر عضو لیگ نبود - پیام عمومی
        return {
          user_id: user.id,
          type: 'league_end',
          status: 'queued',
          payload: {
            league_id: endingLeagues[0].id,
            message: 'لیگ تموم شد! لیگ جدید به زودی شروع میشه 🏆'
          }
        };
      }
    });

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) {
      console.error('❌ Error inserting notifications:', insertError);
      throw insertError;
    }

    console.log(`✅ Created ${notifications.length} league end notifications`);

    // ارسال به n8n برای push notification
    const n8nUrl = Deno.env.get('N8N_BASE_URL');
    const n8nToken = Deno.env.get('N8N_WEBHOOK_TOKEN');

    if (n8nUrl && n8nToken) {
      const userMap = new Map(activeUsers.map(u => [u.id, u.push_token]));
      
      const n8nPayload = notifications.map(n => {
        const rank = n.payload.rank;
        const total = n.payload.total_members;
        
        let title = '🏁 لیگ تموم شد!';
        let body = '';
        
        if (rank) {
          // کاربر عضو لیگ بود
          body = `رتبه‌ت: #${rank} از ${total} نفر`;
          if (rank === 1) {
            body += ' 🏆 تبریک قهرمان!';
          } else if (rank <= 3) {
            body += ' 👏 عالی بود!';
          }
        } else {
          // کاربر عضو لیگ نبود
          body = 'لیگ جدید به زودی شروع میشه 🏆';
        }

        return {
          user_id: n.user_id,
          push_token: userMap.get(n.user_id) || null,
          title: title,
          body: body,
          type: 'league',
          phase: 'end',
          rank: rank || null,
          total: total || null,
          data: {
            type: 'league',
            phase: 'end',
            rank: rank || null,
            total: total || null,
            league_id: n.payload.league_id
          }
        };
      });

      const n8nResponse = await fetch(`${n8nUrl}/push/league/${n8nToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(n8nPayload)
      });

      if (!n8nResponse.ok) {
        console.error('❌ n8n webhook error:', await n8nResponse.text());
      } else {
        console.log('✅ Sent league end notifications to n8n');
      }
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        notificationsSent: notifications.length,
        leagues: endingLeagues.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in on-league-end:', error);
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
