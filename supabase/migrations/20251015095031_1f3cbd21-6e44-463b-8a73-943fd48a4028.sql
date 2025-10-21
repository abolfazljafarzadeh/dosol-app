-- Drop foreign key constraint if exists
ALTER TABLE public.purchases 
DROP CONSTRAINT IF EXISTS purchases_course_id_fkey;

-- Change course_id type from UUID to integer
ALTER TABLE public.purchases 
ALTER COLUMN course_id TYPE integer USING course_id::text::integer;