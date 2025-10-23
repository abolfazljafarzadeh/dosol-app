import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useApp } from '../App';
import { Clock, ArrowLeft, Info, Sparkles } from 'lucide-react';
import { toPersianDigits, toEnglishDigits, formatPersianTime } from './utils/persianUtils';

const PracticeTimeScreen = () => {
  const { state, setState, navigate } = useApp();
  
  // Parse initial time
  const [hours, minutes] = (state.practiceTime || '20:00').split(':');
  const [selectedHour, setSelectedHour] = useState(hours || '20');
  const [selectedMinute, setSelectedMinute] = useState(minutes || '00');
  const [error, setError] = useState('');

  // Generate hour options (0-23) with Persian display
  const hourOptions = Array.from({ length: 24 }, (_, i) => ({
    value: i.toString().padStart(2, '0'),
    label: toPersianDigits(i.toString().padStart(2, '0'))
  }));
  
  // Generate minute options (0-59) with Persian display
  const minuteOptions = Array.from({ length: 60 }, (_, i) => ({
    value: i.toString().padStart(2, '0'),
    label: toPersianDigits(i.toString().padStart(2, '0'))
  }));

  const validateTime = (hour: string, minute: string) => {
    const hourNum = parseInt(hour);
    const minuteNum = parseInt(minute);
    
    if (isNaN(hourNum) || isNaN(minuteNum)) {
      return 'لطفاً اعداد معتبر وارد کنید';
    }
    
    if (hourNum < 0 || hourNum > 23) {
      return 'ساعت باید بین ۰ تا ۲۳ باشد';
    }
    
    if (minuteNum < 0 || minuteNum > 59) {
      return 'دقیقه باید بین ۰ تا ۵۹ باشد';
    }
    
    return '';
  };

  const handleHourChange = (value: string) => {
    setSelectedHour(value);
    setError(validateTime(value, selectedMinute));
  };

  const handleMinuteChange = (value: string) => {
    setSelectedMinute(value);
    setError(validateTime(selectedHour, value));
  };

  const formatTime = (hour: string, minute: string) => {
    return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  };

  const handleContinue = () => {
    const validationError = validateTime(selectedHour, selectedMinute);
    if (validationError) {
      setError(validationError);
      return;
    }

    const formattedTime = formatTime(selectedHour, selectedMinute);
    
    // Save to localStorage and state
    localStorage.setItem('doosell_practice_time', formattedTime);
    
    setState(prev => ({
      ...prev,
      practiceTime: formattedTime,
    }));

    navigate('dashboard');
  };

  const handleSkip = () => {
    // Skip to dashboard with default time
    localStorage.setItem('doosell_practice_time', '20:00');
    setState(prev => ({
      ...prev,
      practiceTime: '20:00',
    }));
    navigate('dashboard');
  };

  const currentTime = formatTime(selectedHour, selectedMinute);
  const isValidTime = !validateTime(selectedHour, selectedMinute);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 p-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-orange-400 to-amber-400 rounded-2xl shadow-lg flex items-center justify-center mb-4 relative">
            <Clock className="w-8 h-8 text-white" />
            <div className="absolute -top-1 -right-1">
              <Sparkles className="w-5 h-5 text-yellow-300" />
            </div>
          </div>
          <h1 className="text-2xl mb-2">ساعت یادآوری تمرین</h1>
          <p className="text-gray-600">چه ساعتی برایتان یادآوری ارسال شود؟</p>
        </div>

        {/* Time Input */}
        <Card className="rounded-2xl shadow-lg border-0 mb-6 bg-gradient-to-br from-white to-orange-50/30">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <Label className="text-lg">انتخاب ساعت</Label>
              <p className="text-sm text-gray-500 mt-1">ساعت را انتخاب کنید</p>
            </div>

            <div className="flex items-center justify-center gap-4 mb-4">
              {/* Minute Select - First */}
              <div className="text-center">
                <Label htmlFor="minute" className="text-sm text-gray-600 mb-2 block">دقیقه</Label>
                <Select value={selectedMinute} onValueChange={handleMinuteChange}>
                  <SelectTrigger className="w-20 h-16 text-center text-xl border-2 rounded-xl shadow-sm bg-gradient-to-br from-white to-gray-50 border-orange-200 focus:border-orange-400">
                    <SelectValue placeholder="۰۰">
                      {toPersianDigits(selectedMinute)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {minuteOptions.map((minute) => (
                      <SelectItem key={minute.value} value={minute.value} className="text-center justify-center">
                        {minute.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400 mt-1">{toPersianDigits('0-59')}</p>
              </div>

              {/* Separator */}
              <div className="text-3xl text-orange-400 mt-6 drop-shadow-sm">:</div>

              {/* Hour Select - Second */}
              <div className="text-center">
                <Label htmlFor="hour" className="text-sm text-gray-600 mb-2 block">ساعت</Label>
                <Select value={selectedHour} onValueChange={handleHourChange}>
                  <SelectTrigger className="w-20 h-16 text-center text-xl border-2 rounded-xl shadow-sm bg-gradient-to-br from-white to-gray-50 border-orange-200 focus:border-orange-400">
                    <SelectValue placeholder="۰۰">
                      {toPersianDigits(selectedHour)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {hourOptions.map((hour) => (
                      <SelectItem key={hour.value} value={hour.value} className="text-center justify-center">
                        {hour.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-400 mt-1">{toPersianDigits('0-23')}</p>
              </div>
            </div>

            {error && (
              <div className="text-center mb-4">
                <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
              </div>
            )}

            {/* Current Selection Display */}
            {isValidTime && (
              <div className="text-center">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-100 to-amber-100 px-6 py-3 rounded-2xl shadow-sm border border-orange-200">
                  <Clock className="w-4 h-4 text-orange-500" />
                  <span className="text-lg text-orange-700">
                    {formatPersianTime(currentTime)}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  ساعت انتخاب شده برای یادآوری
                </p>
              </div>
            )}
          </CardContent>
        </Card>



        {/* Buttons */}
        <div className="space-y-3 mb-6">
          <Button
            onClick={handleContinue}
            disabled={!isValidTime}
            className="w-full bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl h-12 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            ثبت
            <ArrowLeft className="w-4 h-4 mr-2" />
          </Button>
          
          <Button
            onClick={handleSkip}
            variant="outline"
            className="w-full rounded-xl h-12 border-gray-300 text-gray-600 hover:bg-gray-50"
          >
            رد کردن
          </Button>
        </div>

        {/* Info Card */}
        <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 mb-8">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700 leading-relaxed">
                <p className="mb-2">💡 <span className="font-medium">نکته:</span> می‌توانید در قسمت تنظیمات، ساعت یادآوری را تغییر دهید.</p>
                <p>یادآوری‌ها فقط در روزهایی که برای تمرین انتخاب کرده‌اید ارسال می‌شوند.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress indicator */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">مرحله {toPersianDigits('2')} از {toPersianDigits('2')}</p>
        </div>
      </div>
    </div>
  );
};

export default PracticeTimeScreen;