import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { v4 as uuidv4 } from "https://esm.sh/uuid@9.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🛒 start-checkout-course called');

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
      console.error('❌ Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'توکن نامعتبر' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { course_id, amount } = await req.json();

    if (!course_id || !amount) {
      return new Response(
        JSON.stringify({ error: 'اطلاعات ناقص است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📦 Creating purchase for course:', course_id, 'amount:', amount);

    // Generate state/nonce for CSRF protection
    const state = uuidv4();

    // Create purchase record
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .insert({
        user_id: user.id,
        course_id: course_id,
        amount: amount,
        status: 'pending',
        state: state,
      })
      .select()
      .single();

    if (purchaseError) {
      console.error('❌ Purchase creation error:', purchaseError);
      return new Response(
        JSON.stringify({ error: 'خطا در ایجاد سفارش' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Purchase created:', purchase.id);

    // Initiate payment with ZarinPal
    const merchantId = Deno.env.get('ZARINPAL_MERCHANT_ID')!;
    const zpMode = Deno.env.get('ZP_MODE') || 'sandbox';
    const requestUrl = zpMode === 'production'
      ? 'https://api.zarinpal.com/pg/v4/payment/request.json'
      : 'https://sandbox.zarinpal.com/pg/v4/payment/request.json';

    const callbackUrl = `${supabaseUrl.replace('.supabase.co', '.lovableproject.com')}/payment-callback?order_id=${purchase.id}&state=${state}`;

    // Convert Toman to Rial (multiply by 10)
    const amountInRials = amount * 10;

    console.log('📞 Requesting ZarinPal payment...', { mode: zpMode, amountToman: amount, amountRial: amountInRials });

    const zpResponse = await fetch(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: merchantId,
        amount: amountInRials,
        description: `خرید دوره آموزشی - سفارش ${purchase.id}`,
        callback_url: callbackUrl,
      }),
    });

    const zpData = await zpResponse.json();
    console.log('📥 ZarinPal response:', { code: zpData.data?.code, authority: zpData.data?.authority });

    if (zpData.data?.code !== 100) {
      console.error('❌ ZarinPal request failed:', zpData.errors);
      throw new Error(zpData.errors?.message || 'خطا در ایجاد درخواست پرداخت');
    }

    const authority = zpData.data.authority;

    // Update purchase with authority
    await supabase
      .from('purchases')
      .update({ authority })
      .eq('id', purchase.id);

    // Generate payment URL
    const paymentUrl = zpMode === 'production'
      ? `https://www.zarinpal.com/pg/StartPay/${authority}`
      : `https://sandbox.zarinpal.com/pg/StartPay/${authority}`;

    console.log('✅ Payment URL generated');

    return new Response(
      JSON.stringify({ 
        ok: true,
        purchase_id: purchase.id,
        authority: authority,
        payment_url: paymentUrl,
        amount: amount,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Start checkout course error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'خطای سرور' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
