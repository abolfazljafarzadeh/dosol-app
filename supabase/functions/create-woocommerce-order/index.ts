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
    console.log('🛒 Creating WooCommerce order...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { purchaseId, userId, courseId } = await req.json();

    if (!purchaseId || !userId || !courseId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, phone')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('❌ Profile not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'کاربر یافت نشد' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get purchase details
    const { data: purchase, error: purchaseError } = await supabase
      .from('purchases')
      .select('amount, course_id, ref_id')
      .eq('id', purchaseId)
      .single();

    if (purchaseError || !purchase) {
      console.error('❌ Purchase not found:', purchaseError);
      return new Response(
        JSON.stringify({ error: 'خرید یافت نشد' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📦 Creating order in WooCommerce for user:', profile.phone);

    const wooUrl = 'https://dosol.ir/wp-json/wc/v3/orders';
    const consumerKey = Deno.env.get('WOOCOMMERCE_CONSUMER_KEY')!;
    const consumerSecret = Deno.env.get('WOOCOMMERCE_CONSUMER_SECRET')!;

    // Create order in WooCommerce
    const orderData = {
      payment_method: 'zarinpal',
      payment_method_title: 'زرین‌پال',
      set_paid: true,
      status: 'completed',
      billing: {
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
      },
      line_items: [
        {
          product_id: courseId,
          quantity: 1,
        }
      ],
      meta_data: [
        {
          key: 'zarinpal_ref_id',
          value: purchase.ref_id || '',
        },
        {
          key: 'app_purchase_id',
          value: purchaseId,
        }
      ]
    };

    const response = await fetch(`${wooUrl}?consumer_key=${consumerKey}&consumer_secret=${consumerSecret}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ WooCommerce order creation failed:', response.status, errorData);
      throw new Error(`WooCommerce API error: ${response.status}`);
    }

    const wooOrder = await response.json();
    console.log('✅ WooCommerce order created:', wooOrder.id);

    // Update purchase with WooCommerce order ID
    await supabase
      .from('purchases')
      .update({ 
        transaction_id: wooOrder.id.toString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', purchaseId);

    return new Response(
      JSON.stringify({ ok: true, orderId: wooOrder.id }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error('Error creating WooCommerce order:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
