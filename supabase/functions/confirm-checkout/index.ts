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
    const url = new URL(req.url);
    const authority = url.searchParams.get('Authority');
    const status = url.searchParams.get('Status');

    console.log('Confirm checkout callback:', { authority, status });

    if (!authority) {
      return new Response(
        `<!DOCTYPE html>
        <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>خطا</title>
          <style>
            body { font-family: Tahoma; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error { color: #e74c3c; font-size: 24px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">❌ خطا</div>
            <p>اطلاعات پرداخت ناقص است</p>
          </div>
        </body>
        </html>`,
        { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    if (status !== 'OK') {
      return new Response(
        `<!DOCTYPE html>
        <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>لغو پرداخت</title>
          <style>
            body { font-family: Tahoma; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .warning { color: #f39c12; font-size: 24px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="warning">⚠️ لغو شده</div>
            <p>پرداخت توسط کاربر لغو شد</p>
          </div>
        </body>
        </html>`,
        { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get purchase record
    const { data: purchase, error: fetchError } = await supabase
      .from('purchases')
      .select('*')
      .eq('authority', authority)
      .single();

    if (fetchError || !purchase) {
      console.error('Purchase fetch error:', fetchError);
      return new Response(
        `<!DOCTYPE html>
        <html dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>خطا</title>
          <style>
            body { font-family: Tahoma; text-align: center; padding: 50px; background: #f5f5f5; }
            .container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .error { color: #e74c3c; font-size: 24px; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="error">❌ خطا</div>
            <p>تراکنش یافت نشد</p>
          </div>
        </body>
        </html>`,
        { status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
      );
    }

    const merchantId = Deno.env.get('ZARINPAL_MERCHANT_ID')!;

    // Verify payment with ZarinPal (Sandbox)
    const verifyResponse = await fetch('https://sandbox.zarinpal.com/pg/v4/payment/verify.json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        merchant_id: merchantId,
        authority: authority,
        amount: purchase.amount,
      }),
    });

    const verifyData = await verifyResponse.json();
    console.log('ZarinPal verify response:', verifyData);

    if (verifyData.data?.code === 100) {
      // Payment successful
      const refId = verifyData.data.ref_id;

      // Update purchase status
      const { error: updateError } = await supabase
        .from('purchases')
        .update({
          status: 'completed',
          ref_id: refId,
        })
        .eq('authority', authority);

      if (updateError) {
        console.error('Purchase update error:', updateError);
      }

      // Update user's premium status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          is_premium: true,
        })
        .eq('id', purchase.user_id);

      if (profileError) {
        console.error('Profile update error:', profileError);
      }

      // Get the origin from query params or use default
      const origin = url.searchParams.get('origin') || 'https://app.dosol.ir';
      const successUrl = `${origin}/#payment-success`;
      
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': successUrl,
        },
      });
    } else {
      // Payment failed
      const { error: updateError } = await supabase
        .from('purchases')
        .update({
          status: 'failed',
        })
        .eq('authority', authority);

      if (updateError) {
        console.error('Purchase update error:', updateError);
      }

      // Get the origin from query params or use default
      const origin = url.searchParams.get('origin') || 'https://app.dosol.ir';
      const failedUrl = `${origin}/#payment-failed`;
      
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          'Location': failedUrl,
        },
      });
    }

  } catch (error) {
    console.error('Confirm checkout error:', error);
    return new Response(
      `<!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>خطا</title>
        <style>
          body { font-family: Tahoma; text-align: center; padding: 50px; background: #f5f5f5; }
          .container { background: white; padding: 40px; border-radius: 10px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .error { color: #e74c3c; font-size: 24px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="error">❌ خطا</div>
          <p>خطای سرور رخ داد</p>
        </div>
      </body>
      </html>`,
      { status: 500, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
});
