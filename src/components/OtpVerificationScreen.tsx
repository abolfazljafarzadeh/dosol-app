import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { useApp } from '../App';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowRight, RotateCcw } from 'lucide-react';
import doosellLogo from '@/assets/doosell-logo.svg';

const OtpVerificationScreen = () => {
  const { state, setState, navigate } = useApp();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(120); // 2 دقیقه
  const [canResend, setCanResend] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // شروع countdown
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [countdown]);

  // Focus management after state update
  useEffect(() => {
    if (focusIndex !== null && inputRefs.current[focusIndex]) {
      inputRefs.current[focusIndex]?.focus();
      setFocusIndex(null);
    }
  }, [focusIndex]);

  const handleOtpChange = (index: number, value: string) => {
    console.log('🔢 handleOtpChange called:', { index, value, currentOtp: otp });
    
    // Handle paste - اگر مقدار طولانی‌تر از یک رقم باشد (copy-paste)
    if (value.length > 1) {
      const digits = value.slice(0, 6).split('').filter(d => /^\d$/.test(d));
      const newOtp = [...otp];
      
      for (let i = 0; i < 6 && i < digits.length; i++) {
        if (index + i < 6) {
          newOtp[index + i] = digits[i] || '';
        }
      }
      
      setOtp(newOtp);
      setError('');
      
      const nextIndex = Math.min(index + digits.length, 5);
      setTimeout(() => inputRefs.current[nextIndex]?.focus(), 0);
      
      if (newOtp.every(digit => digit !== '')) {
        setTimeout(() => handleVerifyOtp(newOtp.join('')), 100);
      }
      
      return;
    }

    // فقط اعداد قبول کن
    if (!/^\d$/.test(value)) {
      console.log('❌ Not a digit, ignoring');
      return;
    }

    // اگر باکس قبلاً پر بود و دوباره همون عدد تایپ شد، نادیده بگیر
    if (otp[index] === value) {
      console.log('❌ Duplicate value, ignoring');
      return;
    }

    console.log('✅ Valid input, updating OTP');
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // انتقال به فیلد بعدی
    if (index < 5) {
      console.log('➡️ Moving to next input:', index + 1);
      setFocusIndex(index + 1);
    }

    // تأیید خودکار اگر این آخرین باکس بود
    if (index === 5) {
      const finalOtp = [...newOtp];
      finalOtp[5] = value;
      if (finalOtp.every(digit => digit !== '')) {
        setTimeout(() => handleVerifyOtp(finalOtp.join('')), 100);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // اگر backspace زده شد و باکس خالی است، به باکس قبلی برو
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/[^0-9]/g, '');
    
    if (pastedData.length === 0) return;

    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length && i < 6; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);
    setError('');

    // focus به آخرین باکس پر شده
    const nextEmptyIndex = newOtp.findIndex(digit => digit === '');
    if (nextEmptyIndex !== -1) {
      setTimeout(() => {
        inputRefs.current[nextEmptyIndex]?.focus();
      }, 0);
    } else {
      setTimeout(() => {
        inputRefs.current[5]?.focus();
        // اگر همه پر شد، خودکار verify کن
        if (newOtp.every(digit => digit !== '')) {
          handleVerifyOtp(newOtp.join(''));
        }
      }, 100);
    }
  };

  const handleVerifyOtp = async (otpValue?: string) => {
    const otpCode = otpValue || otp.join('');
    
    if (otpCode.length !== 6) {
      setError('لطفاً کد ۶ رقمی را وارد کنید');
      return;
    }

    if (!state.tempPhone) {
      toast.error('خطا در دریافت شماره تلفن');
      navigate('phone-input');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      console.log('🔐 Verifying OTP via n8n...');

      // فراخوانی Edge Function verify-otp
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { 
          phone: state.tempPhone,
          code: otpCode,
        },
      });

      if (error || !data?.verified) {
        console.error('❌ OTP verification failed:', error);
        setError('کد تأیید نامعتبر است');
        toast.error('کد تأیید نامعتبر است');
        return;
      }

      console.log('✅ OTP verified, setting session...');

      // Set session with received tokens
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (sessionError || !sessionData?.session) {
        console.error('❌ Failed to set session:', sessionError);
        setError('خطا در ایجاد session');
        toast.error('خطا در ورود');
        return;
      }

      console.log('✅ Session set successfully, user:', sessionData.user?.id);

      // دریافت user از session فعال
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('❌ No user after session set');
        setError('خطا در دریافت اطلاعات کاربر');
        return;
      }

      console.log('✅ Session created, loading profile...');

      // بررسی پروفایل کاربر
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      const isProfileComplete = profile && 
                                 profile.first_name && 
                                 profile.instrument && 
                                 profile.level;
      
      if (isProfileComplete) {
        console.log('✅ Profile is complete, loading data...');

        // دریافت XP counter
        const { data: xpCounter } = await supabase
          .from('xp_counters')
          .select('*')
          .eq('user_id', user.id)
          .single();

        // دریافت practice logs
        const { data: practiceLogs } = await supabase
          .from('practice_logs')
          .select('*')
          .eq('user_id', user.id)
          .order('practiced_on', { ascending: false });

        const userData = {
          id: profile.id,
          firstName: profile.first_name || '',
          lastName: profile.last_name || '',
          phone: profile.phone,
          instrument: profile.instrument || '',
          skillLevel: profile.level || '',
          city: '',
          createdAt: profile.created_at,
          is_premium: profile.is_premium || false,
        };

        const statsData = {
          totalPoints: xpCounter?.total_xp || 0,
          streak: xpCounter?.streak || 0,
          level: Math.floor((xpCounter?.total_xp || 0) / 100) + 1,
          hasActiveSubscription: profile.is_premium || false,
          subscriptionExpiryDate: null,
        };

        const logsData = (practiceLogs || []).map((log: any) => ({
          id: log.id,
          date: log.practiced_on,
          minutes: log.minutes,
          notes: log.note || '',
          points: log.xp_earned || 0,
        }));

        // ذخیره در localStorage
        localStorage.setItem('doosell_demo_user', JSON.stringify(userData));
        localStorage.setItem('doosell_demo_stats', JSON.stringify(statsData));
        localStorage.setItem('doosell_demo_practice_logs', JSON.stringify(logsData));
        
        const { data: { session } } = await supabase.auth.getSession();
        
        setState(prev => ({
          ...prev,
          user: userData,
          isAuthenticated: true,
          currentPage: 'dashboard',
          practicesLogs: logsData,
          totalPoints: statsData.totalPoints,
          streak: statsData.streak,
          level: statsData.level,
          hasActiveSubscription: statsData.hasActiveSubscription,
          subscriptionExpiryDate: statsData.subscriptionExpiryDate,
          session: session,
          tempPhone: undefined,
          notificationsEnabled: localStorage.getItem('doosell_notifications') !== 'false',
          practiceFrequency: parseInt(localStorage.getItem('doosell_practice_frequency') || '0'),
          practiceDays: JSON.parse(localStorage.getItem('doosell_practice_days') || '[]'),
          practiceTime: localStorage.getItem('doosell_practice_time') || '20:00',
        }));
        
        toast.success('خوش آمدید! ورود موفقیت‌آمیز بود');
        navigate('dashboard');
      } else {
        // پروفایل ناقص - به user-details هدایت کن
        console.log('📝 Profile incomplete, redirecting to complete it...');

        const { data: { session } } = await supabase.auth.getSession();

        setState(prev => ({
          ...prev,
          session: session,
          isAuthenticated: true,
          tempPhone: undefined,
        }));
        
        toast.success('کد تأیید شد. لطفاً اطلاعات خود را تکمیل کنید');
        navigate('user-details');
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      setError('خطا در تأیید کد. لطفاً دوباره تلاش کنید');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend || !state.tempPhone) return;

    setIsResending(true);
    setError('');

    try {
      // فراخوانی Edge Function request-otp
      const { data, error } = await supabase.functions.invoke('request-otp', {
        body: { phone: state.tempPhone },
      });

      if (error || !data?.ok) {
        console.error('Resend OTP error:', error);
        toast.error('خطا در ارسال مجدد کد');
        return;
      }

      toast.success('کد تأیید مجدد ارسال شد');
      setCountdown(120);
      setCanResend(false);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (error) {
      console.error('Resend OTP error:', error);
      toast.error('خطا در ارسال مجدد کد');
    } finally {
      setIsResending(false);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatPhone = (phone: string) => {
    return phone.replace(/(\d{4})(\d{3})(\d{4})/, '$1 $2 $3');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 p-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center mb-8 pt-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('phone-input')}
            className="ml-4 rounded-lg"
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-400 rounded-xl shadow-lg flex items-center justify-center p-2">
            <img 
              src={doosellLogo} 
              alt="دوسل" 
              className="w-full h-full object-contain"
            />
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl mb-3 text-gray-800">کد تأیید</h1>
          <p className="text-gray-600 leading-relaxed mb-2">
            کد ۶ رقمی ارسال شده به شماره
          </p>
          <p className="text-lg text-gray-800 mb-4" dir="ltr">
            {state.tempPhone || ''}
          </p>
        </div>

        {/* OTP Input */}
        <div className="mb-6">
          <Label className="text-gray-700 mb-4 block text-center">کد تأیید را وارد کنید</Label>
          <div className="flex justify-center gap-2 mb-4" dir="ltr">
            {otp.map((digit, index) => (
              <Input
                key={index}
                ref={el => inputRefs.current[index] = el}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-12 h-12 text-center text-lg"
                autoFocus={index === 0}
              />
            ))}
          </div>
          {error && (
            <p className="text-red-500 text-sm text-center mt-2">{error}</p>
          )}
        </div>

        {/* Verify Button */}
        <Button 
          onClick={() => handleVerifyOtp()}
          disabled={isLoading || otp.some(digit => digit === '')}
          className="w-full bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl h-12 text-lg shadow-lg mb-6"
        >
          {isLoading ? 'در حال تأیید...' : 'تأیید کد'}
        </Button>

        {/* Resend Section */}
        <div className="text-center">
          {!canResend ? (
            <p className="text-gray-500 text-sm">
              ارسال مجدد کد در {formatTime(countdown)}
            </p>
          ) : (
            <Button
              variant="ghost"
              onClick={handleResendOtp}
              disabled={isResending}
              className="text-orange-500 hover:text-orange-600 text-sm"
            >
              {isResending ? (
                <>
                  <RotateCcw className="w-4 h-4 ml-2 animate-spin" />
                  در حال ارسال...
                </>
              ) : (
                'ارسال مجدد کد'
              )}
            </Button>
          )}
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            اگر کد را دریافت نکردید، بررسی کنید که شماره تلفن درست وارد شده باشد
          </p>
        </div>
      </div>
    </div>
  );
};

export default OtpVerificationScreen;