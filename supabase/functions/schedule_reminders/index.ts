import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async () => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: schedules } = await supabase
      .from('training_schedule')
      .select(`*, users!inner(id, first_name, timezone)`)
      .eq('is_active', true)

    const notifications = []
    const today = new Date()
    const currentWeekday = today.getDay()

    for (const schedule of schedules ?? []) {
      if (schedule.weekday === currentWeekday) {
        const [hours, minutes] = schedule.reminder_time.split(':')
        const scheduledTime = new Date(today)
        scheduledTime.setHours(+hours, +minutes, 0, 0)
        if (scheduledTime > today) {
          notifications.push({
            user_id: schedule.user_id,
            type: 'reminder',
            title: 'وقت تمرین رسیده 🎵',
            body: `سلام ${schedule.users.first_name} عزیز، زمان تمرین ${schedule.reminder_time} است.`,
            scheduled_for: scheduledTime.toISOString()
          })
        }
      }
    }

    if (notifications.length) {
      await supabase.from('push_notifications').insert(notifications)
      const webhookUrl = Deno.env.get('N8N_WEBHOOK_URL')
      if (webhookUrl) {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send_notifications', notifications })
        })
      }
    }

    return new Response(JSON.stringify({ success: true, count: notifications.length }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
})
