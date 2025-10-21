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

    const { eventType, inviterId, inviteeId } = await req.json();
    console.log('🎉 Invite reward event:', { eventType, inviterId, inviteeId });

    let notifications: any[] = [];
    let message = '';

    // بررسی که کاربر دعوت‌کننده notifications_enabled داشته باشه و push_token
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('notifications_enabled, push_token')
      .eq('id', inviterId)
      .single();

    if (!inviterProfile?.notifications_enabled) {
      console.log('📵 Notifications disabled for inviter');
      return new Response(
        JSON.stringify({ ok: true, message: 'Notifications disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let title = '';
    let body = '';
    let notifType = '';

    switch (eventType) {
      case 'new_signup':
        title = '🎉 دوست جدید!';
        body = 'یه دوست جدید دعوت کردی و ۱۰۰ سکه گرفتی!';
        notifType = 'invite_signup';
        break;
      case 'first_practice':
        title = '⭐ پاداش دعوت!';
        body = 'دوستت تمرین کرد! ۵۰ امتیاز جدید برات ثبت شد.';
        notifType = 'invite_practice';
        break;
      default:
        return new Response(
          JSON.stringify({ ok: false, error: 'Unknown event type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    notifications.push({
      user_id: inviterId,
      type: notifType,
      status: 'queued',
      payload: { invitee_id: inviteeId, message: body }
    });

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (insertError) throw insertError;

    // ارسال به n8n
    const n8nUrl = Deno.env.get('N8N_BASE_URL');
    const n8nToken = Deno.env.get('N8N_WEBHOOK_TOKEN');

    if (n8nUrl && n8nToken) {
      const n8nResponse = await fetch(`${n8nUrl}/push/invite/${n8nToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: inviterId,
          push_token: inviterProfile.push_token || null,
          title,
          body,
          type: 'invite',
          data: { type: 'invite', event_type: eventType, invitee_id: inviteeId }
        })
      });

      if (!n8nResponse.ok) {
        console.error('❌ n8n webhook error:', await n8nResponse.text());
      } else {
        console.log('✅ Sent invite reward notification to n8n');
      }
    }

    return new Response(
      JSON.stringify({ 
        ok: true, 
        notificationsSent: notifications.length,
        eventType
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Error in on-invite-reward:', error);
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
