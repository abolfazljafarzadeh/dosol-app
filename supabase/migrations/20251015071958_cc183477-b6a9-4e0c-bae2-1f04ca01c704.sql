-- Add read_at column to notifications table for tracking read status
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create index for faster queries on unread notifications (only if not exists)
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
ON public.notifications(user_id, created_at DESC) 
WHERE read_at IS NULL;