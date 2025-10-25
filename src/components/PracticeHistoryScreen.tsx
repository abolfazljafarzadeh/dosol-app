import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useApp } from '../App';
import { ArrowRight, ArrowLeft, Clock, Calendar, TrendingUp, Sun } from 'lucide-react';

// Persian solar calendar utilities
const persianMonths = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

const persianWeekDays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const persianWeekDaysFull = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

// Convert Gregorian to Persian date
const gregorianToPersian = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  // Simple approximation for Persian calendar conversion
  // In a real app, you'd use a proper library like moment-jalaali
  let persianYear = year - 621;
  let persianMonth = month + 3;
  let persianDay = day;
  
  if (persianMonth > 12) {
    persianMonth -= 12;
    persianYear += 1;
  }
  
  // Adjust for Persian calendar specifics
  if (month >= 3 && month <= 5) { // Spring
    persianMonth = month - 2;
  } else if (month >= 6 && month <= 8) { // Summer
    persianMonth = month - 2;
  } else if (month >= 9 && month <= 11) { // Autumn
    persianMonth = month - 2;
  } else { // Winter
    persianMonth = month + 10;
    if (persianMonth > 12) {
      persianMonth -= 12;
      persianYear += 1;
    }
  }
  
  return {
    year: persianYear,
    month: persianMonth,
    day: persianDay
  };
};

