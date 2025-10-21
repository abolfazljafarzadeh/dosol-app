-- 🔒 سخت کردن RLS: فقط SELECT برای کاربران
-- همه نوشتن‌ها فقط از طریق Edge Functions

-- 1️⃣ حذف UPDATE policy از profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 2️⃣ فقط SELECT برای کاربران
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- 3️⃣ تایید: همه جداول دیگر فقط SELECT هستند
-- practice_logs, xp_counters, challenge_progress, user_medals, training_plans, purchases
-- همه فقط SELECT دارند ✅

-- 4️⃣ اضافه کردن comment برای مستندسازی
COMMENT ON TABLE public.profiles IS 'User profiles - SELECT only for users, INSERT/UPDATE only via Edge Functions with service role';
COMMENT ON TABLE public.practice_logs IS 'Practice logs - SELECT only for users, INSERT only via submit-practice Edge Function';
COMMENT ON TABLE public.xp_counters IS 'XP counters - SELECT only for users, UPDATE only via Edge Functions';
COMMENT ON TABLE public.challenge_progress IS 'Challenge progress - SELECT only for users, UPDATE only via Edge Functions';
COMMENT ON TABLE public.user_medals IS 'User medals - SELECT only for users, INSERT only via Edge Functions';
COMMENT ON TABLE public.training_plans IS 'Training plans - SELECT only for users, INSERT/UPDATE only via Edge Functions';