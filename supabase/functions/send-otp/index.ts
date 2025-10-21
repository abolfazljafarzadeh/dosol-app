import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate OTP code
function generateOTP(): string {
  const lengthStr = Deno.env.get('OTP_LENGTH') || '6';
  const length = parseInt(lengthStr, 10);
  
  if (isNaN(length) || length < 4 || length > 8) {
    console.warn('Invalid OTP_LENGTH, using default: 6');
    const defaultLength = 6;
    const min = Math.pow(10, defaultLength - 1);
    const max = Math.pow(10, defaultLength) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
  }
  
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'phone_required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone to 09xxxxxxxxx format
    let normalizedPhone = phone.trim();
    if (normalizedPhone.startsWith('+98')) {
      normalizedPhone = '0' + normalizedPhone.substring(3);
    } else if (normalizedPhone.startsWith('98')) {
      normalizedPhone = '0' + normalizedPhone.substring(2);
    } else if (!normalizedPhone.startsWith('0')) {
      normalizedPhone = '0' + normalizedPhone;
    }

    console.log('📱 Sending OTP to phone:', normalizedPhone);

    // Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Generate OTP code
    const otpCode = generateOTP();
    
    // Store OTP in database
    const { error: insertError } = await supabaseAdmin
      .from('otp_codes')
      .insert({
        phone: normalizedPhone,
        code: otpCode,
        verified: false,
      });

    if (insertError) {
      console.error('❌ Failed to store OTP:', insertError);
      throw new Error('Failed to store OTP');
    }

    console.log('✅ OTP generated and stored in database');

    // Call n8n webhook to send SMS with token in query string
    const webhookUrl = "https://abjafarzadeh6.app.n8n.cloud/webhook/send-sms?token=43WC5P4!r@zG.pA";
    const n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body: {
          to: normalizedPhone,
          params: { token: otpCode }
        }
      }),
    });

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text();
      console.error('❌ n8n send-sms failed:', errorText);
      return new Response(
        JSON.stringify({ error: 'failed_to_send_sms' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ SMS sent via n8n');

    return new Response(
      JSON.stringify({ status: 'otp_sent' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in send-otp:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
