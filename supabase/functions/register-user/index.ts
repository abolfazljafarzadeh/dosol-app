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
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'احراز هویت الزامی است' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'توکن نامعتبر' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { first_name, last_name, instrument, level, tz, invite_code } = await req.json();

    if (!first_name || !instrument || !level) {
      return new Response(
        JSON.stringify({ error: 'نام، ساز و سطح الزامی است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        first_name,
        last_name: last_name || '',
        instrument,
        level,
        tz: tz || 'Asia/Tehran',
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Profile update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'خطا در به‌روزرسانی پروفایل' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle invite code if provided
    if (invite_code) {
      try {
        // Find the invite
        const { data: invite, error: inviteError } = await supabase
          .from('invites')
          .select('id, inviter_id, status')
          .eq('invite_code', invite_code)
          .eq('status', 'pending')
          .single();

        if (!inviteError && invite) {
          // Update invite status
          await supabase
            .from('invites')
            .update({
              invitee_id: user.id,
              status: 'accepted',
              accepted_at: new Date().toISOString()
            })
            .eq('id', invite.id);

          // Award coins to inviter (100 coins for signup)
          await supabase
            .from('xp_events')
            .insert({
              user_id: invite.inviter_id,
              source: 'invite_signup',
              delta: 100,
              local_date: new Date().toISOString().split('T')[0]
            });

          await supabase
            .from('xp_counters')
            .update({ total_xp: supabase.rpc('increment', { x: 100 }) })
            .eq('user_id', invite.inviter_id);

          // Trigger invite reward notification
          const n8nUrl = Deno.env.get('N8N_BASE_URL');
          const n8nToken = Deno.env.get('N8N_WEBHOOK_TOKEN');

          if (n8nUrl && n8nToken) {
            // Get inviter's push token
            const { data: inviterProfile } = await supabase
              .from('profiles')
              .select('push_token, notifications_enabled')
              .eq('id', invite.inviter_id)
              .single();

            if (inviterProfile?.notifications_enabled && inviterProfile.push_token) {
              await fetch(`${n8nUrl}/push/invite/${n8nToken}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  user_id: invite.inviter_id,
                  push_token: inviterProfile.push_token,
                  title: '🎉 دوست جدید!',
                  body: 'یه دوست جدید دعوت کردی و ۱۰۰ سکه گرفتی!',
                  type: 'invite',
                  phase: 'signup',
                  data: {
                    type: 'invite',
                    event_type: 'new_signup',
                    invitee_id: user.id
                  }
                })
              });
            }
          }

          console.log('✅ Invite processed:', invite_code);
        }
      } catch (inviteErr) {
        console.error('⚠️ Invite processing error (non-critical):', inviteErr);
      }
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Register user error:', error);
    return new Response(
      JSON.stringify({ error: 'خطای سرور' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
