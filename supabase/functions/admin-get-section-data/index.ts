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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { section } = await req.json();

    if (!section) {
      throw new Error('Section parameter is required');
    }

    let result;
    let error;

    // Route to appropriate RPC based on section
    switch (section) {
      case 'users':
        ({ data: result, error } = await supabaseClient.rpc('rpc_admin_get_users_stats', {
          p_admin_id: user.id,
        }));
        break;

      case 'practice':
        ({ data: result, error } = await supabaseClient.rpc('rpc_admin_get_practice_stats', {
          p_admin_id: user.id,
        }));
        break;

      case 'gamification':
        ({ data: result, error } = await supabaseClient.rpc('rpc_admin_get_gamification_stats', {
          p_admin_id: user.id,
        }));
        break;

      case 'challenges':
        ({ data: result, error } = await supabaseClient.rpc('rpc_admin_get_challenges_stats', {
          p_admin_id: user.id,
        }));
        break;

      case 'leagues':
        ({ data: result, error } = await supabaseClient.rpc('rpc_admin_get_leagues_stats', {
          p_admin_id: user.id,
        }));
        break;

      case 'monetization':
        ({ data: result, error } = await supabaseClient.rpc('rpc_admin_get_monetization_stats', {
          p_admin_id: user.id,
        }));
        break;

      case 'courses':
        ({ data: result, error } = await supabaseClient.rpc('rpc_admin_get_courses_stats', {
          p_admin_id: user.id,
        }));
        break;

      case 'health':
        ({ data: result, error } = await supabaseClient.rpc('rpc_admin_get_app_health', {
          p_admin_id: user.id,
        }));
        break;

      default:
        throw new Error(`Unknown section: ${section}`);
    }

    if (error) {
      console.error('RPC error:', error);
      throw error;
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in admin-get-section-data:', error);
    return new Response(
      JSON.stringify({ ok: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});