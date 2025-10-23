import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const today = new Date()
    const currentDay = today.getDay()
    const daysToSaturday = (6 - currentDay + 7) % 7
    const weekStart = new Date(today)
    weekStart.setDate(today.getDate() - daysToSaturday)
    weekStart.setHours(0, 0, 0, 0)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    await supabase.from('leagues').update({ is_active: false }).lt('week_end_date', weekStart.toISOString())

    const { data: activeUsers } = await supabase
      .from('practice_logs')
      .select('user_id')
      .gte('practice_date', weekStart.toISOString())
      .lte('practice_date', weekEnd.toISOString())

    const uniqueIds = [...new Set(activeUsers?.map(u => u.user_id))]
    const leaguesNeeded = Math.ceil(uniqueIds.length / 12)
    const leagues = Array.from({ length: leaguesNeeded }, (_, i) => ({
      week_start_date: weekStart.toISOString(),
      week_end_date: weekEnd.toISOString(),
      league_number: i + 1,
      is_active: true
    }))

    const { data: createdLeagues } = await supabase.from('leagues').insert(leagues).select()

    const shuffled = uniqueIds.sort(() => Math.random() - 0.5)
    const participants = shuffled.map((uid, i) => ({
      league_id: createdLeagues[Math.floor(i / 12)].id,
      user_id: uid,
      weekly_xp: 0
    }))

    await supabase.from('league_participants').insert(participants)

    return new Response(JSON.stringify({ success: true, leagues: createdLeagues.length }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
})
