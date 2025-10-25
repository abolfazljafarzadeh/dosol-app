import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useApp } from '../App';
import { sendOTP } from '../utils/api';
import { toast } from 'sonner@2.0.3';
import doosellLogo from 'figma:asset/b58b06cddb1628092c6db84c1360a4a9e7aca31b.png';

const PhoneInputScreen = () => {
  const { state, setState, navigate } = useApp();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validatePhone = (phone: string) => {
    if (!phone.trim()) {
      return 'شماره موبایل الزامی است';
    }
    if (!/^09\d{9}$/.test(phone)) {
      return 'شماره موبایل نامعتبر است';
    }
    return '';
  };



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('📱 Submit clicked with phone:', phone);
    
    const phoneError = validatePhone(phone);
    if (phoneError) {
      console.log('❌ Validation error:', phoneError);
      setError(phoneError);
      return;
    }

    console.log('✅ Phone validation passed');
    setError('');
    setIsLoading(true);

    try {
      console.log('🔄 Calling sendOTP...');
      // ارسال کد تأیید
      const response = await sendOTP(phone);
      console.log('📞 sendOTP response:', response);
      
      if (response.success) {
        // ذخیره شماره تلفن و انتقال به صفحه تأیید OTP
        setState(prev => ({
          ...prev,
          tempPhone: phone,
        }));
        
        console.log('✅ Navigating to OTP verification');
        toast.success('کد تأیید به شماره شما ارسال شد');
        navigate('otp-verification');
      } else {
        console.log('❌ Send OTP failed:', response.message);
        setError(response.message || 'خطا در ارسال کد تأیید');
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      setError('خطا در ارسال کد تأیید. لطفاً دوباره تلاش کنید');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 p-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8 pt-16">
          <div className="w-20 h-20 mx-auto bg-gradient-to-br from-orange-400 to-amber-400 rounded-2xl shadow-lg flex items-center justify-center mb-6 p-4">
            <img 
              src={doosellLogo} 
              alt="دوسل" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl mb-3 text-gray-800">به دوسل خوش آمدید!</h1>
          <p className="text-gray-600 leading-relaxed mb-4">
            برای شروع، شماره موبایل خود را وارد کنید
          </p>

        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="phone" className="text-gray-700">شماره موبایل</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09xxxxxxxxx"
              className="mt-2 h-12 text-center"
              dir="ltr"
              maxLength={11}
            />
            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
          </div>

          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl h-12 text-lg shadow-lg"
          >
            {isLoading ? 'در حال بررسی...' : 'ادامه'}
          </Button>
          
          <button 
            type="button"
            onClick={() => {
              setPhone('09123456789');
              setError('');
            }}
            className="w-full mt-3 bg-gray-200 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-300"
          >
            شماره تست
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            با ادامه، شما با قوانین و مقررات دوسل موافقت می‌کنید
          </p>
        </div>
      </div>
    </div>
  );
};

export default PhoneInputScreen;