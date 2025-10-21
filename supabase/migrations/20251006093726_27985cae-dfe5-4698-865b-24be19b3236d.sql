-- Add state column to purchases for CSRF/replay protection
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS state text;

-- Add index on state for faster lookups
CREATE INDEX IF NOT EXISTS idx_purchases_state ON public.purchases(state);

-- Add index on authority for faster lookups in verify
CREATE INDEX IF NOT EXISTS idx_purchases_authority ON public.purchases(authority);