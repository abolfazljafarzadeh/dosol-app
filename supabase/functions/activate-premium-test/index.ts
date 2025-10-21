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
    console.log('🧪 TEST MODE: activate-premium-test function called');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'احراز هویت الزامی است' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'احراز هویت نامعتبر است' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { plan_id, validity_days } = await req.json();
    console.log('🎯 Activating premium for user:', user.id, 'plan:', plan_id);

    // Calculate subscription dates
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + (validity_days || 30)); // Default 30 days if not provided

    console.log('📅 Subscription dates:', {
      started: now.toISOString(),
      expires: expiresAt.toISOString(),
      days: validity_days || 30
    });

    // Update user to premium with subscription dates
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        is_premium: true,
        subscription_started_at: now.toISOString(),
        subscription_expires_at: expiresAt.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ Error updating profile:', updateError);
      return new Response(
        JSON.stringify({ error: 'خطا در فعال‌سازی اشتراک' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a test purchase record
    await supabase
      .from('purchases')
      .insert({
        user_id: user.id,
        amount: 0, // Test mode - no payment
        status: 'completed',
        authority: 'TEST_' + crypto.randomUUID(),
        ref_id: 'TEST_MODE',
      });

    console.log('✅ Premium activated successfully (TEST MODE)');

    return new Response(
      JSON.stringify({
        ok: true,
        status: 'completed',
        message: 'اشتراک با موفقیت فعال شد (حالت تست)',
        is_premium: true,
        subscription_started_at: now.toISOString(),
        subscription_expires_at: expiresAt.toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Activate premium test error:', error);
    return new Response(
      JSON.stringify({ error: 'خطای سرور' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
