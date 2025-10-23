import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useApp } from '../App';
import { ArrowRight, Trophy, Clock, Crown, Star, Users } from 'lucide-react';

interface LeaguePlayer {
  id: string;
  name: string;
  instrument: string;
  weeklyPoints: number;
  rank: number;
  isCurrentUser?: boolean;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const WeeklyLeagueScreen = () => {
  const { state, navigate } = useApp();
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Mock league end time (Friday 23:59)
  const getNextFridayEndTime = () => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
    const daysToFriday = dayOfWeek === 5 ? 7 : (5 - dayOfWeek + 7) % 7; // Days until next Friday
    const nextFriday = new Date(now);
    nextFriday.setDate(now.getDate() + daysToFriday);
    nextFriday.setHours(23, 59, 59, 999);
    return nextFriday;
  };

  const leagueEndTime = getNextFridayEndTime();

  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const difference = leagueEndTime.getTime() - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeRemaining({ days, hours, minutes, seconds });
      } else {
        setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    calculateTimeRemaining();
    const timer = setInterval(calculateTimeRemaining, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (num: number) => {
    return new Intl.NumberFormat('fa-IR').format(num).padStart(2, '۰');
  };

  // Mock league data
  const leaguePlayers: LeaguePlayer[] = [
    { id: '1', name: 'احمد رضای��', instrument: 'پیانو', weeklyPoints: 420, rank: 1 },
    { id: '2', name: 'مریم احمدی', instrument: 'ویولن', weeklyPoints: 380, rank: 2 },
    { id: '3', name: 'علی محمدی', instrument: 'گیتار', weeklyPoints: 350, rank: 3 },
    { id: '4', name: 'زهرا کریمی', instrument: 'سنتور', weeklyPoints: 320, rank: 4 },
    { id: '5', name: 'حسین نوری', instrument: 'تار', weeklyPoints: 290, rank: 5 },
    { id: state.user?.id || '6', name: `${state.user?.firstName} ${state.user?.lastName}`, instrument: state.user?.instrument || 'پیانو', weeklyPoints: 180, rank: 6, isCurrentUser: true },
    { id: '7', name: 'فاطمه یوسفی', instrument: 'کمانچه', weeklyPoints: 160, rank: 7 },
    { id: '8', name: 'محمد حسینی', instrument: 'عود', weeklyPoints: 140, rank: 8 },
    { id: '9', name: 'ساره ملکی', instrument: 'پیانو', weeklyPoints: 120, rank: 9 },
    { id: '10', name: 'رضا جعفری', instrument: 'ویولن', weeklyPoints: 100, rank: 10 },
  ];

  const currentUserIndex = leaguePlayers.findIndex(player => player.isCurrentUser);
  const currentUser = leaguePlayers[currentUserIndex];
  const nextPlayer = currentUserIndex > 0 ? leaguePlayers[currentUserIndex - 1] : null;
  const pointsToNext = nextPlayer ? nextPlayer.weeklyPoints - currentUser.weeklyPoints : 0;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Trophy className="w-5 h-5 text-gray-500" />;
      case 3:
        return <Trophy className="w-5 h-5 text-amber-600" />;
      default:
        return null;
    }
  };

  const getRankBadgeColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-500 text-white';
      case 2:
        return 'bg-gray-400 text-white';
      case 3:
        return 'bg-amber-600 text-white';
      default:
        return 'bg-gray-200 text-gray-700';
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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50">
      {/* Header */}
      <div className="bg-gradient-to-l from-orange-400 to-amber-400 text-white p-6 rounded-b-3xl">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('achievements')}
            className="text-white hover:bg-white/20 p-2 rounded-xl"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl mb-1 flex items-center gap-2">
              <Trophy className="w-7 h-7" />
              لیگ هفتگی
            </h1>
            <p className="text-white/90">رقابت با سایر موزیسین‌ها</p>
          </div>
        </div>

        {/* Countdown Timer */}
        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
          <div className="text-center">
            <p className="text-sm mb-3 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              زمان باقی‌مانده تا پایان لیگ
            </p>
            <div className="grid grid-cols-4 gap-2 max-w-xs mx-auto" dir="ltr">
              <div className="bg-white/30 rounded-lg p-2">
                <div className="text-lg">{formatTime(timeRemaining.days)}</div>
                <div className="text-xs text-white/80">روز</div>
              </div>
              <div className="bg-white/30 rounded-lg p-2">
                <div className="text-lg">{formatTime(timeRemaining.hours)}</div>
                <div className="text-xs text-white/80">ساعت</div>
              </div>
              <div className="bg-white/30 rounded-lg p-2">
                <div className="text-lg">{formatTime(timeRemaining.minutes)}</div>
                <div className="text-xs text-white/80">دقیقه</div>
              </div>
              <div className="bg-white/30 rounded-lg p-2">
                <div className="text-lg">{formatTime(timeRemaining.seconds)}</div>
                <div className="text-xs text-white/80">ثانیه</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {!hasPracticedThisWeek && (
          <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="text-center">
                <h4 className="text-blue-800 mb-2 flex items-center justify-center gap-2">
                  <Users className="w-5 h-5" />
                  ورود به لیگ
                </h4>
                <p className="text-blue-700 text-sm">
                  با اولین تمرین این هفته وارد لیگ می‌شی!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Status */}
        {hasPracticedThisWeek && currentUser && (
          <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
            <CardContent className="p-4">
              <div className="text-center">
                <h4 className="text-amber-800 mb-2">موقعیت شما در لیگ</h4>
                <div className="flex items-center justify-center gap-4 mb-2">
                  <div className="text-center">
                    <div className="text-lg text-amber-700">رتبه {currentUser.rank}</div>
                    <div className="text-xs text-amber-600">از ۱۰ نفر</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg text-amber-700">{currentUser.weeklyPoints}</div>
                    <div className="text-xs text-amber-600">امتیاز هفتگی</div>
                  </div>
                </div>
                {nextPlayer && (
                  <p className="text-amber-700 text-sm">
                    {pointsToNext} امتیاز تا رتبه {nextPlayer.rank}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* League Table */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-orange-500" />
              جدول رده‌بندی
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {leaguePlayers.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-3 p-3 rounded-xl ${
                    player.isCurrentUser 
                      ? 'bg-gradient-to-r from-orange-100 to-amber-100 border-2 border-orange-300' 
                      : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Badge className={getRankBadgeColor(player.rank)}>
                      {player.rank}
                    </Badge>
                    {getRankIcon(player.rank)}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className={`text-sm ${player.isCurrentUser ? 'font-medium text-orange-800' : ''}`}>
                          {player.name}
                        </h4>
                        <p className="text-xs text-gray-600">{player.instrument}</p>
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-amber-500" />
                          <span className={`text-sm ${player.isCurrentUser ? 'font-medium text-orange-800' : ''}`}>
                            {player.weeklyPoints}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* League Info */}
        <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
          <CardHeader>
            <CardTitle className="text-base">نکات لیگ</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-blue-700">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>لیگ هر شنبه ساعت ۰۰:۰۰ شروع و جمعه ساعت ۲۳:۵۹ پایان می‌یابد</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-blue-700">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>نفرات اول تا سوم مدال‌های طلایی، نقره‌ای و برنزی دریافت می‌کنند</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-blue-700">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>برای شرکت در لیگ باید حداقل یک بار در هفته تمرین کنید</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-blue-700">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>جدول رده‌بندی با هر تمرین ثبت‌شده به‌روزرسانی می‌شود</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WeeklyLeagueScreen;