-- ═══════════════════════════════════════════════════════════
-- Fix remaining RLS security warnings
-- ═══════════════════════════════════════════════════════════

-- otp_codes: Service role only (used by OTP edge functions)
DROP POLICY IF EXISTS "Service role only access" ON public.otp_codes;
CREATE POLICY "Service role only access"
  ON public.otp_codes
  FOR ALL
  USING (false);

-- processed_requests: Service role only (idempotency tracking)
DROP POLICY IF EXISTS "Service role only access" ON public.processed_requests;
CREATE POLICY "Service role only access"
  ON public.processed_requests
  FOR ALL
  USING (false);

-- ═══════════════════════════════════════════════════════════
-- All RLS warnings fixed
-- ═══════════════════════════════════════════════════════════