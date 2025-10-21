-- Add subscription dates to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster queries on subscription status
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_expires 
ON public.profiles(subscription_expires_at);

-- Add a helper function to check if subscription is active
CREATE OR REPLACE FUNCTION public.is_subscription_active(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_active BOOLEAN;
BEGIN
  SELECT 
    is_premium = true 
    AND subscription_expires_at IS NOT NULL 
    AND subscription_expires_at > NOW()
  INTO is_active
  FROM profiles
  WHERE id = user_id;
  
  RETURN COALESCE(is_active, false);
END;
$$;