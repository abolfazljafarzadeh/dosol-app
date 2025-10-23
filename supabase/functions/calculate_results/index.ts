import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const today = new Date()
    const { data: endedLeagues } = await supabase
      .from('leagues')
      .select('*')
      .eq('is_active', true)
      .lt('week_end_date', today.toISOString())

    for (const league of endedLeagues ?? []) {
      const { data: participants } = await supabase
        .from('league_participants')
        .select('*')
        .eq('league_id', league.id)
        .order('weekly_xp', { ascending: false })

      for (let i = 0; i < participants.length; i++) {
        const medal = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : null
        await supabase.from('league_participants')
          .update({ rank: i + 1, medal_type: medal })
          .eq('id', participants[i].id)
      }

      await supabase.from('leagues').update({ is_active: false }).eq('id', league.id)
    }

    return new Response(JSON.stringify({ success: true }), { status: 200 })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 })
  }
})
