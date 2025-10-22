import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { phone_number } = await req.json()

    const phoneRegex = /^09\d{9}$/
    if (!phoneRegex.test(phone_number)) {
      return new Response(
        JSON.stringify({ error: 'شماره موبایل نامعتبر است' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const otp_code = Math.floor(100000 + Math.random() * 900000).toString()

    const expires_at = new Date()
    expires_at.setMinutes(expires_at.getMinutes() + 5)

    await supabase
      .from('otp_codes')
      .update({ is_used: true })
      .eq('phone_number', phone_number)
      .eq('is_used', false)

    const { error: insertError } = await supabase
      .from('otp_codes')
      .insert({
        phone_number,
        otp_code,
        expires_at: expires_at.toISOString()
      })

    if (insertError) {
      throw insertError
    }

    const smsApiKey = Deno.env.get('SMS_API_KEY')
    const smsApiUrl = `https://api.kavenegar.com/v1/${smsApiKey}/verify/lookup.json`

    const smsResponse = await fetch(smsApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        receptor: phone_number,
        token: otp_code,
        template: 'dosol-verify'
      })
    })

    if (!smsResponse.ok) {
      throw new Error('Failed to send SMS')
    }

    return new Response(
      JSON.stringify({ success: true, message: 'کد تایید ارسال شد' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
