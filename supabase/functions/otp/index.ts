import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { phone_number } = await req.json()
    const regex = /^09\d{9}$/
    if (!regex.test(phone_number)) return new Response(JSON.stringify({ error: 'شماره نامعتبر است' }), { status: 400 })

    const otp = Math.floor(100000 + Math.random() * 900000).toString()
    const expires = new Date()
    expires.setMinutes(expires.getMinutes() + 5)

    await supabase.from('otp_codes').update({ is_used: true }).eq('phone_number', phone_number).eq('is_used', false)
    await supabase.from('otp_codes').insert({ phone_number, otp_code: otp, expires_at: expires.toISOString() })

    const smsApiKey = Deno.env.get('SMS_API_KEY')
    const smsUrl = `https://api.kavenegar.com/v1/${smsApiKey}/verify/lookup.json`

    await fetch(smsUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ receptor: phone_number, token: otp, template: 'dosol-verify' })
    })

    return new Response(JSON.stringify({ success: true, message: 'کد تایید ارسال شد' }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
})
