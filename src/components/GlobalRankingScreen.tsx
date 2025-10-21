import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useApp } from '../App';
import { ArrowRight, Trophy, Crown, Star, TrendingUp } from 'lucide-react';

interface GlobalPlayer {
  id: string;
  name: string;
  instrument: string;
  totalPoints: number;
  rank: number;
  isCurrentUser?: boolean;
}

const GlobalRankingScreen = () => {
  const { state, navigate } = useApp();

  // Mock global ranking data - complete list for positioning
  const allGlobalPlayers: GlobalPlayer[] = [
    { id: '1', name: 'سارا احمدی', instrument: 'پیانو', totalPoints: 2450, rank: 1 },
    { id: '2', name: 'محمد رضایی', instrument: 'ویولن', totalPoints: 2380, rank: 2 },
    { id: '3', name: 'مریم کریمی', instrument: 'سنتور', totalPoints: 2350, rank: 3 },
    { id: '4', name: 'علی محمدی', instrument: 'گیتار', totalPoints: 2320, rank: 4 },
    { id: '5', name: 'زهرا نوری', instrument: 'تار', totalPoints: 2290, rank: 5 },
    { id: '6', name: 'حسین یوسفی', instrument: 'کمانچه', totalPoints: 2260, rank: 6 },
    { id: '7', name: 'فاطمه حسینی', instrument: 'عود', totalPoints: 2230, rank: 7 },
    { id: '8', name: 'رضا ملکی', instrument: 'پیانو', totalPoints: 2200, rank: 8 },
    { id: '9', name: 'آریا جعفری', instrument: 'ویولن', totalPoints: 2170, rank: 9 },
    { id: '10', name: 'نگار صادقی', instrument: 'سنتور', totalPoints: 2140, rank: 10 },
    // Generate more players around current user
    { id: '154', name: 'پریسا مرادی', instrument: 'گیتار', totalPoints: state.totalPoints + 40, rank: 154 },
    { id: '155', name: 'امید کریمی', instrument: 'پیانو', totalPoints: state.totalPoints + 20, rank: 155 },
    { id: state.user?.id || '156', name: `${state.user?.firstName || 'کاربر'} ${state.user?.lastName || 'گرامی'}`, instrument: state.user?.instrument || 'پیانو', totalPoints: state.totalPoints, rank: 156, isCurrentUser: true },
    { id: '157', name: 'سمیرا حسینی', instrument: 'ویولن', totalPoints: Math.max(0, state.totalPoints - 20), rank: 157 },
    { id: '158', name: 'داود رضایی', instrument: 'سنتور', totalPoints: Math.max(0, state.totalPoints - 40), rank: 158 },
    // Bottom players
    { id: '2348', name: 'آرمان قاسمی', instrument: 'گیتار', totalPoints: 45, rank: 2348 },
    { id: '2349', name: 'لیلا حکیمی', instrument: 'پیانو', totalPoints: 30, rank: 2349 },
    { id: '2350', name: 'امیر توکلی', instrument: 'ویولن', totalPoints: 15, rank: 2350 },
  ];

  // Get current user and surrounding players
  const currentUserIndex = allGlobalPlayers.findIndex(player => player.isCurrentUser);
  const currentUser = allGlobalPlayers[currentUserIndex];
  
  // Get players around current user (2 above, current user, 2 below)
  const surroundingPlayers = allGlobalPlayers.slice(
    Math.max(0, currentUserIndex - 2), 
    Math.min(allGlobalPlayers.length, currentUserIndex + 3)
  );

  const totalUsers = 2350;
  const userRank = currentUser?.rank || 1;
  const userPercentile = Math.round(((totalUsers - userRank) / totalUsers) * 100);

  const topThree = allGlobalPlayers.slice(0, 3);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Trophy className="w-6 h-6 text-gray-500" />;
      case 3:
        return <Trophy className="w-6 h-6 text-amber-600" />;
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

  const getTopThreeBackground = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-br from-yellow-100 to-yellow-200 border-yellow-300';
      case 2:
        return 'bg-gradient-to-br from-gray-100 to-gray-200 border-gray-300';
      case 3:
        return 'bg-gradient-to-br from-amber-100 to-amber-200 border-amber-300';
      default:
        return 'bg-gray-50';
    }
  };

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
              <TrendingUp className="w-7 h-7" />
              رتبه‌بندی کلی کاربران
            </h1>
            <p className="text-white/90">جایگاه شما در میان همه موزیسین‌ها</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* User Status */}
        {currentUser ? (
          <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
            <CardContent className="p-4">
              <div className="text-center">
                <h4 className="text-amber-800 mb-3">موقعیت شما در رتبه‌بندی کلی</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-lg text-amber-700">{userRank}</div>
                    <div className="text-xs text-amber-600">رتبه کلی</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg text-amber-700">{currentUser.totalPoints}</div>
                    <div className="text-xs text-amber-600">امتیاز کل</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg text-amber-700">{userPercentile}%</div>
                    <div className="text-xs text-amber-600">بهتر از</div>
                  </div>
                </div>
                <p className="text-amber-700 text-sm mt-2">
                  شما بالاتر از {userPercentile}% کاربران هستید
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="text-center">
                <h4 className="text-blue-800 mb-2">ورود به رتبه‌بندی</h4>
                <p className="text-blue-700 text-sm">
                  با اولین تمرین خود وارد رتبه‌بندی کلی می‌شوید!
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top 3 Players */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-orange-500" />
              ۳ نفر برتر
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topThree.map((player) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 ${getTopThreeBackground(player.rank)}`}
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
                        <h4 className="text-base">{player.name}</h4>
                        <p className="text-sm text-gray-600">{player.instrument}</p>
                      </div>
                      <div className="text-left">
                        <div className="flex items-center gap-1">
                          <Star className="w-5 h-5 text-amber-500" />
                          <span className="text-lg">{player.totalPoints.toLocaleString('fa-IR')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Current User and Surrounding Players */}
        {currentUser && currentUser.rank > 3 && (
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">موقعیت شما</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {surroundingPlayers.map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                      player.isCurrentUser 
                        ? 'bg-gradient-to-r from-orange-100 to-amber-100 border-2 border-orange-300' 
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <Badge className={player.isCurrentUser ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-700'}>
                      {player.rank}
                    </Badge>
                    
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className={`text-sm ${player.isCurrentUser ? 'text-orange-800 font-medium' : 'text-gray-900'}`}>
                            {player.name} {player.isCurrentUser && '(شما)'}
                          </h4>
                          <p className="text-xs text-gray-600">{player.instrument}</p>
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-amber-500" />
                            <span className={`text-sm ${player.isCurrentUser ? 'text-orange-800' : 'text-gray-900'}`}>
                              {player.totalPoints.toLocaleString('fa-IR')}
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
        )}

        {/* Ranking Info */}
        <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
          <CardHeader>
            <CardTitle className="text-base">نکات رتبه‌بندی</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-start gap-2 text-sm text-blue-700">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>رتبه‌بندی بر اساس مجموع امتیاز کسب‌شده در تمام دوران محاسبه می‌شود</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-blue-700">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>جدول رتبه‌بندی پس از هر ثبت تمرین به‌روزرسانی می‌شود</span>
            </div>
            <div className="flex items-start gap-2 text-sm text-blue-700">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
              <span>فقط کاربران فعال (دارای حداقل یک تمرین) در جدول نمایش داده می‌شوند</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default GlobalRankingScreen;