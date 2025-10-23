import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useApp } from '../App';
import { verifyOTP, sendOTP } from '../utils/api';
import { toast } from 'sonner@2.0.3';
import { ArrowRight, RotateCcw } from 'lucide-react';
import doosellLogo from 'figma:asset/b58b06cddb1628092c6db84c1360a4a9e7aca31b.png';

const OtpVerificationScreen = () => {
  const { state, setState, navigate } = useApp();
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [countdown, setCountdown] = useState(120); // 2 دقیقه
  const [canResend, setCanResend] = useState(false);
  
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

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return; // فقط یک رقم
    if (!/^\d*$/.test(value)) return; // فقط اعداد

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setError('');

    // انتقال به فیلد بعدی
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // تأیید خودکار اگر همه فیلدها پر شد
    if (value && index === 5 && newOtp.every(digit => digit !== '')) {
      handleVerifyOtp(newOtp.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
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
      const response = await verifyOTP(state.tempPhone, otpCode);
      
      if (response.success) {
        if (response.userExists && response.user && response.stats && response.session) {
          // کاربر موجود است - ورود و ذخیره در localStorage
          localStorage.setItem('doosell_demo_user', JSON.stringify(response.user));
          localStorage.setItem('doosell_demo_stats', JSON.stringify(response.stats));
          localStorage.setItem('doosell_demo_practice_logs', JSON.stringify(response.practiceLogs || []));
          
          setState(prev => ({
            ...prev,
            user: response.user!,
            isAuthenticated: true,
            currentPage: 'dashboard',
            practicesLogs: response.practiceLogs || [],
            totalPoints: response.stats!.totalPoints,
            streak: response.stats!.streak,
            level: response.stats!.level,
            hasActiveSubscription: response.stats!.hasActiveSubscription,
            subscriptionExpiryDate: response.stats!.subscriptionExpiryDate,
            session: response.session,
            tempPhone: undefined,
            // Load local preferences
            notificationsEnabled: localStorage.getItem('doosell_notifications') !== 'false',
            practiceFrequency: parseInt(localStorage.getItem('doosell_practice_frequency') || '0'),
            practiceDays: JSON.parse(localStorage.getItem('doosell_practice_days') || '[]'),
            practiceTime: localStorage.getItem('doosell_practice_time') || '20:00',
          }));
          
          toast.success('خوش آمدید! ورود موفقیت‌آمیز بود');
          navigate('dashboard');
        } else {
          // کاربر جدید است - انتقال به صفحه تکمیل اطلاعات
          toast.success('کد تأیید شد. لطفاً اطلاعات خود را تکمیل کنید');
          navigate('user-details');
        }
      } else {
        setError('کد تأیید نامعتبر است');
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
      await sendOTP(state.tempPhone);
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
          <p className="text-lg text-gray-800 dir-ltr mb-4">
            {state.tempPhone ? formatPhone(state.tempPhone) : ''}
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
            <p className="text-blue-700 mb-1">💡 برای تست:</p>
            <p className="text-blue-600">کد تأیید: <span className="font-mono dir-ltr">123456</span></p>
            <p className="text-blue-600 text-xs mt-1">
              برای کاربر موجود از شماره <span className="font-mono dir-ltr">09123456789</span> استفاده کنید
            </p>
          </div>
        </div>

        {/* OTP Input */}
        <div className="mb-6">
          <Label className="text-gray-700 mb-4 block text-center">کد تأیید را وارد کنید</Label>
          <div className="flex justify-center gap-3 mb-4" dir="ltr">
            {otp.map((digit, index) => (
              <Input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="w-12 h-12 text-center text-lg font-medium border-2 rounded-xl"
                maxLength={1}
                inputMode="numeric"
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