import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useApp } from '../App';
import { ArrowRight, ArrowLeft, Clock, Calendar, TrendingUp, Sun } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import jalaali from 'jalaali-js';

// Persian solar calendar utilities
const persianMonths = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

const persianWeekDays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const persianWeekDaysFull = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];

// Get current date in Iran timezone
const getTehranDate = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')?.value || '0');
  const month = parseInt(parts.find(p => p.type === 'month')?.value || '0');
  const day = parseInt(parts.find(p => p.type === 'day')?.value || '0');
  
  // Return a date object with correct Tehran date
  return new Date(year, month - 1, day);
};

// Format date to YYYY-MM-DD without timezone conversion
const formatDateLocal = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Convert Gregorian to Persian date
const gregorianToPersian = (date: Date) => {
  const jDate = jalaali.toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return {
    year: jDate.jy,
    month: jDate.jm,
    day: jDate.jd
  };
};

// Convert Persian to Gregorian date
const persianToGregorian = (jy: number, jm: number, jd: number) => {
  const gDate = jalaali.toGregorian(jy, jm, jd);
  return new Date(gDate.gy, gDate.gm - 1, gDate.gd);
};

interface PracticeLog {
  id: string;
  minutes: number;
  local_date: string;
  created_at: string;
  note?: string;
}

