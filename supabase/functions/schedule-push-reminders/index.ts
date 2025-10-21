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

    const n8nUrl = Deno.env.get('N8N_BASE_URL');
    const n8nToken = Deno.env.get('N8N_WEBHOOK_TOKEN');

    if (!n8nUrl || !n8nToken) {
      console.log('n8n not configured');
      return new Response(
        JSON.stringify({ ok: true, message: 'n8n not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all users with notifications enabled and push token
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, tz, push_token')
      .eq('notifications_enabled', true)
      .not('push_token', 'is', null);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      return new Response(
        JSON.stringify({ ok: false, error: 'Failed to fetch profiles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profiles || profiles.length === 0) {
      console.log('No users with notifications enabled');
      return new Response(
        JSON.stringify({ ok: true, sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let sentCount = 0;
    const now = new Date();

    for (const profile of profiles) {
      const tz = profile.tz || 'Asia/Tehran';
      
      // Calculate local time in user's timezone
      const localTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));
      const currentDay = localTime.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      const currentHour = localTime.getHours();
      const currentMinute = localTime.getMinutes();

      // Get user's training plan
      const { data: plan } = await supabase
        .from('training_plans')
        .select('days, times')
        .eq('user_id', profile.id)
        .single();

      if (!plan || !plan.days || !plan.times) {
        continue;
      }

      // Check if today is a practice day
      if (!plan.days.includes(currentDay)) {
        continue;
      }

      // Check if current time matches any practice time (±5 minutes)
      let timeMatches = false;
      for (const timeKey in plan.times) {
        if (plan.times[timeKey] === true) {
          const [hour, minute] = timeKey.split(':').map(Number);
          const timeDiff = Math.abs((currentHour * 60 + currentMinute) - (hour * 60 + minute));
          
          if (timeDiff <= 5) {
            timeMatches = true;
            break;
          }
        }
      }

      if (!timeMatches) {
        continue;
      }

      // Send notification
      const payload = {
        user_id: profile.id,
        push_token: profile.push_token,
        title: '🎵 وقت تمرینه!',
        body: 'امروز رو به تمرین بپرداز و امتیاز بگیر!',
        type: 'reminder',
        data: {
          type: 'reminder',
          timezone: tz
        }
      };

      // Retry logic for n8n webhook
      let attempts = 0;
      const maxAttempts = 3;
      let success = false;

      while (attempts < maxAttempts && !success) {
        try {
          const response = await fetch(`${n8nUrl}/push/reminder/${n8nToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            console.log(`✅ Reminder sent to user ${profile.id}`);
            success = true;
            sentCount++;
            
            // Log to notifications table
            await supabase
              .from('notifications')
              .insert({
                user_id: profile.id,
                type: 'practice_reminder',
                status: 'sent',
                payload: payload
              });
          } else {
            const errorText = await response.text();
            console.error(`❌ n8n webhook error for user ${profile.id} (attempt ${attempts + 1}):`, errorText);
          }
        } catch (fetchError) {
          console.error(`❌ n8n fetch error for user ${profile.id} (attempt ${attempts + 1}):`, fetchError);
        }

        attempts++;
        if (attempts < maxAttempts && !success) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
        }
      }

      if (!success) {
        console.error(`❌ Failed to send reminder to user ${profile.id} after ${maxAttempts} attempts`);
      }
    }

    console.log(`✅ Sent ${sentCount} reminders`);
    return new Response(
      JSON.stringify({ ok: true, sent: sentCount }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Schedule push reminders error:', error);
    return new Response(
      JSON.stringify({ error: 'خطای سرور' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
