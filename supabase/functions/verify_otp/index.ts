import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { phone_number, otp_code, user_data } = await req.json()

    const { data: otp } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone_number', phone_number)
      .eq('otp_code', otp_code)
      .eq('is_used', false)
      .gte('expires_at', new Date().toISOString())
      .single()

    if (!otp) {
      return new Response(JSON.stringify({ error: 'کد تایید نامعتبر یا منقضی شده است' }), { status: 401 })
    }

    await supabase.from('otp_codes').update({ is_used: true }).eq('id', otp.id)

    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phone_number)
      .single()

    let user = existingUser

    if (!existingUser && user_data) {
      const { data: newUser } = await supabase
        .from('users')
        .insert({
          phone_number,
          first_name: user_data.first_name,
          last_name: user_data.last_name || '',
          instrument: user_data.instrument,
          skill_level: user_data.skill_level,
          last_login_at: new Date().toISOString()
        })
        .select()
        .single()

      user = newUser
    }

    return new Response(JSON.stringify({ success: true, user }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
})
