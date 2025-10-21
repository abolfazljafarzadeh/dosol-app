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
    // This function should be called by payment gateway webhook
    const { purchase_id, transaction_id, status } = await req.json();

    if (!purchase_id || !transaction_id) {
      return new Response(
        JSON.stringify({ error: 'شناسه سفارش و تراکنش الزامی است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update purchase status
    const { error: updateError } = await supabase
      .from('purchases')
      .update({
        status: status || 'completed',
        transaction_id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', purchase_id);

    if (updateError) {
      console.error('Purchase update error:', updateError);
      return new Response(
        JSON.stringify({ error: 'خطا در به‌روزرسانی سفارش' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Confirm checkout course error:', error);
    return new Response(
      JSON.stringify({ error: 'خطای سرور' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
