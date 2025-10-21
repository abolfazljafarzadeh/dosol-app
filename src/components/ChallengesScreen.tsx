import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useApp } from '../App';
import { Calendar, Star, Lock, Trophy, Crown, ShoppingBag, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { formatPersianNumber, toPersianDigits } from './utils/persianUtils';
import { getChallengesView, claimChallengeReward } from '../services/challengeService';
import type { GetChallengesViewResponse } from '../types/backend';
import { toast } from 'sonner';
import { Alert, AlertDescription } from './ui/alert';

const ChallengesScreen = () => {
  const { state, navigate } = useApp();
  
  const [challengesData, setChallengesData] = useState<GetChallengesViewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const fetchChallenges = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getChallengesView();
      
      if (!data.ok) {
        throw new Error(data.error || 'خطا در دریافت چالش‌ها');
      }
      
      setChallengesData(data);
    } catch (err: any) {
      console.error('Error fetching challenges:', err);
      
      if (err.message?.includes('AUTH_REQUIRED') || err.message?.includes('Unauthorized')) {
        navigate('phone');
        return;
      }
      
      setError(err.message || 'خطا در دریافت اطلاعات چالش‌ها');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimReward = async (instanceId: string) => {
    try {
      setClaimingId(instanceId);
      const result = await claimChallengeReward(instanceId);
      
      if (!result.ok) {
        throw new Error(result.error || 'خطا در دریافت پاداش');
      }
      
      toast.success(`🎉 پاداش دریافت شد! ${toPersianDigits(result.xpAwarded?.toString() || '0')} امتیاز به شما اضافه شد${result.badgeGranted ? ' و مدال جدید کسب کردید!' : '!'}`);
      
      // Refresh challenges data
      await fetchChallenges();
    } catch (err: any) {
      console.error('Error claiming reward:', err);
      toast.error(`❌ ${err.message || 'خطا در دریافت پاداش'}`);
    } finally {
      setClaimingId(null);
    }
  };

  useEffect(() => {
    if (state.hasActiveSubscription) {
      fetchChallenges();
    }
  }, [state.hasActiveSubscription]);

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

  // Helper to convert "YYYY-MM-DD" string dates to Persian weekday names
  const getWeekDaysFromMarked = (daysMarked: string[], weekStart: string, weekEnd: string) => {
    const persianDays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
    const result = [];
    
    // Parse the weekStart date correctly to avoid timezone issues
    const [year, month, day] = weekStart.split('-').map(Number);
    
    // Debug logging
    console.log('🗓️ Week start:', weekStart);
    console.log('📅 Days marked:', daysMarked);
    
    for (let i = 0; i < 7; i++) {
      // Create date string in YYYY-MM-DD format without timezone conversion
      const currentDate = new Date(year, month - 1, day + i);
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
      
      // markedDates might be a JSON array, so check if it's actually an array
      const markedArray = Array.isArray(daysMarked) ? daysMarked : [];
      const isDone = markedArray.includes(dateStr);
      
      console.log(`Day ${i} (${persianDays[i]}): ${dateStr} - ${isDone ? 'DONE' : 'not done'}`);
      
      result.push({
        day: persianDays[i],
        status: isDone ? 'done' : 'left'
      });
    }
    
    console.log('✅ Final result:', result);
    return result;
  };

  const activeChallenge = challengesData?.active?.find(ch => ch.kind === 'periodic' && ch.type === 'days_in_period');
  const rollingChallenges = challengesData?.active?.filter(ch => ch.kind === 'rolling') || [];
  const claimableChallenges = challengesData?.claimable || [];
  const upcomingChallenges = challengesData?.upcoming || [];

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
          
          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <Alert className="bg-red-50 border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={fetchChallenges}
                  className="mt-2 w-full"
                >
                  تلاش مجدد
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Content */}
          {!isLoading && !error && challengesData && (
            <>
              {/* No Active Challenge Notice */}
              {!activeChallenge && (
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
              {activeChallenge && (
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
                      <h3 className="text-base mb-2">{activeChallenge.title}</h3>
                      <p className="text-sm text-gray-600 mb-3">
                        {activeChallenge.targetDays && `در این هفته ${toPersianDigits(activeChallenge.targetDays.toString())} روز تمرین کنید`}
                      </p>
                      
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-600">پیشرفت</span>
                        <span className="text-sm text-gray-900">
                          {toPersianDigits(activeChallenge.daysDone?.toString() || '0')} از {toPersianDigits(activeChallenge.targetDays?.toString() || '0')} انجام شده
                        </span>
                      </div>
                      <Progress 
                        value={((activeChallenge.daysDone || 0) / (activeChallenge.targetDays || 1)) * 100} 
                        className="h-2 mb-4"
                      />
                    </div>

                    {/* Weekly Calendar */}
                    {challengesData.currentWeek && (
                      <div>
                        <h4 className="text-sm text-gray-600 mb-3 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          تقویم هفته
                        </h4>
                        <div className="grid grid-cols-7 gap-2">
                          {getWeekDaysFromMarked(
                            activeChallenge.markedDates || [],
                            challengesData.currentWeek.start,
                            challengesData.currentWeek.end
                          ).map((day, index) => (
                            <div key={index} className="text-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs mb-1 ${getStatusColor(day.status)}`}>
                                {getStatusIcon(day.status)}
                              </div>
                              <span className="text-xs text-gray-600">{day.day}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reward - we'll show it even without specific reward data */}
                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-3 border border-amber-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm text-amber-800 mb-1">پاداش</h4>
                          <div className="flex items-center gap-2 text-xs text-amber-700">
                            <Star className="w-3 h-3" />
                            <span>امتیاز و مدال ویژه</span>
                          </div>
                        </div>
                        <div className="text-2xl">
                          <Trophy className="w-6 h-6 text-amber-600" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Claimable Challenges */}
              {claimableChallenges.length > 0 && (
                <div>
                  <h2 className="text-lg mb-4 flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    چالش‌های قابل دریافت
                  </h2>
                  <div className="space-y-3">
                    {claimableChallenges.map((challenge) => (
                      <Card key={challenge.instanceId} className="rounded-2xl shadow-sm bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gradient-to-br from-green-400 to-emerald-400">
                              <Trophy className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-base mb-1">{challenge.title}</h3>
                              <p className="text-sm text-green-700 mb-2">چالش تکمیل شد! ✓</p>
                              
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-xs text-green-700">
                                  <Star className="w-3 h-3" />
                                  <span>{toPersianDigits(challenge.reward?.xp?.toString() || '0')} امتیاز</span>
                                  {challenge.reward?.badge_code && (
                                    <>
                                      <span>+</span>
                                      <span>مدال</span>
                                    </>
                                  )}
                                </div>
                                <Button
                                  size="sm"
                                  onClick={() => handleClaimReward(challenge.instanceId)}
                                  disabled={claimingId === challenge.instanceId}
                                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                                >
                                  {claimingId === challenge.instanceId ? (
                                    <>
                                      <Loader2 className="w-3 h-3 ml-1 animate-spin" />
                                      در حال دریافت...
                                    </>
                                  ) : (
                                    'دریافت پاداش'
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming Challenges */}
              <div>
                <h2 className="text-lg mb-4">چالش‌های آینده</h2>
                {upcomingChallenges.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingChallenges.map((challenge, idx) => (
                      <Card key={idx} className="rounded-2xl shadow-sm opacity-60">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center bg-gray-200">
                              <Lock className="w-5 h-5 text-gray-500" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-base mb-1">{challenge.title}</h3>
                              {challenge.windowStart && challenge.windowEnd && (
                                <p className="text-sm text-gray-600 mb-2">
                                  از {toPersianDigits(challenge.windowStart)} تا {toPersianDigits(challenge.windowEnd)}
                                </p>
                              )}
                              
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs text-gray-600">
                                  <Star className="w-3 h-3" />
                                  <span>پاداش ویژه</span>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  به زودی
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200">
                    <CardContent className="p-4">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">
                          چالش‌های جدید به زودی اضافه می‌شوند
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}

          {/* Challenge Medals - Static for now */}
          {!isLoading && !error && (
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
          )}

          {/* Challenge Tips - Static */}
          {!isLoading && !error && (
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
