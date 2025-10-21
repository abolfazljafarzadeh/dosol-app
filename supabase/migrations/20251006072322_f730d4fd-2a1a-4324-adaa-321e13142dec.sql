-- Add last_name column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;