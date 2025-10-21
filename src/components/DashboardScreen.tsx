import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useApp } from '../App';
import { supabase } from '@/integrations/supabase/client';
import { getDashboard, getNotifications, markNotificationAsRead } from '@/services/backend';
import { getChallengesView } from '@/services/challengeService';
import type { ActiveChallenge } from '@/types/backend';
import {
  Flame, 
  Trophy, 
  Star, 
  Plus, 
  Clock,
  Calendar,
  Award,
  Settings,
  Bell,
  CheckCircle,
  Gift,
  Target,
  Lock,
  ShoppingBag,
  Zap
} from 'lucide-react';
import { formatPersianNumber, formatPersianTime, toPersianDigits } from './utils/persianUtils';

const DashboardScreen = () => {
  const { state, setState, navigate } = useApp();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [activeChallenges, setActiveChallenges] = useState<ActiveChallenge[]>([]);
  const [isLoadingChallenges, setIsLoadingChallenges] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  // Fetch dashboard data from backend (NO client calculations)
  useEffect(() => {
    const fetchDashboardData = async () => {
      // Only fetch if user is authenticated
      if (!state.session?.user?.id) {
        console.log('⏸️ Skipping dashboard fetch - user not authenticated');
        return;
      }

      try {
        // Call get-dashboard Edge Function
        const dashboard = await getDashboard();
        
        if (!dashboard.ok) {
          console.error('Dashboard fetch failed:', dashboard.error);
          // Continue to fetch challenges even if dashboard fails
        } else {
          // Update state from server response - NO CALCULATIONS
          setState(prev => ({
            ...prev,
            totalPoints: dashboard.xpTotal || 0,
            streak: dashboard.streak?.current || 0,
            xpToday: dashboard.today?.xpToday || 0,
            level: dashboard.level || Math.floor((dashboard.xpTotal || 0) / 500) + 1,
          }));

          // Fetch practice logs for display
          const { data: logs } = await supabase
            .from('practice_logs')
            .select('*')
            .eq('user_id', state.session.user.id)
            .order('practiced_on', { ascending: false });

          if (logs) {
            const formattedLogs = logs.map(log => ({
              id: log.id,
              date: log.practiced_on,
              minutes: log.minutes,
              notes: log.note || '',
              points: 0, // Points not used anymore, all from server
            }));
            
            setState(prev => ({
              ...prev,
              practicesLogs: formattedLogs
            }));
          }
        }

        // Always try to fetch challenges data (edge function will handle permission check)
        setIsLoadingChallenges(true);
        try {
          const challengesData = await getChallengesView();
          if (challengesData.ok && challengesData.active) {
            // انتخاب چالش فعال مثل صفحه چالش‌ها: اولین چالش periodic با نوع days_in_period
            const periodicChallenge = challengesData.active.find(
              ch => ch.kind === 'periodic' && ch.type === 'days_in_period'
            );
            setActiveChallenges(periodicChallenge ? [periodicChallenge] : []);
          }
        } catch (error) {
          console.error('Error fetching challenges:', error);
        } finally {
          setIsLoadingChallenges(false);
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      }
    };

    fetchDashboardData();
  }, [state.session?.user?.id]);

  // Fetch notifications
  useEffect(() => {
    const fetchNotificationsData = async () => {
      if (!state.session?.user?.id) return;

      setIsLoadingNotifications(true);
      try {
        const data = await getNotifications();
        setNotifications(data);
      } catch (error: any) {
        console.error('Failed to fetch notifications:', error);
      } finally {
        setIsLoadingNotifications(false);
      }
    };

    fetchNotificationsData();
  }, [state.session?.user?.id]);

  // All data from server - level included
  const currentLevel = state.level || 0;
  const pointsInCurrentLevel = state.totalPoints % 100;
  const pointsForNextLevel = 100;
  const progressPercentage = (pointsInCurrentLevel / pointsForNextLevel) * 100;

  // Today's data from practice_logs
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = state.practicesLogs.filter(log => {
    const logDate = log.date.includes('T') ? log.date.split('T')[0] : log.date;
    return logDate === today;
  });
  const todayMinutes = todayLogs.reduce((sum, log) => sum + log.minutes, 0);

  // Get active challenge data (from server)
  const activeChallenge = activeChallenges.length > 0 ? activeChallenges[0] : null;
  
  // Helper function to get challenge description based on type
  const getChallengeDescription = (challenge: ActiveChallenge | null) => {
    if (!challenge) return '';
    
    if (challenge.type === 'days_in_period') {
      return `این هفته ${toPersianDigits(challenge.targetDays.toString())} روز تمرین کنید`;
    } else if (challenge.type === 'streak') {
      return `${toPersianDigits(challenge.targetDays.toString())} روز پشت سر هم تمرین کنید`;
    }
    return 'به چالش بپیوندید';
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'practice_logged':
        return { icon: <Clock className="w-4 h-4 text-blue-600" />, bgColor: 'bg-blue-50' };
      case 'challenge_completed':
        return { icon: <Trophy className="w-4 h-4 text-yellow-600" />, bgColor: 'bg-yellow-50' };
      case 'league_start':
        return { icon: <Target className="w-4 h-4 text-purple-600" />, bgColor: 'bg-purple-50' };
      case 'league_end':
        return { icon: <Trophy className="w-4 h-4 text-green-600" />, bgColor: 'bg-green-50' };
      case 'practice_reminder':
        return { icon: <Bell className="w-4 h-4 text-blue-600" />, bgColor: 'bg-blue-50' };
      case 'challenge_start':
      case 'challenge_midweek':
      case 'challenge_end':
        return { icon: <Target className="w-4 h-4 text-purple-600" />, bgColor: 'bg-purple-50' };
      case 'subscription_expiring':
      case 'subscription_expired':
        return { icon: <Zap className="w-4 h-4 text-orange-600" />, bgColor: 'bg-orange-50' };
      case 'invite_reward':
        return { icon: <Gift className="w-4 h-4 text-yellow-600" />, bgColor: 'bg-yellow-50' };
      default:
        return { icon: <Bell className="w-4 h-4 text-gray-600" />, bgColor: 'bg-gray-50' };
    }
  };

  const getNotificationMessage = (notification: any) => {
    const { type, payload } = notification;
    
    switch (type) {
      case 'practice_logged':
        return `✅ تمرین ثبت شد | ${toPersianDigits(payload?.minutes?.toString() || '0')} دقیقه و ${toPersianDigits(payload?.xp_gained?.toString() || '0')} امتیاز`;
      case 'challenge_completed':
        return `🏅 ${payload?.message || 'چالش کامل شد'}`;
      case 'league_start':
        return '🎯 لیگ جدید شروع شد!';
      case 'league_end':
        return payload?.rank ? `🏆 لیگ به پایان رسید | رتبه ${toPersianDigits(payload.rank.toString())}` : '🏆 لیگ به پایان رسید';
      case 'practice_reminder':
        return '⏰ یادآوری تمرین امروز';
      case 'challenge_start':
        return `🚀 چالش جدید شروع شد | ${payload?.challenge_title || ''}`;
      case 'challenge_midweek':
        return `💪 نیمه چالش | ${payload?.challenge_title || ''}`;
      case 'challenge_end':
        return `🎁 چالش به پایان رسید | ${payload?.challenge_title || ''}`;
      case 'subscription_expiring':
        return `⚠️ اشتراک شما ${toPersianDigits(payload?.days_left?.toString() || '0')} روز دیگر منقضی می‌شود`;
      case 'subscription_expired':
        return '❌ اشتراک شما منقضی شد';
      case 'invite_reward':
        return '🎉 پاداش دعوت دریافت شد';
      default:
        return payload?.message || 'اعلان جدید';
    }
  };

  const formatNotificationTime = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMs = now.getTime() - created.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'همین الان';
    if (diffMins < 60) return `${toPersianDigits(diffMins.toString())} دقیقه پیش`;
    if (diffHours < 24) return `${toPersianDigits(diffHours.toString())} ساعت پیش`;
    if (diffDays < 7) return `${toPersianDigits(diffDays.toString())} روز پیش`;
    return 'بیش از یک هفته پیش';
  };

  const handleMarkAsRead = async (id: string) => {
    // Optimistic update
    setNotifications((prev) =>
      prev.map((notif) =>
        notif.id === id ? { ...notif, read_at: new Date().toISOString() } : notif
      )
    );
    
    // Update in database
    const success = await markNotificationAsRead(id);
    if (!success) {
      // Revert on failure
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === id ? { ...notif, read_at: null } : notif
        )
      );
    }
  };

  const handleNotificationClick = (notification: any) => {
    handleMarkAsRead(notification.id);
    
    const { type } = notification;
    if (type === 'challenge_completed' || type === 'challenge_start' || type === 'challenge_midweek' || type === 'challenge_end') {
      navigate('challenges');
    } else if (type === 'league_start' || type === 'league_end') {
      navigate('weekly-league');
    } else if (type === 'practice_logged' || type === 'practice_reminder') {
      navigate('practice-log');
    } else if (type === 'subscription_expiring' || type === 'subscription_expired') {
      navigate('subscription');
    }
    setNotificationOpen(false);
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;


  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 pb-20">
      <div className="p-4 space-y-6">
        {/* Header with Settings and Notifications */}
        <div className="flex justify-between items-center pt-8 pb-2">
          <div>
            <h1 className="text-2xl text-gray-800 mb-1">
              سلام {state.user?.firstName || 'کاربر عزیز'} 👋
            </h1>
            <p className="text-gray-600">
              بیا امروز هم با انگیزه تمرین کنیم!
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="w-10 h-10 rounded-xl bg-white shadow-sm hover:bg-gray-50"
              onClick={() => navigate('settings')}
            >
              <Settings className="w-5 h-5 text-gray-600" />
            </Button>
            
            <Popover open={notificationOpen} onOpenChange={setNotificationOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10 rounded-xl bg-white shadow-sm hover:bg-gray-50 relative"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  {unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <span className="text-xs text-white">{toPersianDigits(unreadCount.toString())}</span>
                    </div>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-0 ml-4" align="end">
                <div className="p-4 border-b">
                  <h3 className="text-lg">اعلان‌ها</h3>
                  <p className="text-sm text-gray-500">
                    {toPersianDigits(unreadCount.toString())} اعلان خوانده نشده
                  </p>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {isLoadingNotifications ? (
                    <div className="py-8 text-center text-gray-500 text-sm">
                      در حال بارگذاری...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="py-8 text-center text-gray-500 text-sm">
                      اعلانی وجود ندارد
                    </div>
                  ) : (
                    notifications.map((notification) => {
                      const { icon, bgColor } = getNotificationIcon(notification.type);
                      const message = getNotificationMessage(notification);
                      const time = formatNotificationTime(notification.created_at);
                      
                      return (
                        <div
                          key={notification.id}
                          className={`p-4 border-b hover:bg-gray-50 cursor-pointer ${
                            !notification.read_at ? 'bg-blue-50/50' : ''
                          }`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${bgColor}`}>
                              {icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-start mb-1">
                                <p className={`text-sm ${!notification.read_at ? 'font-medium text-gray-800' : 'text-gray-600'}`}>
                                  {message}
                                </p>
                                {!notification.read_at && (
                                  <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                                )}
                              </div>
                              <p className="text-xs text-gray-400">
                                {time}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Subscription Prompt for Non-Subscribers */}
        {!state.hasActiveSubscription && (
          <Card className="rounded-2xl shadow-lg border-2 border-orange-300 bg-gradient-to-br from-orange-100 to-amber-100">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-amber-400 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Lock className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg text-orange-800 mb-2">
                    🚀 امکانات کامل دوسل را تجربه کنید
                  </h3>
                  <p className="text-orange-700 text-sm mb-4 leading-relaxed">
                    برای دسترسی به چالش‌ها، دستاوردها، دستیار هوشمند و امکانات ویژه، اشتراک دوسل را تهیه کنید.
                  </p>
                  <Button
                    onClick={() => navigate('subscription')}
                    className="bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl h-10 px-6 shadow-lg"
                  >
                    <ShoppingBag className="w-4 h-4 ml-2" />
                    مشاهده اشتراک‌ها
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3">
          {/* Points Card */}
          <Card className={`rounded-2xl shadow-sm border-0 ${
            state.hasActiveSubscription 
              ? 'bg-gradient-to-br from-orange-100 to-orange-50' 
              : 'bg-gradient-to-br from-gray-100 to-gray-50 opacity-60'
          }`}>
            <CardContent className="p-4 text-center">
              <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-2 ${
                state.hasActiveSubscription
                  ? 'bg-gradient-to-br from-orange-400 to-orange-500'
                  : 'bg-gray-300'
              }`}>
                <Star className={`w-5 h-5 ${state.hasActiveSubscription ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <p className={`text-xs mb-1 ${
                state.hasActiveSubscription ? 'text-orange-600' : 'text-gray-500'
              }`}>مجموع امتیاز</p>
              <p className={`text-lg ${
                state.hasActiveSubscription ? 'text-orange-800' : 'text-gray-600'
              }`}>
                {state.hasActiveSubscription ? formatPersianNumber(state.totalPoints) : '--'}
              </p>
            </CardContent>
          </Card>

          {/* Streak Card */}
          <Card className={`rounded-2xl shadow-sm border-0 ${
            state.hasActiveSubscription 
              ? 'bg-gradient-to-br from-green-100 to-emerald-50' 
              : 'bg-gradient-to-br from-gray-100 to-gray-50 opacity-60'
          }`}>
            <CardContent className="p-4 text-center">
              <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-2 ${
                state.hasActiveSubscription
                  ? 'bg-gradient-to-br from-green-400 to-emerald-500'
                  : 'bg-gray-300'
              }`}>
                <Flame className={`w-5 h-5 ${state.hasActiveSubscription ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <p className={`text-xs mb-1 ${
                state.hasActiveSubscription ? 'text-green-600' : 'text-gray-500'
              }`}>استمرار</p>
              <p className={`text-lg ${
                state.hasActiveSubscription ? 'text-green-800' : 'text-gray-600'
              }`}>
                {state.hasActiveSubscription ? formatPersianNumber(state.streak) : '--'}
              </p>
            </CardContent>
          </Card>

          {/* Level Card */}
          <Card className={`rounded-2xl shadow-sm border-0 ${
            state.hasActiveSubscription 
              ? 'bg-gradient-to-br from-purple-100 to-violet-50' 
              : 'bg-gradient-to-br from-gray-100 to-gray-50 opacity-60'
          }`}>
            <CardContent className="p-4 text-center">
              <div className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center mb-2 ${
                state.hasActiveSubscription
                  ? 'bg-gradient-to-br from-purple-400 to-violet-500'
                  : 'bg-gray-300'
              }`}>
                <Trophy className={`w-5 h-5 ${state.hasActiveSubscription ? 'text-white' : 'text-gray-500'}`} />
              </div>
              <p className={`text-xs mb-1 ${
                state.hasActiveSubscription ? 'text-purple-600' : 'text-gray-500'
              }`}>سطح فعلی</p>
              <p className={`text-lg ${
                state.hasActiveSubscription ? 'text-purple-800' : 'text-gray-600'
              }`}>
                {state.hasActiveSubscription ? formatPersianNumber(currentLevel) : '--'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Section - Only for subscribers */}
        {state.hasActiveSubscription && (
          <Card className="rounded-2xl shadow-sm border-0">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg text-gray-800">پیشرفت تا سطح بعدی</h3>
              </div>
              
              <div className="flex justify-between items-center mb-3">
                <div className="text-sm text-gray-600">
                  سطح {formatPersianNumber(currentLevel)}
                </div>
                <div className="text-sm text-gray-600">
                  سطح {formatPersianNumber(currentLevel + 1)}
                </div>
              </div>
              
              <Progress value={progressPercentage} className="h-3 mb-3" />
              
              <p className="text-center text-sm text-gray-500">
                {formatPersianNumber(100 - pointsInCurrentLevel)} امتیاز تا سطح بعدی
              </p>
            </CardContent>
          </Card>
        )}

        {/* Practice Section */}
        <Card className="rounded-2xl shadow-sm border-0">
          <CardContent className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg text-gray-800">تمرین امروز</h3>
              <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                {formatPersianNumber(todayMinutes)} دقیقه
              </Badge>
            </div>
            
            <Button
              onClick={() => navigate('practice-log')}
              className="w-full bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl h-14 text-lg shadow-lg"
            >
              <Plus className="w-5 h-5 ml-2" />
              ثبت تمرین جدید
            </Button>
          </CardContent>
        </Card>

        {/* Active Challenge - Only for subscribers */}
        {state.hasActiveSubscription ? (
          activeChallenge ? (
            <Card className={`rounded-2xl shadow-sm border-0 ${
              activeChallenge.isCompleted 
                ? 'bg-gradient-to-br from-green-50 to-emerald-50' 
                : 'bg-gradient-to-br from-blue-50 to-indigo-50'
            }`}>
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className={`text-lg ${
                      activeChallenge.isCompleted ? 'text-green-800' : 'text-blue-800'
                    }`}>
                      {activeChallenge.title}
                    </h3>
                    <p className={`text-sm ${
                      activeChallenge.isCompleted ? 'text-green-600' : 'text-blue-600'
                    }`}>
                      {getChallengeDescription(activeChallenge)}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className={`text-2xl ${
                      activeChallenge.isCompleted ? 'text-green-800' : 'text-blue-800'
                    }`}>
                      {toPersianDigits(activeChallenge.daysDone.toString())}/{toPersianDigits(activeChallenge.targetDays.toString())}
                    </p>
                    {activeChallenge.isCompleted && (
                      <p className="text-xs text-green-600">✓ تکمیل شد</p>
                    )}
                  </div>
                </div>
                
                <Progress 
                  value={(activeChallenge.daysDone / activeChallenge.targetDays) * 100} 
                  className="h-3 mb-3" 
                />
                
                <Button
                  onClick={() => navigate('challenges')}
                  variant="outline"
                  className={`w-full rounded-xl ${
                    activeChallenge.isCompleted
                      ? 'border-green-300 text-green-700 hover:bg-green-50'
                      : 'border-blue-300 text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  مشاهده همه چالش‌ها
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="rounded-2xl shadow-sm border-0 bg-gradient-to-br from-gray-50 to-gray-100">
              <CardContent className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg text-gray-600">چالش فعال</h3>
                    <p className="text-sm text-gray-500">هیچ چالش فعالی وجود ندارد</p>
                  </div>
                </div>
                
                <div className="h-3 bg-gray-200 rounded-full mb-3"></div>
                
                <Button
                  onClick={() => navigate('challenges')}
                  variant="outline"
                  className="w-full rounded-xl border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  مشاهده چالش‌ها
                </Button>
              </CardContent>
            </Card>
          )
        ) : (
          <Card className="rounded-2xl shadow-sm border-0 bg-gradient-to-br from-gray-50 to-gray-100 opacity-70">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg text-gray-600 flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    چالش هفتگی
                  </h3>
                  <p className="text-sm text-gray-500">نیاز به اشتراک</p>
                </div>
              </div>
              
              <div className="h-3 bg-gray-200 rounded-full mb-3"></div>
              
              <Button
                onClick={() => navigate('subscription')}
                variant="outline"
                className="w-full rounded-xl border-gray-300 text-gray-600 hover:bg-gray-50"
              >
                <ShoppingBag className="w-4 h-4 ml-2" />
                تهیه اشتراک
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Bottom Grid - Only History and League */}
        <div className="grid grid-cols-2 gap-3">
          {/* Practice History */}
          <Card 
            className="rounded-2xl shadow-sm border-0 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('practice-history')}
          >
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 mx-auto bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center mb-3">
                <Calendar className="w-6 h-6 text-gray-600" />
              </div>
              <h4 className="text-sm text-gray-800 mb-1">تاریخچه تمرین</h4>
              <p className="text-xs text-gray-500">تمامی تمرینات پیشین</p>
            </CardContent>
          </Card>

          {/* Weekly League */}
          <Card 
            className="rounded-2xl shadow-sm border-0 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('weekly-league')}
          >
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 mx-auto bg-gradient-to-br from-yellow-100 to-amber-200 rounded-xl flex items-center justify-center mb-3">
                <Award className="w-6 h-6 text-amber-600" />
              </div>
              <h4 className="text-sm text-gray-800 mb-1">لیگ هفتگی</h4>
              <p className="text-xs text-gray-500">رتبه‌بندی این هفته</p>
            </CardContent>
          </Card>
        </div>

        {/* Bottom spacing for navigation */}
        <div className="h-4"></div>
      </div>
    </div>
  );
};

export default DashboardScreen;