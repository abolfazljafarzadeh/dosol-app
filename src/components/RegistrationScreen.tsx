import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { useApp } from '../App';
import { registerUser, loginUser } from '../utils/api';
import { toast } from 'sonner@2.0.3';
import doosellLogo from 'figma:asset/b58b06cddb1628092c6db84c1360a4a9e7aca31b.png';

const RegistrationScreen = () => {
  const { state, setState, navigate } = useApp();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    instrument: '',
    skillLevel: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showOTP, setShowOTP] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false);

  const instruments = [
    { value: 'piano', label: 'پیانو' },
    { value: 'violin', label: 'ویولن' },
    { value: 'santur', label: 'سنتور' },
    { value: 'guitar', label: 'گیتار' },
    { value: 'tar', label: 'تار' },
    { value: 'setar', label: 'سه‌تار' },
    { value: 'oud', label: 'عود' },
    { value: 'kamanche', label: 'کمانچه' },
  ];

  const skillLevels = [
    { value: 'beginner', label: 'تازه‌کار' },
    { value: 'intermediate', label: 'متوسط' },
    { value: 'advanced', label: 'پیشرفته' },
    { value: 'professional', label: 'حرفه‌ای' },
  ];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'نام الزامی است';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'نام خانوادگی الزامی است';
    }
    if (!formData.phone.trim()) {
      newErrors.phone = 'شماره موبایل الزامی است';
    } else if (!/^09\d{9}$/.test(formData.phone)) {
      newErrors.phone = 'شماره موبایل نامعتبر است';
    }
    if (!formData.instrument) {
      newErrors.instrument = 'انتخاب ساز الزامی است';
    }
    if (!formData.skillLevel) {
      newErrors.skillLevel = 'انتخاب سطح مهارت الزامی است';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setShowOTP(true);
    }
  };

  const handleOTPSubmit = async () => {
    if (otpCode.length === 4 && !isLoading) {
      setIsLoading(true);
      
      try {
        if (isExistingUser) {
          // Try to login existing user
          console.log('Attempting login for existing user...');
          const loginResponse = await loginUser(formData.phone);
          
          setState(prev => ({
            ...prev,
            user: loginResponse.user,
            isAuthenticated: true,
            currentPage: 'dashboard',
            practicesLogs: loginResponse.practiceLogs,
            totalPoints: loginResponse.stats.totalPoints,
            streak: loginResponse.stats.streak,
            level: loginResponse.stats.level,
            hasActiveSubscription: loginResponse.stats.hasActiveSubscription,
            subscriptionExpiryDate: loginResponse.stats.subscriptionExpiryDate,
            session: loginResponse.session,
            // Load local preferences
            notificationsEnabled: localStorage.getItem('doosell_notifications') !== 'false',
            practiceFrequency: parseInt(localStorage.getItem('doosell_practice_frequency') || '0'),
            practiceDays: JSON.parse(localStorage.getItem('doosell_practice_days') || '[]'),
            practiceTime: localStorage.getItem('doosell_practice_time') || '20:00',
          }));
          
          // Clean up localStorage for backwards compatibility
          localStorage.removeItem('doosell_user');
          
          toast.success('خوش آمدید! ورود موفقیت‌آمیز بود');
          navigate('dashboard');
        } else {
          // Register new user
          console.log('Attempting registration for new user...');
          const registerResponse = await registerUser(formData);
          
          // Check if user already existed
          if (registerResponse.userExists) {
            // User already exists, treat as login
            setState(prev => ({
              ...prev,
              user: registerResponse.user,
              isAuthenticated: true,
              currentPage: 'dashboard',
              practicesLogs: registerResponse.practiceLogs || [],
              totalPoints: registerResponse.stats?.totalPoints || 0,
              streak: registerResponse.stats?.streak || 0,
              level: registerResponse.stats?.level || 1,
              hasActiveSubscription: registerResponse.stats?.hasActiveSubscription || false,
              subscriptionExpiryDate: registerResponse.stats?.subscriptionExpiryDate || null,
              session: registerResponse.session || { user: registerResponse.authUser, access_token: null },
              // Load local preferences
              notificationsEnabled: localStorage.getItem('doosell_notifications') !== 'false',
              practiceFrequency: parseInt(localStorage.getItem('doosell_practice_frequency') || '0'),
              practiceDays: JSON.parse(localStorage.getItem('doosell_practice_days') || '[]'),
              practiceTime: localStorage.getItem('doosell_practice_time') || '20:00',
            }));
            
            toast.success('شما قبلاً ثبت‌نام کرده‌اید! خوش آمدید');
            navigate('dashboard');
          } else {
            // New user registration
            setState(prev => ({
              ...prev,
              user: registerResponse.user,
              isAuthenticated: true,
              currentPage: 'practice-days',
              practicesLogs: [],
              totalPoints: 0,
              streak: 0,
              level: 1,
              hasActiveSubscription: false,
              subscriptionExpiryDate: null,
              session: { user: registerResponse.authUser, access_token: null },
              // Load local preferences
              notificationsEnabled: localStorage.getItem('doosell_notifications') !== 'false',
              practiceFrequency: parseInt(localStorage.getItem('doosell_practice_frequency') || '0'),
              practiceDays: JSON.parse(localStorage.getItem('doosell_practice_days') || '[]'),
              practiceTime: localStorage.getItem('doosell_practice_time') || '20:00',
            }));
            
            toast.success('ثبت‌نام با موفقیت انجام شد!');
            navigate('practice-days');
          }
        }
        
        setShowOTP(false);
      } catch (error) {
        console.error('Authentication error:', error);
        
        if (error.message?.includes('User already exists')) {
          // User exists, try login instead
          setIsExistingUser(true);
          toast.info('شما قبلاً ثبت‌نام کرده‌اید. در حال ورود...');
          // Retry as login - but don't call recursively, just set the flag
          setIsLoading(false);
          return;
        } else if (error.message?.includes('Invalid login credentials') || error.message?.includes('not found')) {
          toast.error('کاربری با این شماره یافت نشد. لطفاً دوباره امتحان کنید');
        } else {
          toast.error(`خطا در ${isExistingUser ? 'ورود' : 'ثبت‌نام'}: ${error.message}`);
        }
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 p-6">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8 pt-12">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-orange-400 to-amber-400 rounded-2xl shadow-lg flex items-center justify-center mb-4 p-3">
            <img 
              src={doosellLogo} 
              alt="دوسل" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl mb-2">خوش آمدید!</h1>
          <p className="text-gray-600">برای شروع، اطلاعات خود را وارد کنید</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="firstName">نام</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
              placeholder="نام خود را وارد کنید"
              className="mt-1"
            />
            {errors.firstName && (
              <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
            )}
          </div>

          <div>
            <Label htmlFor="lastName">نام خانوادگی</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
              placeholder="نام خانوادگی خود را وارد کنید"
              className="mt-1"
            />
            {errors.lastName && (
              <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
            )}
          </div>

          <div>
            <Label htmlFor="phone">شماره موبایل</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              placeholder="09xxxxxxxxx"
              className="mt-1"
              dir="ltr"
            />
            {errors.phone && (
              <p className="text-red-500 text-sm mt-1">{errors.phone}</p>
            )}
          </div>

          <div>
            <Label htmlFor="instrument">ساز موردعلاقه</Label>
            <Select value={formData.instrument} onValueChange={(value) => setFormData(prev => ({ ...prev, instrument: value }))}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="ساز خود را انتخاب کنید" />
              </SelectTrigger>
              <SelectContent>
                {instruments.map((instrument) => (
                  <SelectItem key={instrument.value} value={instrument.value}>
                    {instrument.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.instrument && (
              <p className="text-red-500 text-sm mt-1">{errors.instrument}</p>
            )}
          </div>

          <div>
            <Label htmlFor="skillLevel">سطح مهارت</Label>
            <Select value={formData.skillLevel} onValueChange={(value) => setFormData(prev => ({ ...prev, skillLevel: value }))}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="سطح مهارت خود را انتخاب کنید" />
              </SelectTrigger>
              <SelectContent>
                {skillLevels.map((level) => (
                  <SelectItem key={level.value} value={level.value}>
                    {level.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.skillLevel && (
              <p className="text-red-500 text-sm mt-1">{errors.skillLevel}</p>
            )}
          </div>

          <Button type="submit" className="w-full bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl h-12">
            شروع
          </Button>
        </form>

        <Dialog open={showOTP} onOpenChange={setShowOTP}>
          <DialogContent className="mx-4">
            <DialogHeader>
              <DialogTitle>تأیید شماره موبایل</DialogTitle>
              <DialogDescription>
                کد ۴ رقمی ارسال شده به {formData.phone} را وارد کنید
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                placeholder="کد ۴ رقمی"
                maxLength={4}
                className="text-center text-2xl tracking-widest"
                dir="ltr"
              />
              <Button 
                onClick={handleOTPSubmit}
                disabled={otpCode.length !== 4 || isLoading}
                className="w-full bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl"
              >
                {isLoading ? 'در حال پردازش...' : 'تأیید'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default RegistrationScreen;