const PracticeHistoryScreen = () => {
  const { state, navigate } = useApp();
  // Store Persian date instead of Gregorian
  const today = getTehranDate();
  const todayPersian = gregorianToPersian(today);
  const [currentPersianDate, setCurrentPersianDate] = useState({ 
    year: todayPersian.year, 
    month: todayPersian.month 
  });
  const [activeTab, setActiveTab] = useState('monthly');
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch practice logs from database
  useEffect(() => {
    const fetchPracticeLogs = async () => {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.error('No user found');
          return;
        }

        const { data, error } = await supabase
          .from('practice_logs')
          .select('id, minutes, local_date, created_at, note')
          .eq('user_id', user.id)
          .order('local_date', { ascending: false });

        if (error) {
          console.error('Error fetching practice logs:', error);
          return;
        }

        setPracticeLogs(data || []);
      } catch (err) {
        console.error('Exception fetching practice logs:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPracticeLogs();
  }, []);

  // Get today's weekday
  const todayWeekDay = persianWeekDaysFull[today.getDay() === 0 ? 6 : today.getDay() - 1];

  // Generate calendar days for current Persian month
  const generateCalendarDays = () => {
    const { year, month } = currentPersianDate;
    
    // Get number of days in Persian month (first 6 months have 31 days, next 5 have 30, last has 29/30)
    const daysInMonth = month <= 6 ? 31 : (month <= 11 ? 30 : (jalaali.isLeapJalaaliYear(year) ? 30 : 29));
    
    // Get the first day of the Persian month as Gregorian
    const firstDayGregorian = persianToGregorian(year, month, 1);
    // Convert to Persian week day (Saturday = 0, Sunday = 1, ..., Friday = 6)
    const gregorianDay = firstDayGregorian.getDay(); // 0=Sunday, 6=Saturday
    const startingDayOfWeek = (gregorianDay + 1) % 7; // Convert to Persian week (Saturday = 0)
    
    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    const todayDateString = formatDateLocal(today);
    
    // Add days of the Persian month
    for (let day = 1; day <= daysInMonth; day++) {
      // Convert Persian date to Gregorian to match with practice_logs
      const gregorianDate = persianToGregorian(year, month, day);
      const dateString = formatDateLocal(gregorianDate);
      const dayLogs = practiceLogs.filter(log => log.local_date === dateString);
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

  // Generate week days for current week (with Persian dates)
  const generateWeekDays = () => {
    const startOfWeek = new Date(today);
    // Calculate days since Saturday (Saturday = 0, Sunday = 1, ..., Friday = 6)
    const gregorianDay = today.getDay(); // 0=Sunday, 6=Saturday
    const daysSinceSaturday = (gregorianDay + 1) % 7;
    startOfWeek.setDate(today.getDate() - daysSinceSaturday + (currentWeekOffset * 7));
    
    const todayDateString = formatDateLocal(today);
    
    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dateString = formatDateLocal(date);
      const dayLogs = practiceLogs.filter(log => log.local_date === dateString);
      const totalMinutes = dayLogs.reduce((sum, log) => sum + log.minutes, 0);
      
      // Convert to Persian date for display
      const persianDate = gregorianToPersian(date);
      
      weekDays.push({
        date,
        persianDate,
        dateString,
        totalMinutes,
        hasLog: dayLogs.length > 0,
        logCount: dayLogs.length,
        isToday: dateString === todayDateString
      });
    }
    
    return weekDays;
  };

  const calendarDays = generateCalendarDays();
  const weekDays = generateWeekDays();

  // Navigation functions
  const goToPreviousMonth = () => {
    let { year, month } = currentPersianDate;
    month--;
    if (month < 1) {
      month = 12;
      year--;
    }
    setCurrentPersianDate({ year, month });
  };

  const goToNextMonth = () => {
    let { year, month } = currentPersianDate;
    month++;
    if (month > 12) {
      month = 1;
      year++;
    }
    setCurrentPersianDate({ year, month });
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

  // Statistics for current Persian month
  const monthStats = React.useMemo(() => {
    const { year, month } = currentPersianDate;
    const daysInMonth = month <= 6 ? 31 : (month <= 11 ? 30 : (jalaali.isLeapJalaaliYear(year) ? 30 : 29));
    
    // Get first and last day of Persian month as Gregorian dates
    const monthStartGregorian = persianToGregorian(year, month, 1);
    const monthEndGregorian = persianToGregorian(year, month, daysInMonth);
    
    const monthStart = formatDateLocal(monthStartGregorian);
    const monthEnd = formatDateLocal(monthEndGregorian);
    
    const monthLogs = practiceLogs.filter(log => 
      log.local_date >= monthStart && log.local_date <= monthEnd
    );
    
    const totalMinutes = monthLogs.reduce((sum, log) => sum + log.minutes, 0);
    const totalDays = new Set(monthLogs.map(log => log.local_date)).size;
    const totalSessions = monthLogs.length;
    
    return {
      totalMinutes,
      totalDays,
      totalSessions,
      averagePerDay: totalDays > 0 ? Math.round(totalMinutes / totalDays) : 0
    };
  }, [currentPersianDate, practiceLogs]);

  // Statistics for current week
  const weekStats = React.useMemo(() => {
    const weekStart = weekDays[0]?.dateString;
    const weekEnd = weekDays[6]?.dateString;
    
    if (!weekStart || !weekEnd) return { totalMinutes: 0, totalDays: 0, totalSessions: 0, averagePerDay: 0 };
    
    const weekLogs = practiceLogs.filter(log => 
      log.local_date >= weekStart && log.local_date <= weekEnd
    );
    
    const totalMinutes = weekLogs.reduce((sum, log) => sum + log.minutes, 0);
    const totalDays = new Set(weekLogs.map(log => log.local_date)).size;
    const totalSessions = weekLogs.length;
    
    return {
      totalMinutes,
      totalDays,
      totalSessions,
      averagePerDay: totalDays > 0 ? Math.round(totalMinutes / totalDays) : 0
    };
  }, [weekDays, practiceLogs]);

  const getDotStyle = (day: any) => {
    if (!day || !day.hasLog) return 'bg-gray-200';
    
    if (day.totalMinutes >= 60) return 'bg-green-500'; // Dark green for 60+ minutes
    if (day.totalMinutes >= 30) return 'bg-green-400'; // Medium green for 30+ minutes  
    if (day.totalMinutes >= 15) return 'bg-green-300'; // Light green for 15+ minutes
    return 'bg-green-200'; // Very light green for < 15 minutes
  };

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
                          {new Intl.NumberFormat('fa-IR').format(day.persianDate.day)}
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
                    {persianMonths[currentPersianDate.month - 1]} {new Intl.NumberFormat('fa-IR').format(currentPersianDate.year)}
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