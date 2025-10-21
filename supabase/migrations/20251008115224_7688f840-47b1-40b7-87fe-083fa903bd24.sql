-- Drop existing otp_codes table and create new one with correct structure
DROP TABLE IF EXISTS public.otp_codes;

CREATE TABLE public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- Policy: Service role only access
CREATE POLICY "Service role only access"
ON public.otp_codes
FOR ALL
TO authenticated
USING (false);

-- Create index on phone for faster lookups
CREATE INDEX idx_otp_codes_phone ON public.otp_codes(phone);
CREATE INDEX idx_otp_codes_created_at ON public.otp_codes(created_at);