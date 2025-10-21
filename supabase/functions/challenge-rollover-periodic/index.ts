import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Security: Validate cron secret
    const secret = Deno.env.get('CRON_SECRET');
    const auth = req.headers.get('X-CRON-SECRET');
    
    if (!secret || auth !== secret) {
      console.error('Unauthorized access attempt to challenge-rollover-periodic');
      return new Response(
        JSON.stringify({ ok: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[challenge-rollover-periodic] Starting rollover at', new Date().toISOString());

    // Admin function - uses service role key
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: result, error: rpcError } = await supabaseClient.rpc('rpc_challenge_rollover_periodic');

    if (rpcError) {
      console.error('[challenge-rollover-periodic] RPC error:', rpcError);
      throw rpcError;
    }

    console.log('[challenge-rollover-periodic] Success:', result);

    return new Response(
      JSON.stringify({
        ...result,
        executedAt: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in challenge-rollover-periodic:', error);
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
