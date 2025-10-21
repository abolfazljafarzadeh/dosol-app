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
    console.log('🔍 webhook-payment-confirm called');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { Authority, Status } = await req.json();
    console.log('📥 Webhook data:', { Authority, Status });

    if (!Authority) {
      return new Response(
        JSON.stringify({ error: 'Authority is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch order from database
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('*')
      .eq('authority', Authority)
      .single();

    if (purchaseError || !purchase) {
      console.error('❌ Purchase not found:', purchaseError);
      return new Response(
        JSON.stringify({ error: 'سفارش یافت نشد' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Purchase found:', purchase.id);

    // Check for idempotency - if already processed, return success
    if (purchase.status === 'completed' || purchase.status === 'failed') {
      console.log('⚠️ Purchase already processed:', purchase.status);
      return new Response(
        JSON.stringify({ ok: true, status: purchase.status, ref_id: purchase.ref_id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (Status === 'OK') {
      console.log('✅ Payment successful, verifying with ZarinPal...');
      
      const merchantId = Deno.env.get('ZARINPAL_MERCHANT_ID')!;
      
      // Verify payment with ZarinPal
      const verifyResponse = await fetch('https://sandbox.zarinpal.com/pg/v4/payment/verify.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          merchant_id: merchantId,
          authority: Authority,
          amount: purchase.amount,
        }),
      });

      const verifyData = await verifyResponse.json();
      console.log('📥 Verify response code:', verifyData.data?.code);

      if (verifyData.data?.code === 100 || verifyData.data?.code === 101) {
        // Payment verified successfully
        const refId = verifyData.data.ref_id;
        console.log('✅ Payment verified, ref_id:', refId);

        // Update purchase status to completed
        const { error: updateError } = await supabase
          .from('purchases')
          .update({
            status: 'completed',
            ref_id: refId,
            transaction_id: refId.toString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', purchase.id);

        if (updateError) {
          console.error('❌ Error updating purchase:', updateError);
          return new Response(
            JSON.stringify({ error: 'خطا در به‌روزرسانی سفارش' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Update user profile to premium
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ is_premium: true })
          .eq('id', purchase.user_id);

        if (profileError) {
          console.error('❌ Error updating profile:', profileError);
        } else {
          console.log('✅ User upgraded to premium');
        }

        // Send Realtime notification
        await supabase.channel(`order:${purchase.id}`)
          .send({
            type: 'broadcast',
            event: 'payment-confirmed',
            payload: {
              order_id: purchase.id,
              status: 'completed',
              ref_id: refId
            }
          });

        console.log('✅ Webhook processed successfully');

        return new Response(
          JSON.stringify({ ok: true, status: 'completed', ref_id: refId }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        console.error('❌ Verification failed:', verifyData);
        
        // Update purchase status to failed
        await supabase
          .from('purchases')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', purchase.id);

        return new Response(
          JSON.stringify({ ok: false, error: 'تأیید پرداخت ناموفق بود' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } else {
      console.log('❌ Payment cancelled by user');
      
      // Update purchase status to failed
      await supabase
        .from('purchases')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', purchase.id);

      return new Response(
        JSON.stringify({ ok: false, error: 'پرداخت لغو شد' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: 'خطای سرور' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
