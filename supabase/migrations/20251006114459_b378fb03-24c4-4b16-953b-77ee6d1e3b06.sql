-- ═══════════════════════════════════════════════════════════
-- Fix Security Warnings from Phase 1
-- ═══════════════════════════════════════════════════════════

-- Fix outbox_events: This table is service-role only
-- Add a restrictive policy that prevents normal users from accessing it
DROP POLICY IF EXISTS "Service role only access" ON public.outbox_events;
CREATE POLICY "Service role only access"
  ON public.outbox_events
  FOR ALL
  USING (false);

-- ═══════════════════════════════════════════════════════════
-- Security fixes complete
-- ═══════════════════════════════════════════════════════════