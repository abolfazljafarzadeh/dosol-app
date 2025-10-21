import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, code } = await req.json();

    if (!phone || !code) {
      return new Response(
        JSON.stringify({ verified: false, error: 'phone_and_code_required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('🔍 Verifying OTP for phone:', phone);

    // Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the latest OTP record for this phone
    const { data: otpRecord, error: fetchError } = await supabaseAdmin
      .from('otp_codes')
      .select('*')
      .eq('phone', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError || !otpRecord) {
      console.error('❌ OTP record not found:', fetchError);
      return new Response(
        JSON.stringify({ verified: false, error: 'invalid_or_expired_code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if already verified
    if (otpRecord.verified) {
      console.error('❌ OTP already verified');
      return new Response(
        JSON.stringify({ verified: false, error: 'code_already_used' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if code matches
    if (otpRecord.code !== code) {
      console.error('❌ Invalid OTP code');
      return new Response(
        JSON.stringify({ verified: false, error: 'invalid_code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if expired
    const expirationStr = Deno.env.get('OTP_EXPIRATION_MINUTES') || '2';
    const expirationMinutes = parseInt(expirationStr, 10);
    const validExpiration = (isNaN(expirationMinutes) || expirationMinutes < 1) ? 2 : expirationMinutes;
    
    const createdAt = new Date(otpRecord.created_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - createdAt.getTime()) / (1000 * 60);

    if (diffMinutes > validExpiration) {
      console.error('❌ OTP expired');
      return new Response(
        JSON.stringify({ verified: false, error: 'expired_code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark OTP as verified
    await supabaseAdmin
      .from('otp_codes')
      .update({ verified: true })
      .eq('id', otpRecord.id);

    console.log('✅ OTP verified successfully');

    // Convert phone to E.164 format
    let e164Phone = phone;
    if (phone.startsWith('09')) {
      e164Phone = '+98' + phone.substring(1);
    }

    // Check if user exists
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .maybeSingle();

    let userId: string;

    if (profile) {
      console.log('👤 User exists in profiles:', profile.id);
      userId = profile.id;
    } else {
      console.log('👤 Creating new user...');
      
      const tempEmail = `user_${Date.now()}@doosell.local`;
      const tempPassword = crypto.randomUUID();
      
      const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone: e164Phone,
        email: tempEmail,
        password: tempPassword,
        phone_confirm: true,
        email_confirm: true,
        user_metadata: { phone },
      });

      if (createError) {
        console.error('❌ Failed to create user:', createError);
        
        if (createError.status === 422) {
          const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
          const existingUser = users?.find(u => u.phone === e164Phone);
          
          if (!existingUser) {
            throw new Error('User exists but could not be found');
          }
          userId = existingUser.id;
        } else {
          throw new Error('Failed to create user');
        }
      } else if (newUserData.user) {
        userId = newUserData.user.id;
      } else {
        throw new Error('Failed to create user');
      }
    }

    console.log('🔐 Creating session for user:', userId);
    
    // Create session using signInAnonymously then update to real user
    // This is a workaround to get valid tokens
    const tempClient = createClient(supabaseUrl, supabaseAnonKey);
    
    // First update user to have email + password if needed
    const tempPassword = crypto.randomUUID();
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(userId);
    
    let userEmail = authUser?.user?.email;
    if (!userEmail || userEmail.includes('@doosell.local')) {
      userEmail = `user_${userId.substring(0, 8)}_${Date.now()}@doosell.local`;
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: userEmail,
        email_confirm: true,
        password: tempPassword,
      });
    } else {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: tempPassword,
      });
    }
    
    console.log('🔑 Signing in user...');
    
    // Sign in with the temporary password
    const { data: sessionData, error: signInError } = await tempClient.auth.signInWithPassword({
      email: userEmail,
      password: tempPassword,
    });

    if (signInError || !sessionData?.session) {
      console.error('❌ Failed to sign in:', signInError);
      throw new Error('Failed to create session');
    }

    console.log('✅ Session created successfully');

    return new Response(
      JSON.stringify({
        verified: true,
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        user_id: userId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in verify-otp:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ verified: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
