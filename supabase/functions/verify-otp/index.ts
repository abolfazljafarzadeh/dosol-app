import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

serve(async (req) => {
  try {
    const { phone, code } = await req.json()
    if (!phone || !code) return new Response("Bad Request", { status: 400 })

    // بررسی در جدول otps
    const { data } = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/otps?phone=eq.${phone}&code=eq.${code}`, {
      headers: {
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      },
    }).then((r) => r.json())

    if (!data?.length) {
      return new Response(JSON.stringify({ error: "کد اشتباه است" }), { status: 400 })
    }

    // بررسی زمان انقضا
    const otp = data[0]
    if (new Date(otp.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "کد منقضی شده است" }), { status: 400 })
    }

    // حذف کد استفاده‌شده
    await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/otps?phone=eq.${phone}`, {
      method: "DELETE",
      headers: {
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      },
    })

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
