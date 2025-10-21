-- Make course_id nullable in purchases table since subscriptions don't need a course
ALTER TABLE public.purchases ALTER COLUMN course_id DROP NOT NULL;