-- Add push_token field to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_push_token 
ON public.profiles(push_token) 
WHERE push_token IS NOT NULL;

-- Add index for notifications_enabled lookups
CREATE INDEX IF NOT EXISTS idx_profiles_notifications_enabled 
ON public.profiles(notifications_enabled) 
WHERE notifications_enabled = true;