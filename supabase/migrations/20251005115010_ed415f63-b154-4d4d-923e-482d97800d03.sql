-- Add authority and ref_id columns to purchases table
ALTER TABLE public.purchases
ADD COLUMN IF NOT EXISTS authority TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS ref_id TEXT;

-- Add is_premium column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_purchases_authority ON public.purchases(authority);