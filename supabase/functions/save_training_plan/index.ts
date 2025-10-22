import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    }

    const { days, times, timezone } = await req.json()

    if (!days || !Array.isArray(days) || days.length === 0) {
      return new Response(JSON.stringify({ error: 'روزهای تمرین الزامی است' }), { status: 400 })
    }

    await supabase.from('training_schedule').delete().eq('user_id', user.id)

    const scheduleData = []
    for (const day of days) {
      if (times && times[day]) {
        for (const time of times[day]) {
          scheduleData.push({ user_id: user.id, weekday: day, reminder_time: time, is_active: true })
        }
      } else {
        scheduleData.push({ user_id: user.id, weekday: day, reminder_time: '19:00', is_active: true })
      }
    }

    const { data: insertedData, error: insertError } = await supabase
      .from('training_schedule')
      .insert(scheduleData)
      .select()

    if (insertError) throw insertError

    if (timezone) {
      await supabase.from('users')
        .update({ timezone, updated_at: new Date().toISOString() })
        .eq('id', user.id)
    }

    return new Response(JSON.stringify({ success: true, data: insertedData, message: 'برنامه تمرین ذخیره شد' }), { status: 200 })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }
})
