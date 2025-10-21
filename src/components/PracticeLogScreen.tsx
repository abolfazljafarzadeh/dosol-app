import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { useApp } from '../App';
import { ArrowRight, Clock, Star } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../integrations/supabase/client';
import { logPractice } from '@/services/backend';

const PracticeLogScreen = () => {
  const { state, setState, navigate } = useApp();
  const [minutes, setMinutes] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(crypto.randomUUID());
  const [xpGained, setXpGained] = useState(0);

  const quickMinutes = [15, 30, 45, 60];
  
  // Check today's logs - from state populated by server
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = state.practicesLogs.filter(log => {
    const logDate = log.date.includes('T') ? log.date.split('T')[0] : log.date;
    return logDate === today;
  });
  const todayMinutes = todayLogs.reduce((sum, log) => sum + log.minutes, 0);
  const todayEntries = todayLogs.length;

  // XP cap: max 160 per day
  const xpToday = state.xpToday || 0;
  const hasReachedDailyCap = xpToday >= 160;

  const motivationalMessages = [
    "همین که امروز تمرین کردی، عالیه",
    "با هر تمرین، یه قدم نزدیک‌تری", 
    "ثبات یعنی قدرت — داری عالی پیش میری!",
    "هر دقیقه تمرین، یک قدم به سمت حرفه‌ای شدن",
    "امروز هم بهترین نسخه خودت بودی"
  ];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    const minutesNum = parseInt(minutes);

    if (!minutes.trim()) {
      newErrors.minutes = 'دقایق تمرین الزامی است';
    } else if (isNaN(minutesNum) || minutesNum < 5) {
      newErrors.minutes = 'حداقل ۵ دقیقه تمرین لازم است';
    } else if (minutesNum + todayMinutes > 240) {
      newErrors.minutes = `حداکثر ${240 - todayMinutes} دقیقه امروز می‌توانید ثبت کنید`;
    }

    if (todayEntries >= 2) {
      newErrors.general = 'شما امروز ۲ بار تمرین ثبت کرده‌اید';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleQuickSelect = (mins: number) => {
    setMinutes(mins.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Guard: Check session before submission
    if (!state.session?.user?.id) {
      toast.error('لطفاً ابتدا وارد شوید');
      setState(prev => ({ ...prev, currentPage: 'phone-input', isAuthenticated: false }));
      return;
    }
    
    if (validateForm() && !isLoading) {
      setIsLoading(true);
      
      try {
        const minutesNum = parseInt(minutes);
        
        // Call log-practice Edge Function with idempotency key
        const response = await logPractice({
          minutes: minutesNum,
          note: notes.trim() || undefined,
          idempotencyKey,
        });

        if (!response.ok) {
          // Handle error codes from backend
          if (response.code === 'LEAGUE_LOCKED') {
            toast.error('لیگ بسته است؛ امتیاز قابل افزایش نیست.');
          } else if (response.code === 'DAILY_LIMIT') {
            toast.error(response.message || 'حداکثر دو ثبت یا ۲۴۰ دقیقه در روز.');
          } else if (response.code === 'MIN_DURATION') {
            toast.error('حداقل ۵ دقیقه.');
          } else {
            toast.error(response.message || 'خطای شبکه/سرور؛ دوباره تلاش کنید.');
          }
          setIsLoading(false);
          return;
        }

        // Update state from server response - NO CLIENT CALCULATIONS
        setState(prev => ({
          ...prev,
          totalPoints: response.xpTotal || prev.totalPoints,
          streak: response.streak?.current || prev.streak,
          xpToday: response.xpToday || 0,
          level: response.level || Math.floor((response.xpTotal || 0) / 500) + 1,
        }));

        setXpGained(response.xpGained || 0);

        // Refresh practice logs from database
        if (state.session?.user?.id) {
          const { data: logs } = await supabase
            .from('practice_logs')
            .select('*')
            .eq('user_id', state.session.user.id)
            .order('practiced_on', { ascending: false });

          if (logs) {
            const formattedLogs = logs.map(log => ({
              id: log.id,
              date: log.practiced_on,
              minutes: log.minutes,
              notes: log.note || '',
              points: Math.floor(log.minutes / 15) * 10,
            }));
            
            setState(prev => ({
              ...prev,
              practicesLogs: formattedLogs
            }));
          }

          // Fetch new notifications (medals, challenges)
          const { data: newNotifications } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', state.session.user.id)
            .eq('status', 'queued')
            .order('created_at', { ascending: false })
            .limit(10);

          if (newNotifications && newNotifications.length > 0) {
            // Show notifications with toasts
            newNotifications.forEach((notif: any) => {
              if (notif.type === 'medal_unlocked') {
                const payload = notif.payload as any;
                toast.success(`🏅 مدال جدید: ${payload.medal_title || 'مدال'}`, {
                  description: payload.xp_reward ? `+${payload.xp_reward} امتیاز` : undefined,
                });
              } else if (notif.type === 'practice_logged') {
                // Already shown via toast.success below
              }
            });

            // Mark notifications as sent (optional - for tracking)
            await supabase
              .from('notifications')
              .update({ status: 'sent' })
              .in('id', newNotifications.map((n: any) => n.id));
          }
        }

        toast.success('تمرین با موفقیت ثبت شد!');

        // Show success modal
        setShowSuccess(true);
        // Reset form
        setMinutes('');
        setNotes('');
        setIdempotencyKey(crypto.randomUUID());
        
      } catch (err: any) {
        console.error('Practice log submission error:', err);
        
        // Handle auth errors
        if (err?.message === 'AUTH_REQUIRED' || err?.message === 'SESSION_EXPIRED') {
          toast.error('لطفاً دوباره وارد شوید');
          setState(prev => ({ ...prev, currentPage: 'phone-input', isAuthenticated: false }));
          return;
        }
        
        // Enhanced error reporting with status and body
        const status = err?.status;
        const code = err?.body?.code;
        const msg = err?.body?.message || err?.message;
        
        console.warn('logPractice failed:', { status, code, msg, fullError: err });
        
        // Show meaningful error based on code or status
        if (code === 'LEAGUE_LOCKED') {
          toast.error('لیگ بسته است؛ امتیاز قابل افزایش نیست.');
        } else if (code === 'DAILY_LIMIT') {
          toast.error(msg || 'حداکثر دو ثبت یا ۲۴۰ دقیقه در روز.');
        } else if (code === 'MIN_DURATION') {
          toast.error('حداقل ۵ دقیقه.');
        } else if (status === 401 || status === 403) {
          toast.error('خطای احراز هویت - لطفاً دوباره وارد شوید');
          setState(prev => ({ ...prev, currentPage: 'phone-input', isAuthenticated: false }));
        } else {
          toast.error(msg || `خطای سرور (${status || 'unknown'})`);
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    navigate('dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-l from-orange-400 to-amber-400 text-white p-6 rounded-b-3xl">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('dashboard')}
            className="text-white hover:bg-white/20 p-2 rounded-xl"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="text-xl">ثبت تمرین امروز</h1>
        </div>
        
        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
          <div className="flex items-center justify-between text-sm">
            <span>امروز: {todayMinutes} دقیقه</span>
            <span>ورودی‌ها: {todayEntries}/۲</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {errors.general && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3">
            <p className="text-red-700 text-sm">{errors.general}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Minutes Input */}
          <div>
            <Label htmlFor="minutes" className="text-base mb-2 block">چند دقیقه تمرین کردی؟</Label>
            <Input
              id="minutes"
              type="number"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              placeholder="دقایق تمرین"
              className="text-center text-xl h-12 rounded-xl"
              min="5"
              max="240"
            />
            {errors.minutes && (
              <p className="text-red-500 text-sm mt-1">{errors.minutes}</p>
            )}
            
            {/* Quick Select Chips */}
            <div className="grid grid-cols-4 gap-2 mt-3">
              {quickMinutes.map((mins) => (
                <Button
                  key={mins}
                  type="button"
                  variant="outline"
                  onClick={() => handleQuickSelect(mins)}
                  className="rounded-xl h-12 text-lg"
                >
                  {mins}
                </Button>
              ))}
            </div>
          </div>

          {/* XP Cap Warning */}
          {hasReachedDailyCap && (
            <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
              <CardContent className="p-4">
                <div className="text-center text-orange-700">
                  <Star className="w-5 h-5 mx-auto mb-2 text-orange-500" />
                  <span className="text-sm">
                    امروز به سقف روزانه (۱۶۰ XP) رسیده‌اید
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notes */}
          <div>
            <Label htmlFor="notes" className="text-base mb-2 block">امروز چی تمرین کردی؟</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثلاً: گام دو ماژو��، اتود شماره ۳، آهنگ مورد علاقه..."
              className="rounded-xl resize-none h-20"
              maxLength={200}
            />
            <p className="text-xs text-gray-500 mt-1">اختیاری - حداکثر ۲۰۰ کاراکتر</p>
          </div>

          {/* Daily Tip */}
          <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
            <CardContent className="p-4 text-center">
              <h4 className="text-sm text-blue-800 mb-2">نکته روز:</h4>
              <p className="text-sm text-blue-700">
                مهم نیست چقدر تمرین کردی، مهم اینه که ادامه دادی.
              </p>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-2xl h-12 text-lg shadow-lg"
            disabled={todayEntries >= 2 || isLoading || hasReachedDailyCap}
          >
            <Clock className="w-5 h-5 ml-2" />
            {isLoading ? 'در حال ثبت...' : 'ثبت تمرین'}
          </Button>
        </form>

        {/* Practice Rules */}
        <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
          <CardHeader>
            <CardTitle className="text-base">قوانین ثبت تمرین</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-blue-700">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>حداکثر ۲ بار در روز ثبت کنید</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-blue-700">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>حداکثر ۲۴۰ دقیقه در روز</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-blue-700">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>هر ۱۵ دقیقه = ۱۰ امتیاز</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Success Modal */}
      <Dialog open={showSuccess} onOpenChange={setShowSuccess}>
        <DialogContent className="mx-4 text-center">
          <DialogHeader>
            <DialogTitle className="text-xl mb-2">عالی!</DialogTitle>
            <DialogDescription className="text-base">
              {motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)]}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200">
              <div className="flex items-center justify-center gap-2 text-amber-700">
                <Star className="w-5 h-5" />
                <span className="text-lg">+{xpGained} امتیاز دریافت کردید</span>
              </div>
            </div>
            <Button 
              onClick={handleSuccessClose}
              className="w-full bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl"
            >
              بازگشت به صفحه اصلی
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PracticeLogScreen;