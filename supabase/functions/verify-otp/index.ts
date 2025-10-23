import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone_number, otp_code } = await req.json()
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Check OTP validity
    const { data: otpData, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone_number', phone_number)
      .eq('otp_code', otp_code)
      .eq('is_used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (otpError || !otpData) {
      throw new Error('کد تایید نامعتبر یا منقضی شده است')
    }
    
    // Mark OTP as used
    await supabase
      .from('otp_codes')
      .update({ is_used: true })
      .eq('id', otpData.id)
    
    // Check if user exists
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phone_number)
      .single()
    
    let user = userData
    let isNewUser = false
    
    if (!userData) {
      // Create new user with basic info
      isNewUser = true
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert({
          phone_number,
          first_name: 'کاربر',
          last_name: 'جدید',
          instrument: 'piano',
          skill_level: 'beginner'
        })
        .select()
        .single()
      
      if (userError) {
        console.error('User creation error:', userError)
        throw new Error('خطا در ایجاد کاربر')
      }
      
      user = newUser
    }
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        user,
        isNewUser,
        message: isNewUser ? 'ثبت نام موفق' : 'ورود موفق'
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