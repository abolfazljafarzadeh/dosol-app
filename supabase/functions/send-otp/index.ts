import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone_number } = await req.json()
    
    // Validate phone
    if (!phone_number || !phone_number.match(/^09\d{9}$/)) {
      throw new Error('شماره موبایل باید با 09 شروع شود و 11 رقم باشد')
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Set expiry time (5 minutes from now)
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + 5)
    
    // Save OTP to database
    const { error: dbError } = await supabase
      .from('otp_codes')
      .insert({
        phone_number,
        otp_code: otp,
        expires_at: expiresAt.toISOString()
      })
    
    if (dbError) {
      console.error('Database error:', dbError)
      throw new Error('خطا در ذخیره کد تایید')
    }

    // Send SMS via Kavenegar
    const apiKey = '61747665446E767646647868525A4D3764754F516972336F704A635A63752B56716E43426856616E504B513D'
    const message = `کد تایید دوسل: ${otp}`
    
    const smsUrl = `https://api.kavenegar.com/v1/${apiKey}/sms/send.json`
    
    const formData = new URLSearchParams()
    formData.append('receptor', phone_number)
    formData.append('message', message)
    
    const smsResponse = await fetch(smsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString()
    })

    const smsResult = await smsResponse.json()
    
    if (smsResult.return?.status !== 200) {
      console.error('SMS error:', smsResult)
      throw new Error('خطا در ارسال پیامک')
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'کد تایید ارسال شد'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
    
  } catch (error: any) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})