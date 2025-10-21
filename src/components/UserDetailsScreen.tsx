import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ChevronRight } from 'lucide-react';
import { useApp } from '../App';
import { registerUser } from '../utils/api';
import { toast } from 'sonner';

const UserDetailsScreen = () => {
  const { state, setState, navigate } = useApp();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    instrument: '',
    skillLevel: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

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
    if (!formData.instrument) {
      newErrors.instrument = 'انتخاب ساز الزامی است';
    }
    if (!formData.skillLevel) {
      newErrors.skillLevel = 'انتخاب سطح مهارت الزامی است';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (!state.tempPhone) {
      toast.error('خطا در دریافت شماره تلفن');
      navigate('phone-input');
      return;
    }

    setIsLoading(true);

    try {
      // ثبت‌نام کاربر جدید - session به صورت خودکار توسط supabase مدیریت می‌شود
      const registerResponse = await registerUser({
        ...formData,
        phone: state.tempPhone,
      });

      // ذخیره در localStorage برای demo mode
      localStorage.setItem('doosell_demo_user', JSON.stringify(registerResponse.user));
      localStorage.setItem('doosell_demo_stats', JSON.stringify(registerResponse.stats));
      localStorage.setItem('doosell_demo_practice_logs', JSON.stringify([]));

      setState(prev => ({
        ...prev,
        user: registerResponse.user,
        isAuthenticated: true,
        practicesLogs: [],
        totalPoints: 0,
        streak: 0,
        level: 1,
        hasActiveSubscription: false,
        subscriptionExpiryDate: null,
        session: { user: registerResponse.authUser, access_token: 'demo-token' },
        tempPhone: undefined, // پاک کردن شماره موقت
      }));

      toast.success('ثبت‌نام با موفقیت انجام شد!');
      navigate('practice-days');
    } catch (error) {
      console.error('Registration error:', error);
      toast.error('خطا در ثبت‌نام. لطفاً دوباره تلاش کنید');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigate('otp-verification');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 p-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center mb-8 pt-12">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="p-2 hover:bg-white/50 rounded-full"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
          <div className="flex-1 text-center">
            <h1 className="text-xl text-gray-800">اطلاعات شخصی</h1>
            <p className="text-sm text-gray-600 mt-1">گام ۱ از ۳</p>
          </div>
          <div className="w-9 h-9"></div> {/* Spacer for center alignment */}
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
          <div className="bg-gradient-to-r from-orange-400 to-amber-400 h-2 rounded-full w-1/3"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="firstName" className="text-gray-700">نام</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
              placeholder="نام خود را وارد کنید"
              className="mt-2 h-12"
            />
            {errors.firstName && (
              <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>
            )}
          </div>

          <div>
            <Label htmlFor="lastName" className="text-gray-700">نام خانوادگی</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
              placeholder="نام خانوادگی خود را وارد کنید"
              className="mt-2 h-12"
            />
            {errors.lastName && (
              <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>
            )}
          </div>

          <div>
            <Label htmlFor="instrument" className="text-gray-700">ساز موردعلاقه</Label>
            <Select value={formData.instrument} onValueChange={(value) => setFormData(prev => ({ ...prev, instrument: value }))}>
              <SelectTrigger className="mt-2 h-12">
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
            <Label htmlFor="skillLevel" className="text-gray-700">سطح مهارت</Label>
            <Select value={formData.skillLevel} onValueChange={(value) => setFormData(prev => ({ ...prev, skillLevel: value }))}>
              <SelectTrigger className="mt-2 h-12">
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

          <Button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl h-12 text-lg shadow-lg mt-8"
          >
            {isLoading ? 'در حال ذخیره...' : 'ادامه'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default UserDetailsScreen;