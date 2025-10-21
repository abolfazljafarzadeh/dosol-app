-- اضافه کردن شماره 09103144611 به ادمین‌ها
INSERT INTO public.user_roles (user_id, role)
SELECT p.id, 'admin'::app_role
FROM public.profiles p
WHERE p.phone = '09103144611'
ON CONFLICT (user_id, role) DO NOTHING;