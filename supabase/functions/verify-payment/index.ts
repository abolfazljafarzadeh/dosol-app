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
    console.log('🔍 verify-payment function called');
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('❌ No auth header provided');
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
      console.error('❌ Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'احراز هویت نامعتبر است' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { order_id, authority, state, status } = await req.json();
    console.log('🔍 Verifying payment:', { order_id, authority, status });

    if (!order_id || !authority) {
      return new Response(
        JSON.stringify({ error: 'اطلاعات ناقص است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If status is not OK from ZarinPal, mark as failed immediately
    if (status !== 'OK') {
      console.log('❌ Payment status not OK:', status);
      
      // Update order to failed
      await supabase
        .from('purchases')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', order_id)
        .eq('user_id', user.id);

      return new Response(
        JSON.stringify({ 
          ok: false,
          status: 'failed',
          message: 'پرداخت توسط کاربر لغو شد یا ناموفق بود'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch order from database
    const { data: order, error: orderError } = await supabase
      .from('purchases')
      .select('*')
      .eq('id', order_id)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
      console.error('❌ Order not found:', orderError);
      return new Response(
        JSON.stringify({ error: 'سفارش یافت نشد' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify authority matches (anti-tamper)
    if (order.authority !== authority) {
      console.error('❌ Authority mismatch:', { expected: order.authority, received: authority });
      return new Response(
        JSON.stringify({ error: 'اطلاعات تراکنش نامعتبر است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Verify state/nonce (CSRF/replay protection)
    if (!state || !order.state || order.state !== state) {
      console.error('❌ State mismatch - possible CSRF/replay:', { 
        has_order_state: !!order.state, 
        has_request_state: !!state,
        match: order.state === state 
      });
      return new Response(
        JSON.stringify({ error: 'درخواست نامعتبر است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Security checks passed (authority + state verified)');

    // Idempotency: if already completed, return success
    if (order.status === 'completed') {
      console.log('✅ Order already completed (idempotent)');
      return new Response(
        JSON.stringify({
          ok: true,
          status: 'completed',
          order: {
            id: order.id,
            amount: order.amount,
            ref_id: order.ref_id,
            transaction_id: order.transaction_id
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify with ZarinPal
    const merchantId = Deno.env.get('ZARINPAL_MERCHANT_ID')!;
    const zpMode = Deno.env.get('ZP_MODE') || 'sandbox';
    const verifyUrl = zpMode === 'production'
      ? 'https://api.zarinpal.com/pg/v4/payment/verify.json'
      : 'https://sandbox.zarinpal.com/pg/v4/payment/verify.json';

    console.log('📞 Verifying with ZarinPal...', { mode: zpMode, amount: order.amount, authority });

    const verifyResponse = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: merchantId,
        amount: order.amount, // SECURITY: Use amount from our database, not user input
        authority: authority
      }),
    });

    const verifyData = await verifyResponse.json();
    console.log('📥 ZarinPal verify response:', { 
      code: verifyData.data?.code,
      ref_id: verifyData.data?.ref_id,
      card_pan: verifyData.data?.card_pan 
    });

    // Check verification result
    // Code 100: success, Code 101: already verified
    if (verifyData.data?.code === 100 || verifyData.data?.code === 101) {
      console.log('✅ Payment verified successfully');

      const refId = verifyData.data.ref_id;
      const cardPan = verifyData.data.card_pan;

      // Update purchase to completed
      const { error: updateError } = await supabase
        .from('purchases')
        .update({
          status: 'completed',
          ref_id: refId?.toString(),
          transaction_id: cardPan,
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (updateError) {
        console.error('❌ Error updating purchase:', updateError);
        return new Response(
          JSON.stringify({ error: 'خطا در به‌روزرسانی وضعیت پرداخت' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Handle different purchase types
      if (order.course_id) {
        // For course purchases, create order in WooCommerce
        console.log('📚 Course purchase detected, creating WooCommerce order...');
        
        try {
          const createOrderResponse = await supabase.functions.invoke('create-woocommerce-order', {
            body: {
              purchaseId: order.id,
              userId: user.id,
              courseId: order.course_id,
            }
          });

          if (createOrderResponse.error) {
            console.error('❌ Error creating WooCommerce order:', createOrderResponse.error);
          } else {
            console.log('✅ WooCommerce order created successfully');
          }
        } catch (err) {
          console.error('❌ Failed to create WooCommerce order:', err);
        }
      } else {
        // For subscription purchases, upgrade user to premium
        await supabase
          .from('profiles')
          .update({ 
            is_premium: true,
            subscription_started_at: new Date().toISOString(),
            subscription_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
          })
          .eq('id', user.id);
        console.log('✅ User upgraded to premium');
      }

      // Broadcast payment confirmation via Realtime
      await supabase.channel(`order:${order.id}`)
        .send({
          type: 'broadcast',
          event: 'payment-confirmed',
          payload: { order_id: order.id, status: 'completed' }
        });

      console.log('✅ Payment verification complete');

      return new Response(
        JSON.stringify({
          ok: true,
          status: 'completed',
          order: {
            id: order.id,
            amount: order.amount,
            ref_id: refId?.toString(),
            transaction_id: cardPan
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Payment verification failed
      console.error('❌ Payment verification failed:', verifyData.errors);
      
      await supabase
        .from('purchases')
        .update({ 
          status: 'failed',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      return new Response(
        JSON.stringify({
          ok: false,
          status: 'failed',
          message: verifyData.errors?.message || 'تأیید پرداخت ناموفق بود',
          code: verifyData.errors?.code
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Verify payment error:', error);
    return new Response(
      JSON.stringify({ error: 'خطای سرور' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
