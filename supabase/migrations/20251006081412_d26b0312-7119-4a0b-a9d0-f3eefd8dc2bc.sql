-- 🔒 رفع Security Warnings

-- 1️⃣ جداول otp_codes و processed_requests باید RLS داشته باشند
-- این جداول فقط توسط Edge Functions (با service role) قابل دسترسی هستند

-- otp_codes: فقط Edge Functions می‌توانند بخوانند/بنویسند
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- هیچ policy برای کاربران عادی نمی‌گذاریم
-- فقط service role (Edge Functions) می‌تواند دسترسی داشته باشد
COMMENT ON TABLE public.otp_codes IS 'OTP codes storage - NO user access, only Edge Functions with service role';

-- processed_requests: برای idempotency، فقط Edge Functions
ALTER TABLE public.processed_requests ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.processed_requests IS 'Processed requests for idempotency - NO user access, only Edge Functions with service role';

-- 2️⃣ بررسی سایر جداول
-- challenges, courses, invites, league_members, medals, weekly_leagues
-- این جداول policy دارند ✅

-- 3️⃣ جداول kv_store برای Edge Functions
-- احتمالاً وجود دارد و باید RLS فعال شود
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'kv_store_80493cf3') THEN
        EXECUTE 'ALTER TABLE public.kv_store_80493cf3 ENABLE ROW LEVEL SECURITY';
        EXECUTE 'COMMENT ON TABLE public.kv_store_80493cf3 IS ''KV store for Edge Functions - NO user access''';
    END IF;
END
$$;