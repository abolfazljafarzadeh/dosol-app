import { serve } from "https://deno.land/std@0.177.0/http/server.ts"

serve(async (req) => {
  try {
    const { phone } = await req.json()
    if (!phone || !/^09\d{9}$/.test(phone)) {
      return new Response(JSON.stringify({ error: "شماره معتبر نیست" }), { status: 400 })
    }

    // ساخت کد 6 رقمی
    const otp = Math.floor(100000 + Math.random() * 900000)

    // ذخیره در جدول otps (جدولی که از SQL راهنما ساختی)
    const resp = await fetch(`${Deno.env.get("SUPABASE_URL")}/rest/v1/otps`, {
      method: "POST",
      headers: {
        apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        phone,
        code: otp,
        expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // دو دقیقه اعتبار
      }),
    })

    // ارسال پیامک با کاوه‌نگار
    const smsResp = await fetch("https://api.kavenegar.com/v1/61747665446E767646647868525A4D3764754F516972336F704A635A63752B56716E43426856616E504B513D/verify/lookup.json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        receptor: phone,
        token: String(otp),
        template: "verify", // اسم قالب کاوه‌نگار
      }),
    })

    const smsData = await smsResp.json()
    console.log("SMS sent:", smsData)

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } })
  } catch (err) {
    console.error("Error:", err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
