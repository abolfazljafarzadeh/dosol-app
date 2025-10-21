-- Insert sample medals
INSERT INTO public.medals (code, kind, title, description) VALUES
  ('league-first', 'temporary', 'مقام اول لیگ', 'رتبه اول در لیگ هفتگی'),
  ('league-second', 'temporary', 'مقام دوم لیگ', 'رتبه دوم در لیگ هفتگی'),
  ('league-third', 'temporary', 'مقام سوم لیگ', 'رتبه سوم در لیگ هفتگی'),
  ('streak-7', 'permanent', 'تمرین ۷ روزه', 'تمرین ۷ روز متوالی'),
  ('streak-30', 'permanent', 'تمرین ۳۰ روزه', 'تمرین ۳۰ روز متوالی'),
  ('xp-1000', 'permanent', '۱۰۰۰ امتیاز', 'کسب ۱۰۰۰ امتیاز'),
  ('xp-5000', 'permanent', '۵۰۰۰ امتیاز', 'کسب ۵۰۰۰ امتیاز')
ON CONFLICT (code) DO NOTHING;

-- Insert sample challenges
INSERT INTO public.challenges (code, title, rules, level, reward) VALUES
  ('5-of-7-days', 'چالش ۵ از ۷ روز', '{"type": "weekly_practice", "required_days": 5, "period": "week"}', null, '{"xp": 100, "medal_code": "streak-7"}'),
  ('beginner-100-minutes', 'چالش مبتدی: ۱۰۰ دقیقه', '{"type": "total_minutes", "required_minutes": 100}', 'مبتدی', '{"xp": 50}'),
  ('intermediate-500-minutes', 'چالش متوسط: ۵۰۰ دقیقه', '{"type": "total_minutes", "required_minutes": 500}', 'متوسط', '{"xp": 200}'),
  ('advanced-1000-minutes', 'چالش پیشرفته: ۱۰۰۰ دقیقه', '{"type": "total_minutes", "required_minutes": 1000}', 'پیشرفته', '{"xp": 500, "medal_code": "xp-1000"}')
ON CONFLICT (code) DO NOTHING;

-- Insert sample courses
INSERT INTO public.courses (title, summary, price, active) VALUES
  ('دوره جامع گیتار', 'آموزش کامل گیتار از مبتدی تا پیشرفته', 500000, true),
  ('تکنیک‌های پیانو', 'تکنیک‌های حرفه‌ای نوازندگی پیانو', 750000, true),
  ('ریتم و آهنگسازی', 'اصول ریتم و آهنگسازی برای همه سازها', 600000, true)
ON CONFLICT DO NOTHING;