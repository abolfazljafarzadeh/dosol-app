-- Disable RLS for otp_codes table since it's only accessed by Edge Functions with SERVICE_ROLE_KEY
-- This table should not be accessible by regular users
ALTER TABLE public.otp_codes DISABLE ROW LEVEL SECURITY;