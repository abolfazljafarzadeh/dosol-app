-- Add notifications_enabled field to profiles table
ALTER TABLE public.profiles 
ADD COLUMN notifications_enabled boolean NOT NULL DEFAULT true;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.notifications_enabled IS 'Controls whether user receives push notifications';