const PracticeHistoryScreen = () => {
  const { state, navigate } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('monthly');
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);

  // Get today's Persian date
  const today = new Date();
  const todayPersian = gregorianToPersian(today);
  const todayWeekDay = persianWeekDaysFull[today.getDay() === 0 ? 6 : today.getDay() - 1];

  // Generate calendar days for current month
  const generateCalendarDays = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const dateString = new Date(year, month, day).toISOString().split('T')[0];
      const dayLogs = state.practicesLogs.filter(log => log.date === dateString);
      const totalMinutes = dayLogs.reduce((sum, log) => sum + log.minutes, 0);
      
      days.push({
        day,
        dateString,
        totalMinutes,
        hasLog: dayLogs.length > 0,
        logCount: dayLogs.length
      });
    }
    
    return days;
  };

  // Generate week days for current week
  const generateWeekDays = () => {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 6 + (currentWeekOffset * 7)); // Saturday start
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateString = date.toISOString().split('T')[0];
      const dayLogs = state.practicesLogs.filter(log => log.date === dateString);
      const totalMinutes = dayLogs.reduce((sum, log) => sum + log.minutes, 0);
      
      weekDays.push({
        date,
        dateString,
        totalMinutes,
        hasLog: dayLogs.length > 0,
        logCount: dayLogs.length,
        isToday: dateString === today.toISOString().split('T')[0]
      });
    }
    
    return weekDays;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = generateWeekDays();

  // Navigation functions
  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToPreviousWeek = () => {
    setCurrentWeekOffset(currentWeekOffset - 1);
  };

  const goToNextWeek = () => {
    setCurrentWeekOffset(currentWeekOffset + 1);
  };

  // Get week label
  const getWeekLabel = (offset: number) => {
    const weekNumbers = [
      'این هفته', 
      'هفته گذشته', 
      'دو هفته قبل', 
      'سه هفته قبل', 
      'چهار هفته قبل',
      'پنج هفته قبل',
      'شش هفته قبل',
      'هفت هفته قبل',
      'هشت هفته قبل',
      'نه هفته قبل',
      'ده هفته قبل',
      'یازده هفته قبل',
      'دوازده هفته قبل',
      'سیزده هفته قبل',
      'چهارده هفته قبل',
      'پانزده هفته قبل',
      'شانزده هفته قبل',
      'هفده هفته قبل',
      'هجده هفته قبل',
      'نوزده هفته قبل',
      'بیست هفته قبل'
    ];
    
    if (offset === 0) return weekNumbers[0];
    if (offset === -1) return weekNumbers[1];
    
    const absOffset = Math.abs(offset);
    if (absOffset <= 20) {
      return weekNumbers[absOffset];
    }
    
    return `${absOffset} هفته قبل`;
  };

  // Statistics for current month
  const monthStats = React.useMemo(() => {
    const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];
    
    const monthLogs = state.practicesLogs.filter(log => 
      log.date >= monthStart && log.date <= monthEnd
    );
    
    const totalMinutes = monthLogs.reduce((sum, log) => sum + log.minutes, 0);
    const totalDays = new Set(monthLogs.map(log => log.date)).size;
    const totalSessions = monthLogs.length;
    
    return {
      totalMinutes,
      totalDays,
      totalSessions,
      averagePerDay: totalDays > 0 ? Math.round(totalMinutes / totalDays) : 0
    };
  }, [currentDate, state.practicesLogs]);

  // Statistics for current week
  const weekStats = React.useMemo(() => {
    const weekStart = weekDays[0]?.dateString;
    const weekEnd = weekDays[6]?.dateString;
    
    if (!weekStart || !weekEnd) return { totalMinutes: 0, totalDays: 0, totalSessions: 0, averagePerDay: 0 };
    
    const weekLogs = state.practicesLogs.filter(log => 
      log.date >= weekStart && log.date <= weekEnd
    );
    
    const totalMinutes = weekLogs.reduce((sum, log) => sum + log.minutes, 0);
    const totalDays = new Set(weekLogs.map(log => log.date)).size;
    const totalSessions = weekLogs.length;
    
    return {
      totalMinutes,
      totalDays,
      totalSessions,
      averagePerDay: totalDays > 0 ? Math.round(totalMinutes / totalDays) : 0
    };
  }, [weekDays, state.practicesLogs]);

  const getDotStyle = (day: any) => {
    if (!day || !day.hasLog) return 'bg-gray-200';
    
    if (day.totalMinutes >= 60) return 'bg-green-500'; // Dark green for 60+ minutes
    if (day.totalMinutes >= 30) return 'bg-green-400'; // Medium green for 30+ minutes  
    if (day.totalMinutes >= 15) return 'bg-green-300'; // Light green for 15+ minutes
    return 'bg-green-200'; // Very light green for < 15 minutes
  };

  // Get current Persian month and year
  const currentPersian = gregorianToPersian(currentDate);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
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
          <div>
            <h1 className="text-2xl mb-1 flex items-center gap-2">
              <Calendar className="w-7 h-7" />
              تاریخچه تمرینات
            </h1>
            <p className="text-white/90">پیگیری پیشرفت و استمرار شما</p>
          </div>
        </div>
      </div>

      {/* Today's Date Creative Box */}
      <div className="px-6 -mt-3 mb-6">
        <Card className="rounded-2xl shadow-sm bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-3">
            <div className="flex items-center justify-center gap-3">
              <Sun className="w-5 h-5 text-amber-500" />
              <div className="text-center">
                <span className="text-blue-800 text-sm">امروز • </span>
                <span className="text-blue-700">
                  {todayWeekDay} {new Intl.NumberFormat('fa-IR').format(todayPersian.day)} {persianMonths[todayPersian.month - 1]}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="p-6 pt-0 space-y-6">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="weekly">آمار هفتگی</TabsTrigger>
            <TabsTrigger value="monthly">آمار ماهانه</TabsTrigger>
          </TabsList>

          {/* Weekly Tab */}
          <TabsContent value="weekly" className="space-y-6">
            {/* Week Navigation */}
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToNextWeek}
                    className="p-2 rounded-xl"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <h2 className="text-lg">
                    {getWeekLabel(currentWeekOffset)}
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToPreviousWeek}
                    className="p-2 rounded-xl"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Weekly Calendar */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-base text-center">تقویم هفتگی</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-2">
                  {weekDays.map((day, index) => (
                    <div key={index} className="text-center p-3">
                      <div className="text-xs text-gray-600 mb-2">
                        {persianWeekDays[index]}
                      </div>
                      <div className={`rounded-xl p-2 ${day.isToday ? 'bg-orange-100 border-2 border-orange-300' : 'bg-gray-50'}`}>
                        <div className="text-sm mb-2">
                          {new Intl.NumberFormat('fa-IR').format(day.date.getDate())}
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <div className={`w-4 h-4 rounded-full ${getDotStyle(day)}`}></div>
                          {day.logCount > 1 && (
                            <div className="w-4 h-4 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs">
                              {new Intl.NumberFormat('fa-IR').format(day.logCount)}
                            </div>
                          )}
                          {day.totalMinutes > 0 && (
                            <div className="text-xs text-gray-600">
                              {new Intl.NumberFormat('fa-IR').format(day.totalMinutes)}د
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Weekly Statistics */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  آمار هفته
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-orange-50 rounded-xl">
                    <div className="text-2xl text-orange-600 mb-1">
                      {new Intl.NumberFormat('fa-IR').format(weekStats.totalMinutes)}
                    </div>
                    <div className="text-sm text-gray-600">کل دقایق</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-xl">
                    <div className="text-2xl text-green-600 mb-1">
                      {new Intl.NumberFormat('fa-IR').format(weekStats.totalDays)}
                    </div>
                    <div className="text-sm text-gray-600">روز فعال</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <div className="text-2xl text-blue-600 mb-1">
                      {new Intl.NumberFormat('fa-IR').format(weekStats.totalSessions)}
                    </div>
                    <div className="text-sm text-gray-600">جلسه تمرین</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-xl">
                    <div className="text-2xl text-purple-600 mb-1">
                      {new Intl.NumberFormat('fa-IR').format(weekStats.averagePerDay)}
                    </div>
                    <div className="text-sm text-gray-600">متوسط روزانه</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monthly Tab */}
          <TabsContent value="monthly" className="space-y-6">
            {/* Month Navigation */}
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToNextMonth}
                    className="p-2 rounded-xl"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                  <h2 className="text-lg">
                    {persianMonths[currentPersian.month - 1]} {new Intl.NumberFormat('fa-IR').format(currentPersian.year)}
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToPreviousMonth}
                    className="p-2 rounded-xl"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Calendar */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-base text-center">تقویم ماهانه</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Week day headers */}
                <div className="grid grid-cols-7 gap-2 mb-4">
                  {persianWeekDays.map((day, index) => (
                    <div key={index} className="text-center text-sm text-gray-600 py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar days */}
                <div className="grid grid-cols-7 gap-2">
                  {calendarDays.map((day, index) => (
                    <div key={index} className="aspect-square flex items-center justify-center p-1">
                      {day ? (
                        <div className="relative w-full h-full flex flex-col items-center justify-center">
                          <span className="text-sm text-gray-700 mb-1">
                            {new Intl.NumberFormat('fa-IR').format(day.day)}
                          </span>
                          <div className={`w-3 h-3 rounded-full ${getDotStyle(day)}`}></div>
                          {day.logCount > 1 && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white rounded-full flex items-center justify-center text-xs">
                              {new Intl.NumberFormat('fa-IR').format(day.logCount)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full"></div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Legend */}
                <div className="mt-6 p-3 bg-gray-50 rounded-xl">
                  <h4 className="text-sm mb-3 text-center">راهنما:</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gray-200"></div>
                      <span className="text-gray-600">بدون تمرین</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-200"></div>
                      <span className="text-gray-600">کمتر از ۱۵ دقیقه</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-300"></div>
                      <span className="text-gray-600">۱۵-۳۰ دقیقه</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-400"></div>
                      <span className="text-gray-600">۳۰-۶۰ دقیقه</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-gray-600">بیش از ۶۰ دقیقه</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-orange-500 relative">
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-orange-600 rounded-full"></div>
                      </div>
                      <span className="text-gray-600">چند جلسه</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Monthly Statistics */}
            <Card className="rounded-2xl shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-orange-500" />
                  آمار ماه
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-orange-50 rounded-xl">
                    <div className="text-2xl text-orange-600 mb-1">
                      {new Intl.NumberFormat('fa-IR').format(monthStats.totalMinutes)}
                    </div>
                    <div className="text-sm text-gray-600">کل دقایق</div>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-xl">
                    <div className="text-2xl text-green-600 mb-1">
                      {new Intl.NumberFormat('fa-IR').format(monthStats.totalDays)}
                    </div>
                    <div className="text-sm text-gray-600">روز فعال</div>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-xl">
                    <div className="text-2xl text-blue-600 mb-1">
                      {new Intl.NumberFormat('fa-IR').format(monthStats.totalSessions)}
                    </div>
                    <div className="text-sm text-gray-600">جلسه تمرین</div>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-xl">
                    <div className="text-2xl text-purple-600 mb-1">
                      {new Intl.NumberFormat('fa-IR').format(monthStats.averagePerDay)}
                    </div>
                    <div className="text-sm text-gray-600">متوسط روزانه</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Motivation Card */}
        <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
          <CardContent className="p-4 text-center">
            <h4 className="text-blue-800 mb-2">نکته:</h4>
            <p className="text-blue-700 text-sm">
              {activeTab === 'weekly' 
                ? (weekStats.totalDays >= 5 
                    ? "عالی! این هفته استمرار فوق‌العاده‌ای داشتید"
                    : weekStats.totalDays >= 3
                    ? "خوب! سعی کنید تمرین‌های بیشتری در هفته داشته باشید"
                    : "تمرین منظم کلید موفقیت است، شما می‌تونید!")
                : (monthStats.totalDays >= 20 
                    ? "عالی! شما این ماه استمرار فوق‌العاده‌ای داشتید"
                    : monthStats.totalDays >= 15
                    ? "خوب! سعی کنید تمرین‌هایتان را منظم‌تر کنید"
                    : monthStats.totalDays >= 10
                    ? "شروع خوبی داشتید، ولی می‌تونید بیشتر تمرین کنید"
                    : "تمرین منظم کلید موفقیت است، شما می‌تونید!")
              }
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PracticeHistoryScreen;