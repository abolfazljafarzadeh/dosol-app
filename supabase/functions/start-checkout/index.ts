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
    console.log('🔍 Start-checkout function called');
    
    const authHeader = req.headers.get('Authorization');
    console.log('📋 Auth header present:', !!authHeader);
    
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

    console.log('🔐 Verifying user...');
    
    // Verify user with their JWT token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('❌ Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'احراز هویت نامعتبر است' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User verified:', user.id);

    const { amount } = await req.json();
    console.log('💰 Amount received:', amount);

    if (!amount || amount <= 0) {
      console.error('❌ Invalid amount:', amount);
      return new Response(
        JSON.stringify({ error: 'مبلغ نامعتبر است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🚀 Starting checkout for user:', user.id, 'amount:', amount);

    const merchantId = Deno.env.get('ZARINPAL_MERCHANT_ID')!;
    
    // Capture the origin from the request to redirect back after payment
    const origin = req.headers.get('origin') || req.headers.get('referer')?.split('?')[0] || 'https://app.dosol.ir';
    const frontendOrigin = origin.includes('supabase.co') ? 'https://app.dosol.ir' : origin;
    
    // Direct callback to Edge Function (works for both sandbox and production)
    const callbackUrl = `${supabaseUrl}/functions/v1/confirm-checkout?origin=${encodeURIComponent(frontendOrigin)}`;

    console.log('📞 Calling ZarinPal API (Sandbox)...');
    console.log('🔑 Merchant ID present:', !!merchantId);
    console.log('🔙 Callback URL:', callbackUrl);

    // Convert Toman to Rial (multiply by 10)
    const amountInRials = amount * 10;

    // Request payment from ZarinPal (Sandbox)
    const zarinpalResponse = await fetch('https://sandbox.zarinpal.com/pg/v4/payment/request.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchant_id: merchantId,
        amount: amountInRials,
        description: 'خرید اشتراک اپلیکیشن دوسل',
        callback_url: callbackUrl,
      }),
    });

    const zarinpalData = await zarinpalResponse.json();
    console.log('📥 ZarinPal response:', zarinpalData);

    if (zarinpalData.data?.code !== 100) {
      console.error('❌ ZarinPal error - Code:', zarinpalData.data?.code);
      console.error('❌ ZarinPal full error:', zarinpalData);
      return new Response(
        JSON.stringify({ error: 'خطا در برقراری ارتباط با درگاه پرداخت' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authority = zarinpalData.data.authority;
    const paymentUrl = `https://sandbox.zarinpal.com/pg/StartPay/${authority}`;
    
    console.log('✅ ZarinPal success - Authority:', authority);
    console.log('🔗 Payment URL:', paymentUrl);

    console.log('💾 Inserting purchase record...');
    
    // Insert purchase record
    const { error: insertError } = await supabase
      .from('purchases')
      .insert({
        user_id: user.id,
        authority,
        amount,
        status: 'pending',
      });

    if (insertError) {
      console.error('❌ Purchase insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'خطا در ثبت تراکنش' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Purchase record inserted successfully');
    console.log('✅ Returning payment URL to client');

    return new Response(
      JSON.stringify({
        ok: true,
        authority,
        payment_url: paymentUrl,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Start checkout error:', error);
    return new Response(
      JSON.stringify({ error: 'خطای سرور' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
