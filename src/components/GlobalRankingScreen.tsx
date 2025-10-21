import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useApp } from '../App';
import { ArrowRight, Trophy, Crown, Star, TrendingUp, Lock, ShoppingBag, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface GlobalPlayer {
  id: string;
  name: string;
  instrument: string;
  totalPoints: number;
  rank: number;
  isCurrentUser?: boolean;
}

interface RankingData {
  ok: boolean;
  userRank: number;
  userXp: number;
  totalUsers: number;
  topThree: GlobalPlayer[];
  surrounding: GlobalPlayer[];
}

const GlobalRankingScreen = () => {
  const { state, navigate } = useApp();
  const [rankingData, setRankingData] = useState<RankingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRanking = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get current session for authorization
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          throw new Error('لطفاً ابتدا وارد شوید');
        }

        const { data, error: fnError } = await supabase.functions.invoke('get-global-ranking', {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        });

        if (fnError) throw fnError;
        if (!data?.ok) throw new Error(data?.error || 'Failed to fetch ranking');

        setRankingData(data);
      } catch (err) {
        console.error('Error fetching global ranking:', err);
        setError(err instanceof Error ? err.message : 'خطا در دریافت رتبه‌بندی');
      } finally {
        setIsLoading(false);
      }
    };

    fetchRanking();
  }, [state.totalPoints]); // Refetch when XP changes

  // Calculate percentile
  const userPercentile = rankingData 
    ? Math.round(((rankingData.totalUsers - rankingData.userRank) / rankingData.totalUsers) * 100)
    : 0;

  const topThree = rankingData?.topThree || [];
  const surroundingPlayers = rankingData?.surrounding || [];
  const currentUser = surroundingPlayers.find(p => p.isCurrentUser);

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

      {/* Content with conditional blur */}
      <div className="relative">
        <div className={`p-6 space-y-6 ${!state.hasActiveSubscription ? 'blur-sm pointer-events-none' : ''}`}>
        
        {/* Loading State */}
        {isLoading && (
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-8 flex flex-col items-center justify-center">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin mb-4" />
              <p className="text-gray-600">در حال بارگذاری رتبه‌بندی...</p>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <Card className="rounded-2xl shadow-sm bg-red-50 border-red-200">
            <CardContent className="p-4">
              <div className="text-center">
                <p className="text-red-700">{error}</p>
                <Button
                  onClick={() => window.location.reload()}
                  className="mt-4 bg-red-600 hover:bg-red-700 text-white"
                >
                  تلاش مجدد
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* User Status */}
        {!isLoading && !error && rankingData && (
          <>
        {currentUser ? (
          <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200">
            <CardContent className="p-4">
              <div className="text-center">
                <h4 className="text-amber-800 mb-3">موقعیت شما در رتبه‌بندی کلی</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-lg text-amber-700">{rankingData.userRank.toLocaleString('fa-IR')}</div>
                    <div className="text-xs text-amber-600">رتبه کلی</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg text-amber-700">{rankingData.userXp.toLocaleString('fa-IR')}</div>
                    <div className="text-xs text-amber-600">امتیاز کل</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg text-amber-700">{userPercentile.toLocaleString('fa-IR')}%</div>
                    <div className="text-xs text-amber-600">بهتر از</div>
                  </div>
                </div>
                <p className="text-amber-700 text-sm mt-2">
                  {userPercentile > 0 
                    ? `شما بالاتر از ${userPercentile.toLocaleString('fa-IR')}% کاربران هستید` 
                    : 'با تمرین بیشتر رتبه خود را ارتقا دهید!'}
                </p>
                {rankingData.userRank > 1 && (
                  <p className="text-amber-600 text-xs mt-1">
                    💪 فقط {(rankingData.userRank - 1).toLocaleString('fa-IR')} پله تا رتبه اول!
                  </p>
                )}
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
        {surroundingPlayers.length > 0 && (
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
        </>
        )}
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
                  برای مشاهده رتبه‌بندی جهانی و موقعیت خود در بین تمام کاربران، نیاز به اشتراک دارید.
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

export default GlobalRankingScreen;