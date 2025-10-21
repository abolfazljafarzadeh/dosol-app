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

    const { notificationType } = await req.json();
    console.log('📢 Challenge notifier triggered:', notificationType);

    const tz = 'Asia/Tehran';
    const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });

    let users: any[] = [];
    let title = '';
    let body = '';
    let phase = '';

    switch (notificationType) {
      case 'challenge_start':
        // یافتن کاربرانی که چالش جدید دارند
        const { data: activeUsers } = await supabase
          .from('challenge_instances')
          .select(`
            user_id,
            challenge_code,
            challenges!inner(title)
          `)
          .eq('status', 'open')
          .gte('window_start', today)
          .lte('window_start', today);

        users = activeUsers || [];
        title = '💪 چالش جدید شروع شد!';
        body = 'بریم که بتونی این چالش رو کامل کنی!';
        phase = 'start';
        break;

      case 'challenge_midweek':
        // یادآوری میانه هفته - کاربرانی که چالش incomplete دارند
        const { data: midweekUsers } = await supabase
          .from('user_challenge_progress')
          .select(`
            user_id,
            instance_id,
            progress,
            challenge_instances!inner(
              challenge_code,
              challenges(title, conditions)
            )
          `)
          .eq('is_completed', false);

        users = (midweekUsers || []).filter((u: any) => {
          const daysDone = u.progress?.days_done || 0;
          const targetDays = u.challenge_instances?.challenges?.conditions?.min_days || 5;
          return daysDone < targetDays;
        });
        title = '⏰ یادآوری چالش';
        body = 'فقط دو روز دیگه تا تکمیل چالش باقی مونده!';
        phase = 'mid';
        break;

      case 'challenge_end':
        // پایان چالش - فقط کاربرانی که complete کردند
        const { data: completedUsers } = await supabase
          .from('user_challenge_progress')
          .select(`
            user_id,
            challenge_instances!inner(
              window_end,
              challenges(title)
            )
          `)
          .eq('is_completed', true)
          .gte('challenge_instances.window_end', today)
          .lte('challenge_instances.window_end', today);

        users = completedUsers || [];
        title = '🏅 تبریک!';
        body = 'چالش رو کامل کردی و مدال گرفتی!';
        phase = 'end';
        break;
    }

    // Get push_token for users with notifications enabled
    const userIds = [...new Set(users.map(u => u.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, push_token')
      .in('id', userIds)
      .eq('notifications_enabled', true);

    const userMap = new Map(profiles?.map(p => [p.id, p.push_token]) || []);
    const filteredUsers = users.filter(u => userMap.has(u.user_id));

    // ایجاد notifications در دیتابیس
    const notifications = filteredUsers.map(user => ({
      user_id: user.user_id,
      type: notificationType,
      status: 'queued',
      payload: {
        message: body,
        phase: phase,
        timestamp: new Date().toISOString()
      }
    }));

    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (insertError) {
        console.error('❌ Error inserting notifications:', insertError);
      } else {
        console.log(`✅ Created ${notifications.length} notifications`);
      }
    }

    // ارسال به n8n برای push notification
    const n8nUrl = Deno.env.get('N8N_BASE_URL');
    const n8nToken = Deno.env.get('N8N_WEBHOOK_TOKEN');

    if (n8nUrl && n8nToken && notifications.length > 0) {
      const n8nPayload = filteredUsers.map(u => ({
        user_id: u.user_id,
        push_token: userMap.get(u.user_id) || null,
        title: title,
        body: body,
        type: 'challenge',
        phase: phase,
        data: {
          type: 'challenge',
          phase: phase,
          notification_type: notificationType
        }
      }));

      // Retry logic: 3 attempts with 2 second delay
      let n8nSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const n8nResponse = await fetch(`${n8nUrl}/push/challenge/${n8nToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(n8nPayload)
          });

          if (n8nResponse.ok) {
            console.log(`✅ Sent to n8n successfully (attempt ${attempt})`);
            n8nSuccess = true;
            break;
          } else {
            console.error(`❌ n8n webhook error (attempt ${attempt}):`, await n8nResponse.text());
          }
        } catch (err) {
          console.error(`❌ n8n webhook fetch failed (attempt ${attempt}):`, err);
        }

        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      if (!n8nSuccess) {
        console.error('❌ Failed to send to n8n after 3 attempts');
      }
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        notificationsSent: notifications.length,
        type: notificationType
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in challenge-notifier:', error);
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
