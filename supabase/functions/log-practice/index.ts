import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LogPracticeRequest {
  minutes: number;
  note?: string;
  idempotency_key: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    console.log('🔐 Authorization header:', authHeader ? 'Present' : 'Missing');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('❌ No valid authorization header');
      throw new Error('Unauthorized');
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Use admin client to verify token and get user
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError) {
      console.error('❌ Token verification error:', userError);
      throw new Error('Unauthorized');
    }
    
    if (!user) {
      console.error('❌ No user found from token');
      throw new Error('Unauthorized');
    }
    
    console.log('✅ User authenticated:', user.id);

    const { minutes, note, idempotency_key }: LogPracticeRequest = await req.json();

    // Validation
    if (!minutes || minutes < 5 || minutes > 240) {
      return new Response(
        JSON.stringify({ ok: false, code: 'MIN_DURATION', message: 'Minutes must be between 5 and 240' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!idempotency_key) {
      return new Response(
        JSON.stringify({ ok: false, code: 'MISSING_IDEMPOTENCY_KEY', message: 'Idempotency key required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ✅ Call atomic RPC function using admin client
    const { data: result, error: rpcError } = await supabaseAdmin.rpc('rpc_log_practice', {
      p_user_id: user.id,
      p_minutes: minutes,
      p_note: note || null,
      p_idempotency_key: idempotency_key,
      p_now_utc: new Date().toISOString(),
    });

    if (rpcError) {
      console.error('RPC error:', rpcError);
      throw rpcError;
    }

    // Check for error responses from RPC
    if (result && !result.ok) {
      const statusCode = result.code === 'LEAGUE_LOCKED' ? 423 : 400;
      return new Response(
        JSON.stringify(result),
        { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for first practice after invite (award inviter)
    try {
      const { data: invites } = await supabaseAdmin
        .from('invites')
        .select('id, inviter_id, status')
        .eq('invitee_id', user.id)
        .eq('status', 'accepted')
        .limit(1);

      if (invites && invites.length > 0) {
        const invite = invites[0];
        
        // Check if this is first practice
        const { count } = await supabaseAdmin
          .from('practice_logs')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);

        if (count === 1) { // This was the first practice
          // Award points to inviter (50 XP for first practice)
          await supabaseAdmin
            .from('xp_events')
            .insert({
              user_id: invite.inviter_id,
              source: 'invite_first_practice',
              delta: 50,
              local_date: new Date().toISOString().split('T')[0]
            });

          await supabaseAdmin.rpc('increment', { x: 50 });
          await supabaseAdmin
            .from('xp_counters')
            .update({ total_xp: supabaseAdmin.rpc('increment', { x: 50 }) })
            .eq('user_id', invite.inviter_id);

          // Trigger invite reward notification
          const n8nUrl = Deno.env.get('N8N_BASE_URL');
          const n8nToken = Deno.env.get('N8N_WEBHOOK_TOKEN');

          if (n8nUrl && n8nToken) {
            const { data: inviterProfile } = await supabaseAdmin
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
                  title: '⭐ پاداش دعوت!',
                  body: 'دوستت تمرین کرد! ۵۰ امتیاز جدید برات ثبت شد.',
                  type: 'invite',
                  phase: 'first_practice',
                  data: {
                    type: 'invite',
                    event_type: 'first_practice',
                    invitee_id: user.id
                  }
                })
              });
            }
          }

          console.log('✅ First practice invite reward processed for inviter:', invite.inviter_id);
        }
      }
    } catch (inviteErr) {
      console.error('⚠️ Invite reward processing error (non-critical):', inviteErr);
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in log-practice:', error);
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
