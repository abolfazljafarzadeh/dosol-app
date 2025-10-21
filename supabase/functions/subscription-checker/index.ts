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

    console.log('💳 Subscription checker triggered');

    const tz = 'Asia/Tehran';
    const now = new Date();
    const today = now.toLocaleDateString('en-CA', { timeZone: tz });

    // محاسبه ۳ روز بعد
    const threeDaysLater = new Date(now);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);
    const threeDaysDate = threeDaysLater.toLocaleDateString('en-CA', { timeZone: tz });

    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, subscription_expires_at, push_token')
      .eq('is_premium', true)
      .eq('notifications_enabled', true)
      .or(`subscription_expires_at.eq.${threeDaysDate},subscription_expires_at.eq.${today}`);

    if (error) throw error;
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ ok: true, message: 'No expiring subs' }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const notifications = users.map(u => {
      const days = u.subscription_expires_at === today ? 0 : 3;
      return {
        user_id: u.id,
        type: 'subscription_expiring',
        status: 'queued',
        payload: { expires_at: u.subscription_expires_at, days_left: days }
      };
    });

    await supabase.from('notifications').insert(notifications);

    const n8nUrl = Deno.env.get('N8N_BASE_URL');
    const n8nToken = Deno.env.get('N8N_WEBHOOK_TOKEN');

    if (n8nUrl && n8nToken) {
      // Retry logic: 3 attempts with 2 second delay
      let n8nSuccess = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const n8nResponse = await fetch(`${n8nUrl}/push/subscription/${n8nToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(users.map(u => {
              const days = u.subscription_expires_at === today ? 0 : 3;
              return {
                user_id: u.id,
                push_token: u.push_token || null,
                title: days === 0 ? '⚠️ اشتراک امروز تموم میشه!' : '⏰ یادآوری اشتراک',
                body: days === 0 ? 'اشتراکت امروز تموم میشه! تمدیدش کن تا تمرین‌هات قطع نشه 🎶' : 'اشتراکت تا ۳ روز دیگه تموم میشه، تمدیدش کن تا تمرین‌هات قطع نشه 🎶',
                type: 'subscription',
                data: { type: 'subscription', expires_at: u.subscription_expires_at, days_left: days }
              };
            }))
          });

          if (n8nResponse.ok) {
            console.log(`✅ Sent subscription notifications to n8n (attempt ${attempt})`);
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
        console.error('❌ Failed to send subscription notifications to n8n after 3 attempts');
      }
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        notificationsSent: notifications.length,
        totalUsers: users.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in subscription-checker:', error);
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
