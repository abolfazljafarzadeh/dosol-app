import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { useApp } from '../App';
import { Calendar, ArrowLeft, Info, Check } from 'lucide-react';
import { toPersianDigits } from './utils/persianUtils';

const PracticeDaysScreen = () => {
  const { state, setState, navigate } = useApp();
  const [selectedDays, setSelectedDays] = useState<string[]>(state.practiceDays || []);

  const weekDays = [
    { value: 'saturday', label: 'شنبه', short: 'ش' },
    { value: 'sunday', label: 'یکشنبه', short: 'ی' },
    { value: 'monday', label: 'دوشنبه', short: 'د' },
    { value: 'tuesday', label: 'سه‌شنبه', short: 'س' },
    { value: 'wednesday', label: 'چهارشنبه', short: 'چ' },
    { value: 'thursday', label: 'پنج‌شنبه', short: 'پ' },
    { value: 'friday', label: 'جمعه', short: 'ج' },
  ];

  const toggleDay = (dayValue: string) => {
    setSelectedDays(prev => 
      prev.includes(dayValue) 
        ? prev.filter(d => d !== dayValue)
        : [...prev, dayValue]
    );
  };

  const handleContinue = () => {
    // Save to localStorage and state
    localStorage.setItem('doosell_practice_days', JSON.stringify(selectedDays));
    
    setState(prev => ({
      ...prev,
      practiceDays: selectedDays,
    }));

    navigate('practice-time');
  };

  const handleSkip = () => {
    // Skip to practice time with empty selection
    localStorage.setItem('doosell_practice_days', JSON.stringify([]));
    setState(prev => ({
      ...prev,
      practiceDays: [],
    }));
    navigate('practice-time');
  };

  const handleSelectAll = () => {
    const allDays = weekDays.map(day => day.value);
    setSelectedDays(allDays);
  };

  const handleClearAll = () => {
    setSelectedDays([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 p-6">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-8 pt-8">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-orange-400 to-amber-400 rounded-2xl shadow-lg flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl mb-2">برنامه تمرین شما</h1>
          <p className="text-gray-600">کدام روزهای هفته می‌خواهید تمرین کنید؟</p>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            className="flex-1 h-10 text-sm"
          >
            انتخاب همه
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            className="flex-1 h-10 text-sm"
          >
            پاک کردن
          </Button>
        </div>

        {/* Days Compact Grid */}
        <Card className="rounded-2xl shadow-sm mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap justify-center gap-2">
              {weekDays.map((day) => {
                const isSelected = selectedDays.includes(day.value);
                return (
                  <div
                    key={day.value}
                    className={`relative cursor-pointer transition-all duration-200 px-3 py-2 rounded-xl border-2 min-w-[70px] ${
                      isSelected 
                        ? 'border-orange-300 bg-gradient-to-r from-orange-100 to-amber-100 shadow-md scale-105' 
                        : 'border-gray-200 hover:border-orange-200 hover:bg-orange-50/50 hover:scale-105'
                    }`}
                    onClick={() => toggleDay(day.value)}
                  >
                    <div className="flex flex-col items-center text-center">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm mb-1 ${
                        isSelected 
                          ? 'bg-gradient-to-br from-orange-400 to-amber-400 text-white shadow-sm' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {day.short}
                      </div>
                      <span className={`text-xs leading-tight ${isSelected ? 'text-orange-800' : 'text-gray-700'}`}>
                        {day.label}
                      </span>
                    </div>
                    
                    {isSelected && (
                      <div className="absolute -top-1 -left-1">
                        <div className="w-5 h-5 bg-orange-500 rounded-full flex items-center justify-center shadow-sm">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected Days Summary */}
        {selectedDays.length > 0 && (
          <Card className="rounded-2xl shadow-sm mb-6">
            <CardContent className="p-4">
              <div className="text-center">
                <h3 className="text-sm text-gray-600 mb-3">روزهای انتخاب شده:</h3>
                <div className="flex flex-wrap justify-center gap-2 mb-3">
                  {selectedDays.map(dayValue => {
                    const day = weekDays.find(d => d.value === dayValue);
                    return (
                      <Badge 
                        key={dayValue} 
                        variant="secondary" 
                        className="bg-orange-100 text-orange-700 text-xs"
                      >
                        {day?.label}
                      </Badge>
                    );
                  })}
                </div>
                <p className="text-sm text-gray-500">
                  {toPersianDigits(selectedDays.length.toString())} روز در هفته انتخاب شده
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Buttons */}
        <div className="space-y-3 mb-6">
          <Button
            onClick={handleContinue}
            className="w-full bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl h-12 shadow-lg"
          >
            ادامه
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
                <p className="mb-2">💡 <span className="font-medium">نکته:</span> می‌توانید در قسمت تنظیمات، این برنامه را در هر زمان تغییر دهید.</p>
                <p>انتخاب روزهای تمرین به شما کمک می‌کند تا یادآوری‌های مناسب دریافت کنید.</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress indicator */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
            <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">مرحله {toPersianDigits('1')} از {toPersianDigits('2')}</p>
        </div>
      </div>
    </div>
  );
};

export default PracticeDaysScreen;