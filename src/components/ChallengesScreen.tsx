import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useApp } from '../App';
import { Calendar, Star, Lock, Trophy, Crown, ShoppingBag } from 'lucide-react';
import { formatPersianNumber, toPersianDigits } from './utils/persianUtils';

const ChallengesScreen = () => {
  const { state, navigate } = useApp();

  // Mock weekly challenge data
  const weeklyChallenge = {
    title: 'در ۷ روز، ۵ روز تمرین کن',
    description: 'در این هفته ۵ روز تمرین کنید و مدال هفتگی دریافت کنید',
    progress: 3,
    target: 5,
    reward: {
      points: 50,
      medal: 'مدال چالش هفتگی'
    },
    weekDays: [
      { day: 'شنبه', status: 'done' },
      { day: 'یکشنبه', status: 'done' },
      { day: 'دوشنبه', status: 'done' },
      { day: 'سه‌شنبه', status: 'left' },
      { day: 'چهارشنبه', status: 'left' },
      { day: 'پنج‌شنبه', status: 'left' },
      { day: 'جمعه', status: 'left' },
    ],
    isCompleted: false
  };

  const upcomingChallenges = [
    {
      id: 1,
      title: 'استمرار ۱۰ روزه',
      description: '۱۰ روز متوالی تمرین کنید',
      reward: { points: 100, medal: 'مدال استمرار' },
      prerequisite: 'تکمیل چالش ۵ از ۷',
      isLocked: false
    },
    {
      id: 2,
      title: 'قهرمان ماه',
      description: 'در یک ماه ۲۰ روز تمرین کنید',
      reward: { points: 200, medal: 'مدال قهرمان ماه' },
      prerequisite: 'تکمیل چالش استمرار ۱۰ روزه',
      isLocked: true
    },
    {
      id: 3,
      title: 'پیشرفت سریع',
      description: 'در یک هفته ۱۰ ساعت تمرین کنید',
      reward: { points: 150, medal: 'مدال پیشرفت سریع' },
      prerequisite: 'تکمیل چالش ۵ از ۷',
      isLocked: false
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-500';
      case 'left':
        return 'bg-gray-200';
      case 'skipped':
        return 'bg-red-300';
      default:
        return 'bg-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'done':
        return '✓';
      case 'left':
        return '';
      case 'skipped':
        return '×';
      default:
        return '';
    }
  };

  // Check if user has practiced this week
  const hasPracticedThisWeek = state.practicesLogs.some(log => {
    const logDate = new Date(log.date);
    const today = new Date();
    const weekStart = new Date(today.setDate(today.getDate() - today.getDay() + 6)); // Saturday
    return logDate >= weekStart;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-l from-orange-400 to-amber-400 text-white p-6 rounded-b-3xl">
        <h1 className="text-2xl mb-2 flex items-center gap-2">
          <Trophy className="w-7 h-7" />
          چالش‌ها
        </h1>
        <p className="text-white/90">با تکمیل چالش‌ها امتیاز و مدال کسب کنید</p>
      </div>

      {/* Content with conditional blur */}
      <div className="relative">
        <div className={`p-6 space-y-6 ${!state.hasActiveSubscription ? 'blur-sm pointer-events-none' : ''}`}>
          {!hasPracticedThisWeek && (
            <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
              <CardContent className="p-4">
                <div className="text-center">
                  <h4 className="text-blue-800 mb-2">شروع چالش</h4>
                  <p className="text-blue-700 text-sm">
                    با اولین تمرین این هفته، وارد چالش می‌شی!
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Challenge */}
          <Card className="rounded-2xl shadow-lg border-2 border-orange-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-orange-500" />
                  چالش فعال
                </CardTitle>
                <Badge className="bg-orange-100 text-orange-700">این هفته</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-base mb-2">{weeklyChallenge.title}</h3>
                <p className="text-sm text-gray-600 mb-3">{weeklyChallenge.description}</p>
                
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">پیشرفت</span>
                  <span className="text-sm text-gray-900">
                    {toPersianDigits(weeklyChallenge.progress.toString())} از {toPersianDigits(weeklyChallenge.target.toString())} انجام شده
                  </span>
                </div>
                <Progress 
                  value={(weeklyChallenge.progress / weeklyChallenge.target) * 100} 
                  className="h-2 mb-4"
                />
              </div>

              {/* Weekly Calendar */}
              <div>
                <h4 className="text-sm text-gray-600 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  تقویم هفته
                </h4>
                <div className="grid grid-cols-7 gap-2">
                  {weeklyChallenge.weekDays.map((day, index) => (
                    <div key={index} className="text-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs mb-1 ${getStatusColor(day.status)}`}>
                        {getStatusIcon(day.status)}
                      </div>
                      <span className="text-xs text-gray-600">{day.day}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reward */}
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-3 border border-amber-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm text-amber-800 mb-1">پاداش</h4>
                    <div className="flex items-center gap-2 text-xs text-amber-700">
                      <Star className="w-3 h-3" />
                      <span>{toPersianDigits(weeklyChallenge.reward.points.toString())} امتیاز</span>
                      <span>+</span>
                      <span>{weeklyChallenge.reward.medal}</span>
                    </div>
                  </div>
                  <div className="text-2xl">
                    <Trophy className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Challenges */}
          <div>
            <h2 className="text-lg mb-4">چالش‌های آینده</h2>
            <div className="space-y-3">
              {upcomingChallenges.map((challenge) => (
                <Card key={challenge.id} className={`rounded-2xl shadow-sm ${challenge.isLocked ? 'opacity-60' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        challenge.isLocked ? 'bg-gray-200' : 'bg-gradient-to-br from-orange-400 to-amber-400'
                      }`}>
                        {challenge.isLocked ? (
                          <Lock className="w-5 h-5 text-gray-500" />
                        ) : (
                          <Trophy className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base mb-1">{challenge.title}</h3>
                        <p className="text-sm text-gray-600 mb-2">{challenge.description}</p>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-amber-700">
                            <Star className="w-3 h-3" />
                            <span>{toPersianDigits(challenge.reward.points.toString())} امتیاز</span>
                          </div>
                          {challenge.isLocked && (
                            <Badge variant="outline" className="text-xs">
                              پیش‌نیاز: {challenge.prerequisite}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Challenge Medals */}
          <div>
            <h2 className="text-lg mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              مدال‌های چالش
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <Card className="rounded-xl shadow-sm bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
                <CardContent className="p-3 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 bg-gradient-to-br from-amber-400 to-yellow-400">
                    <Trophy className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="text-xs mb-1">چالش‌گر</h4>
                  <p className="text-xs text-gray-600">تکمیل اولین چالش</p>
                </CardContent>
              </Card>

              <Card className="rounded-xl shadow-sm border-gray-200 bg-gray-50 opacity-60">
                <CardContent className="p-3 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 bg-gray-300">
                    <Lock className="w-4 h-4 text-gray-500" />
                  </div>
                  <h4 className="text-xs mb-1">پایدار</h4>
                  <p className="text-xs text-gray-600">{toPersianDigits('3')} چالش متوالی</p>
                </CardContent>
              </Card>

              <Card className="rounded-xl shadow-sm border-gray-200 bg-gray-50 opacity-60">
                <CardContent className="p-3 text-center">
                  <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 bg-gray-300">
                    <Lock className="w-4 h-4 text-gray-500" />
                  </div>
                  <h4 className="text-xs mb-1">قهرمان</h4>
                  <p className="text-xs text-gray-600">{toPersianDigits('8')} از {toPersianDigits('10')} هفته</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Challenge Tips */}
          <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
            <CardHeader>
              <CardTitle className="text-base">نکات چالش</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-start gap-2 text-sm text-blue-700">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <span>حتی {toPersianDigits('5')} دقیقه تمرین هم برای تکمیل یک روز کافی است</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-blue-700">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <span>چالش‌ها هر هفته به‌روزرسانی می‌شوند</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-blue-700">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <span>مدال‌های کسب‌شده همیشه متعلق به شما خواهند بود</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-blue-700">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <span>با ثبت تمرین روزانه، تمرینات چالش نیز هم ثبت خواهد شد</span>
              </div>
              <div className="flex items-start gap-2 text-sm text-blue-700">
                <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                <span>چالش‌ها به صورت فردی هستند و برای رقابت با دیگران باید در لیگ شرکت کنید</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overlay for non-subscribers */}
        {!state.hasActiveSubscription && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <Card className="rounded-2xl shadow-lg border-0 bg-gradient-to-br from-orange-50 to-amber-50 max-w-sm mx-4">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-orange-200 to-amber-200 rounded-2xl flex items-center justify-center mb-6">
                  <Lock className="w-10 h-10 text-orange-600" />
                </div>
                <h3 className="text-xl mb-4 text-gray-800">دسترسی محدود</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  برای دسترسی به چالش‌ها و کسب مدال‌های ویژه، نیاز به اشتراک دارید.
                </p>
                <Button
                  onClick={() => navigate('subscription')}
                  className="w-full bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl h-12 shadow-lg"
                >
                  <ShoppingBag className="w-5 h-5 ml-2" />
                  خرید اشتراک
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChallengesScreen;