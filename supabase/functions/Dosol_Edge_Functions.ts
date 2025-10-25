// Dosol App - Supabase Edge Functions
// Project ID: asavfxpvleaboucvnawb

// ========================================
// 1. save_training_plan - ذخیره برنامه تمرین کاربر
// ========================================
// Path: supabase/functions/save_training_plan/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // Get Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { days, times, timezone } = await req.json()

    // Validate input
    if (!days || !Array.isArray(days) || days.length === 0) {
      return new Response(
        JSON.stringify({ error: 'روزهای تمرین الزامی است' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Start transaction
    const { error: deleteError } = await supabase
      .from('training_schedule')
      .delete()
      .eq('user_id', user.id)

    if (deleteError) {
      throw deleteError
    }

    // Insert new training schedule
    const scheduleData = []
    
    for (const day of days) {
      if (times && times[day]) {
        for (const time of times[day]) {
          scheduleData.push({
            user_id: user.id,
            weekday: day,
            reminder_time: time,
            is_active: true
          })
        }
      } else {
        // If no time specified, default to 19:00
        scheduleData.push({
          user_id: user.id,
          weekday: day,
          reminder_time: '19:00',
          is_active: true
        })
      }
    }

    const { data: insertedData, error: insertError } = await supabase
      .from('training_schedule')
      .insert(scheduleData)
      .select()

    if (insertError) {
      throw insertError
    }

    // Update user timezone if provided
    if (timezone) {
      const { error: updateError } = await supabase
        .from('users')
        .update({ timezone, updated_at: new Date().toISOString() })
        .eq('id', user.id)

      if (updateError) {
        throw updateError
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: insertedData,
        message: 'برنامه تمرین با موفقیت ذخیره شد' 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// ========================================
// 2. schedule_push_reminders - زمانبندی یادآوری‌ها
// ========================================
// Path: supabase/functions/schedule_push_reminders/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get all active training schedules
    const { data: schedules, error: fetchError } = await supabase
      .from('training_schedule')
      .select(`
        *,
        users!inner(
          id,
          first_name,
          timezone
        )
      `)
      .eq('is_active', true)

    if (fetchError) {
      throw fetchError
    }

    const notifications = []
    const today = new Date()
    const currentWeekday = today.getDay()

    for (const schedule of schedules) {
      // Check if today matches the schedule weekday
      if (schedule.weekday === currentWeekday) {
        const [hours, minutes] = schedule.reminder_time.split(':')
        const scheduledTime = new Date(today)
        scheduledTime.setHours(parseInt(hours), parseInt(minutes), 0, 0)

        // Only schedule if time hasn't passed
        if (scheduledTime > today) {
          notifications.push({
            user_id: schedule.user_id,
            type: 'reminder',
            title: 'وقت تمرین رسیده! 🎵',
            body: `سلام ${schedule.users.first_name} عزیز، الان بهترین زمان برای تمرین ${schedule.reminder_time === '19:00' ? 'شبانه' : ''} است`,
            scheduled_for: scheduledTime.toISOString()
          })
        }
      }
    }

    // Insert notifications
    if (notifications.length > 0) {
      const { error: insertError } = await supabase
        .from('push_notifications')
        .insert(notifications)

      if (insertError) {
        throw insertError
      }

      // Trigger webhook to n8n for actual push notification sending
      const webhookUrl = Deno.env.get('N8N_WEBHOOK_URL')
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'send_notifications',
            notifications: notifications
          })
        })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        scheduled_count: notifications.length 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// ========================================
// 3. create_weekly_leagues - ایجاد لیگ‌های هفتگی
// ========================================
// Path: supabase/functions/create_weekly_leagues/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Calculate week dates (Saturday to Friday)
    const today = new Date()
    const currentDay = today.getDay()
    const daysToSaturday = (6 - currentDay + 7) % 7
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - daysToSaturday)
    weekStart.setHours(0, 0, 0, 0)
    
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    // Close previous leagues
    const { error: closeError } = await supabase
      .from('leagues')
      .update({ is_active: false })
      .lt('week_end_date', weekStart.toISOString())

    if (closeError) {
      throw closeError
    }

    // Get users who practiced this week
    const { data: activeUsers, error: usersError } = await supabase
      .from('practice_logs')
      .select('user_id')
      .gte('practice_date', weekStart.toISOString())
      .lte('practice_date', weekEnd.toISOString())

    if (usersError) {
      throw usersError
    }

    // Get unique user IDs
    const uniqueUserIds = [...new Set(activeUsers.map(log => log.user_id))]

    // Create leagues (10-15 users per league)
    const leaguesNeeded = Math.ceil(uniqueUserIds.length / 12)
    const leagues = []

    for (let i = 0; i < leaguesNeeded; i++) {
      leagues.push({
        week_start_date: weekStart.toISOString(),
        week_end_date: weekEnd.toISOString(),
        league_number: i + 1,
        is_active: true
      })
    }

    const { data: createdLeagues, error: createError } = await supabase
      .from('leagues')
      .insert(leagues)
      .select()

    if (createError) {
      throw createError
    }

    // Randomly assign users to leagues
    const shuffled = uniqueUserIds.sort(() => Math.random() - 0.5)
    const participants = []
    
    shuffled.forEach((userId, index) => {
      const leagueIndex = Math.floor(index / 12)
      if (leagueIndex < createdLeagues.length) {
        participants.push({
          league_id: createdLeagues[leagueIndex].id,
          user_id: userId,
          weekly_xp: 0
        })
      }
    })

    const { error: participantsError } = await supabase
      .from('league_participants')
      .insert(participants)

    if (participantsError) {
      throw participantsError
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        leagues_created: createdLeagues.length,
        participants_assigned: participants.length 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// ========================================
// 4. calculate_league_results - محاسبه نتایج لیگ
// ========================================
// Path: supabase/functions/calculate_league_results/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get active leagues that ended
    const today = new Date()
    const { data: endedLeagues, error: leaguesError } = await supabase
      .from('leagues')
      .select('*')
      .eq('is_active', true)
      .lt('week_end_date', today.toISOString())

    if (leaguesError) {
      throw leaguesError
    }

    for (const league of endedLeagues) {
      // Get participants ordered by XP
      const { data: participants, error: participantsError } = await supabase
        .from('league_participants')
        .select('*')
        .eq('league_id', league.id)
        .order('weekly_xp', { ascending: false })

      if (participantsError) {
        throw participantsError
      }

      // Update ranks and medals
      const updates = participants.map((participant, index) => {
        const rank = index + 1
        let medal_type = null
        
        if (rank === 1) medal_type = 'gold'
        else if (rank === 2) medal_type = 'silver'
        else if (rank === 3) medal_type = 'bronze'

        return {
          id: participant.id,
          rank: rank,
          medal_type: medal_type
        }
      })

      // Batch update participants
      for (const update of updates) {
        const { error: updateError } = await supabase
          .from('league_participants')
          .update({ 
            rank: update.rank, 
            medal_type: update.medal_type 
          })
          .eq('id', update.id)

        if (updateError) {
          throw updateError
        }

        // Award medals to top 3
        if (update.medal_type) {
          const participant = participants.find(p => p.id === update.id)
          const medalNames = {
            'gold': 'قهرمان لیگ',
            'silver': 'نایب قهرمان',
            'bronze': 'رتبه سوم'
          }

          // Get medal ID
          const { data: medal, error: medalError } = await supabase
            .from('medals')
            .select('id')
            .eq('name', medalNames[update.medal_type])
            .single()

          if (!medalError && medal) {
            // Award medal with expiration
            const expiresAt = new Date()
            expiresAt.setDate(expiresAt.getDate() + 7) // Expires after 1 week

            await supabase
              .from('user_medals')
              .insert({
                user_id: participant.user_id,
                medal_id: medal.id,
                expires_at: expiresAt.toISOString()
              })
          }
        }
      }

      // Mark league as inactive
      await supabase
        .from('leagues')
        .update({ is_active: false })
        .eq('id', league.id)
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        leagues_processed: endedLeagues.length 
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// ========================================
// 5. send_otp - ارسال کد تایید
// ========================================
// Path: supabase/functions/send_otp/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { phone_number } = await req.json()

    // Validate phone number
    const phoneRegex = /^09\d{9}$/
    if (!phoneRegex.test(phone_number)) {
      return new Response(
        JSON.stringify({ error: 'شماره موبایل نامعتبر است' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Generate 6-digit OTP
    const otp_code = Math.floor(100000 + Math.random() * 900000).toString()

    // Set expiration time (5 minutes)
    const expires_at = new Date()
    expires_at.setMinutes(expires_at.getMinutes() + 5)

    // Invalidate previous OTPs
    await supabase
      .from('otp_codes')
      .update({ is_used: true })
      .eq('phone_number', phone_number)
      .eq('is_used', false)

    // Store OTP in database
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

    // Send SMS via SMS provider API (example with Kavenegar)
    const smsApiKey = Deno.env.get('SMS_API_KEY')
    const smsApiUrl = `https://api.kavenegar.com/v1/${smsApiKey}/verify/lookup.json`
    
    const smsResponse = await fetch(smsApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        receptor: phone_number,
        token: otp_code,
        template: 'dosol-verify' // Template name in SMS provider
      })
    })

    if (!smsResponse.ok) {
      throw new Error('Failed to send SMS')
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'کد تایید ارسال شد'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})

// ========================================
// 6. verify_otp - تایید کد OTP
// ========================================
// Path: supabase/functions/verify_otp/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { phone_number, otp_code, user_data } = await req.json()

    // Get the latest OTP for this phone number
    const { data: otpRecord, error: otpError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone_number', phone_number)
      .eq('otp_code', otp_code)
      .eq('is_used', false)
      .gte('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (otpError || !otpRecord) {
      // Increment attempts
      await supabase
        .from('otp_codes')
        .update({ attempts: otpRecord?.attempts + 1 || 1 })
        .eq('phone_number', phone_number)
        .eq('is_used', false)

      return new Response(
        JSON.stringify({ error: 'کد تایید نامعتبر یا منقضی شده است' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Mark OTP as used
    await supabase
      .from('otp_codes')
      .update({ is_used: true })
      .eq('id', otpRecord.id)

    // Check if user exists
    const { data: existingUser, error: userCheckError } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phone_number)
      .single()

    let user
    let isNewUser = false

    if (existingUser) {
      // Update last login
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', existingUser.id)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }
      user = updatedUser
    } else if (user_data) {
      // Create new user
      isNewUser = true
      const { data: newUser, error: createError } = await supabase
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

      if (createError) {
        throw createError
      }
      user = newUser

      // Award first-time medal
      const { data: medal } = await supabase
        .from('medals')
        .select('id')
        .eq('name', 'تازه‌کار')
        .single()

      if (medal) {
        await supabase
          .from('user_medals')
          .insert({
            user_id: user.id,
            medal_id: medal.id
          })
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'اطلاعات کاربر الزامی است' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Create auth session
    const { data: session, error: sessionError } = await supabase.auth.admin.createUser({
      email: `${phone_number}@dosol.ir`, // Pseudo email
      phone: phone_number,
      email_confirm: true,
      user_metadata: {
        user_id: user.id,
        phone_number: phone_number
      }
    })

    if (sessionError) {
      throw sessionError
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        user,
        isNewUser,
        session
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
