import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Rate limit tracking (in-memory for simplicity, use Redis/DB for production)
const rateLimitMap = new Map<string, { attempts: number; lastAttempt: number }>();
const RATE_LIMIT_WINDOW = 300000; // 5 minutes
const MAX_ATTEMPTS = 3;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔍 create-order function called');
    
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

    console.log('🔐 Verifying user...');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('❌ Auth error');
      return new Response(
        JSON.stringify({ error: 'احراز هویت نامعتبر است' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ User verified');

    const { amount, course_id, idempotency_key } = await req.json();
    console.log('💰 Order details:', { amount, course_id, has_idempotency_key: !!idempotency_key });

    if (!amount || amount <= 0) {
      console.error('❌ Invalid amount');
      return new Response(
        JSON.stringify({ error: 'مبلغ نامعتبر است' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for idempotency - if same request exists and is recent, return cached result
    if (idempotency_key) {
      const { data: existingRequest } = await supabase
        .from('processed_requests')
        .select('response')
        .eq('user_id', user.id)
        .eq('idempotency_key', idempotency_key)
        .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // 1 hour
        .single();

      if (existingRequest?.response) {
        console.log('✅ Returning cached response for idempotency key');
        return new Response(
          JSON.stringify(existingRequest.response),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check for existing pending order in last 10 minutes
    const { data: recentPending } = await supabase
      .from('purchases')
      .select('id, authority, amount, state, created_at')
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .eq('amount', amount)
      .gte('created_at', new Date(Date.now() - 600000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentPending && recentPending.authority) {
      console.log('✅ Found recent pending order, reusing');
      const zpMode = Deno.env.get('ZP_MODE') || 'sandbox';
      const paymentBaseUrl = zpMode === 'production' 
        ? 'https://www.zarinpal.com/pg/StartPay/' 
        : 'https://sandbox.zarinpal.com/pg/StartPay/';
      
      const response = {
        ok: true,
        order_id: recentPending.id,
        authority: recentPending.authority,
        payment_url: `${paymentBaseUrl}${recentPending.authority}`,
        state: recentPending.state || crypto.randomUUID()
      };

      return new Response(
        JSON.stringify(response),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting check
    const now = Date.now();
    const userRateLimit = rateLimitMap.get(user.id) || { attempts: 0, lastAttempt: 0 };
    
    if (now - userRateLimit.lastAttempt < RATE_LIMIT_WINDOW) {
      if (userRateLimit.attempts >= MAX_ATTEMPTS) {
        const waitTime = Math.ceil((RATE_LIMIT_WINDOW - (now - userRateLimit.lastAttempt)) / 1000);
        console.log(`⏱️ Rate limit exceeded for user, wait ${waitTime}s`);
        return new Response(
          JSON.stringify({ 
            error: 'تعداد تلاش‌های شما از حد مجاز گذشته است',
            retry_after_sec: waitTime,
            code: -12
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userRateLimit.attempts++;
    } else {
      userRateLimit.attempts = 1;
    }
    userRateLimit.lastAttempt = now;
    rateLimitMap.set(user.id, userRateLimit);

    // Generate state/nonce for CSRF protection
    const state = crypto.randomUUID();
    console.log('🔑 Generated state for CSRF');

    const merchantId = Deno.env.get('ZARINPAL_MERCHANT_ID')!;
    const zpMode = Deno.env.get('ZP_MODE') || 'sandbox';
    const appDomain = Deno.env.get('APP_DOMAIN');

    // SECURITY: APP_DOMAIN must be set to prevent open redirect attacks
    if (!appDomain) {
      console.error('❌ APP_DOMAIN not configured');
      return new Response(
        JSON.stringify({ error: 'پیکربندی سرور ناقص است' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📞 Calling ZarinPal API...', { mode: zpMode, domain: appDomain });

    // Build callback URL with state and order_id - will be sent to ZarinPal in PaymentRequest
    const callbackUrl = `${appDomain}/payment/callback?order_id=${crypto.randomUUID()}&state=${state}`;
    console.log('🔗 Callback URL:', callbackUrl);

    const zpBaseUrl = zpMode === 'production'
      ? 'https://api.zarinpal.com/pg/v4/payment/request.json'
      : 'https://sandbox.zarinpal.com/pg/v4/payment/request.json';

    // Retry logic with exponential backoff
    let zarinpalData;
    let lastError;
    const maxRetries = 2;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Retry attempt ${attempt} after ${backoffMs}ms`);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }

      try {
        const zarinpalResponse = await fetch(zpBaseUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchant_id: merchantId,
            amount: amount,
            description: course_id ? 'خرید دوره آموزشی' : 'خرید اشتراک اپلیکیشن دوسل',
            callback_url: callbackUrl, // IMPORTANT: CallbackURL sent in PaymentRequest, NOT in redirect URL
            metadata: { order_state: state }
          }),
        });

        zarinpalData = await zarinpalResponse.json();
        console.log('📥 ZarinPal response:', { code: zarinpalData.data?.code, errors: zarinpalData.errors?.code });

        // Success
        if (zarinpalData.data?.code === 100) {
          break;
        }

        // Rate limit from ZarinPal
        if (zarinpalData.errors?.code === -12) {
          console.log('⏱️ ZarinPal rate limit hit');
          return new Response(
            JSON.stringify({ 
              error: 'درگاه پرداخت مشغول است. لطفاً چند دقیقه دیگر تلاش کنید',
              retry_after_sec: 300,
              code: -12
            }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        lastError = zarinpalData;
      } catch (err) {
        console.error(`❌ Attempt ${attempt} failed:`, err);
        lastError = err;
        if (attempt === maxRetries) throw err;
      }
    }

    if (!zarinpalData?.data?.code || zarinpalData.data.code !== 100) {
      console.error('❌ ZarinPal final error:', lastError);
      return new Response(
        JSON.stringify({ 
          error: 'خطا در برقراری ارتباط با درگاه پرداخت',
          details: zarinpalData?.errors?.message || 'نامشخص'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authority = zarinpalData.data.authority;
    const paymentBaseUrl = zpMode === 'production'
      ? 'https://www.zarinpal.com/pg/StartPay/'
      : 'https://sandbox.zarinpal.com/pg/StartPay/';
    
    console.log('✅ ZarinPal success');

    console.log('💾 Inserting order record...');
    
    // Insert order with state for verification
    const { data: order, error: insertError } = await supabase
      .from('purchases')
      .insert({
        user_id: user.id,
        authority,
        amount,
        status: 'pending',
        course_id: course_id || null,
        state, // Store state/nonce for CSRF protection
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Order insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'خطا در ثبت سفارش' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Order created successfully:', { order_id: order.id, authority });

    // Update callback URL with actual order_id
    const finalCallbackUrl = `${appDomain}/payment/callback?order_id=${order.id}&state=${state}`;
    
    // Build final payment URL - ONLY StartPay/Authority (CallbackURL already sent in PaymentRequest)
    const payment_url = `${paymentBaseUrl}${authority}`;
    
    console.log('🔗 Final payment URL:', payment_url);
    console.log('🔗 Expected callback URL:', finalCallbackUrl);

    const response = {
      ok: true,
      order_id: order.id,
      authority,
      payment_url, // Clean StartPay URL without any params
      state
    };

    // Store idempotency result
    if (idempotency_key) {
      await supabase
        .from('processed_requests')
        .insert({
          user_id: user.id,
          idempotency_key,
          response
        });
    }

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Create order error:', error instanceof Error ? error.message : 'Unknown error');
    return new Response(
      JSON.stringify({ error: 'خطای سرور' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
