import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useApp } from '../App';
import { ArrowRight, Trophy, Clock, Crown, Star, Users, Lock, ShoppingBag, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toPersianDigits } from './utils/persianUtils';

interface LeaguePlayer {
  userId: string;
  name: string;
  instrument: string;
  weeklyPoints: number;
  rank: number;
  isCurrentUser?: boolean;
}

interface UserStatus {
  rank: number | null;
  weeklyPoints: number;
  pointsToNext: number;
  nextPlayerRank: number | null;
}

interface LeagueData {
  ok: boolean;
  hasPracticedThisWeek: boolean;
  inLeague: boolean;
  weekStart: string;
  weekEnd: string;
  leaguePlayers: LeaguePlayer[];
  userStatus: UserStatus | null;
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
  const [leagueData, setLeagueData] = useState<LeagueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [leagueEndTime, setLeagueEndTime] = useState<Date | null>(null);

  // Fetch league data
  useEffect(() => {
    const fetchLeagueData = async () => {
      try {
        setLoading(true);
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (!sessionData?.session) {
          setLoading(false);
          return;
        }

        const response = await supabase.functions.invoke('get-weekly-league', {
          headers: {
            Authorization: `Bearer ${sessionData.session.access_token}`
          }
        });

        if (response.error) {
          console.error('Error fetching league:', response.error);
          setLoading(false);
          return;
        }

        const data: LeagueData = response.data;
        setLeagueData(data);

        // Calculate league end time (Friday 23:59)
        if (data.weekEnd) {
          const endDate = new Date(data.weekEnd);
          endDate.setHours(23, 59, 59, 999);
          setLeagueEndTime(endDate);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching league:', error);
        setLoading(false);
      }
    };

    fetchLeagueData();
  }, []);

  // Timer effect
  useEffect(() => {
    if (!leagueEndTime) return;

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
  }, [leagueEndTime]);

  const formatTime = (num: number) => {
    return toPersianDigits(num.toString().padStart(2, '0'));
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-600">در حال بارگذاری لیگ...</p>
        </div>
      </div>
    );
  }

  const leaguePlayers = leagueData?.leaguePlayers || [];
  const userStatus = leagueData?.userStatus;
  const hasPracticedThisWeek = leagueData?.hasPracticedThisWeek || false;
  const inLeague = leagueData?.inLeague || false;

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

      {/* Content with conditional blur */}
      <div className="relative">
        <div className={`p-6 space-y-6 ${!state.hasActiveSubscription ? 'blur-sm pointer-events-none' : ''}`}>
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
        {hasPracticedThisWeek && inLeague && userStatus && (
          <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
            <CardContent className="p-4">
              <div className="text-center">
                <h4 className="text-amber-800 mb-2">موقعیت شما در لیگ</h4>
                <div className="flex items-center justify-center gap-4 mb-2">
                  <div className="text-center">
                    <div className="text-lg text-amber-700">رتبه {toPersianDigits(userStatus.rank || 0)}</div>
                    <div className="text-xs text-amber-600">از {toPersianDigits(leaguePlayers.length)} نفر</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg text-amber-700">{toPersianDigits(userStatus.weeklyPoints)}</div>
                    <div className="text-xs text-amber-600">امتیاز هفتگی</div>
                  </div>
                </div>
                {userStatus.pointsToNext > 0 && userStatus.nextPlayerRank && (
                  <p className="text-amber-700 text-sm">
                    {toPersianDigits(userStatus.pointsToNext)} امتیاز تا رتبه {toPersianDigits(userStatus.nextPlayerRank)}
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
            {leaguePlayers.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>هنوز کاربری در این لیگ نیست</p>
                <p className="text-sm mt-1">اولین نفر باش!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {leaguePlayers.map((player) => (
                  <div
                    key={player.userId}
                    className={`flex items-center gap-3 p-3 rounded-xl ${
                      player.isCurrentUser 
                        ? 'bg-gradient-to-r from-orange-100 to-amber-100 border-2 border-orange-300' 
                        : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge className={getRankBadgeColor(player.rank)}>
                        {toPersianDigits(player.rank)}
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
                              {toPersianDigits(player.weeklyPoints)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              <span>امتیازهای لیگ همان امتیازات تمرین روزانه هستند</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-blue-700">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>جدول رده‌بندی با هر تمرین ثبت‌شده به‌صورت خودکار به‌روز می‌شود</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-blue-700">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>فقط کاربران فعال که این هفته تمرین کرده‌اند در جدول نمایش داده می‌شوند</span>
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
                  برای شرکت در لیگ هفتگی و رقابت با سایر کاربران، نیاز به اشتراک دارید.
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

export default WeeklyLeagueScreen;
