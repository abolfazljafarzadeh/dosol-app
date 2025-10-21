import React, { useState, useEffect } from 'react';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useApp } from '../App';
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
  const { state, navigate } = useApp();
  const [notificationOpen, setNotificationOpen] = useState(false);
  
  // Manage notifications state
  const [notificationStates, setNotificationStates] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('doosell_notification_read_states');
    return saved ? JSON.parse(saved) : {};
  });

  // Mock data calculations
  const currentLevel = Math.floor(state.totalPoints / 1000) + 1;
  const pointsInCurrentLevel = state.totalPoints % 1000;
  const pointsForNextLevel = 1000;
  const progressPercentage = (pointsInCurrentLevel / pointsForNextLevel) * 100;

  // Calculate today's practice minutes
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = state.practicesLogs.filter(log => log.date === today);
  const todayMinutes = todayLogs.reduce((sum, log) => sum + log.minutes, 0);

  // Mock weekly challenge data
  const weeklyGoal = 5; // 5 practice sessions per week
  const weeklyProgress = 3; // completed sessions
  const weeklyPercentage = (weeklyProgress / weeklyGoal) * 100;

  // Mock notifications data with subscription prompt for non-subscribers  
  const baseNotifications = [
    {
      id: '2',
      title: '⏰ یادآوری تمرین',
      message: 'وقت تمرین امروز شما فرا رسیده است',
      time: '۴ ساعت پیش',
      type: 'reminder',
      read: notificationStates['2'] || false
    },
    {
      id: '3',
      title: '🏆 رتبه‌بندی هفتگی',
      message: 'شما در لیگ هفتگی رتبه ۳ را کسب کردید',
      time: '۱ روز پیش',
      type: 'league',
      read: notificationStates['3'] || true
    },
    {
      id: '4',
      title: '🎁 جایزه ویژه',
      message: 'یک تخفیف ۲۰٪ برای خرید دوره جدید',
      time: '۲ روز پیش',
      type: 'promotion',
      read: notificationStates['4'] || true
    }
  ];

  // Add subscription notification for non-subscribers
  const notifications = state.hasActiveSubscription 
    ? [
        {
          id: '1',
          title: '🎉 دستاورد جدید!',
          message: 'شما نشان "تمرین ۷ روزه" را کسب کردید',
          time: '۲ ساعت پیش',
          type: 'achievement',
          read: notificationStates['1'] || false
        },
        ...baseNotifications
      ]
    : [
        {
          id: 'subscription',
          title: '🔔 اشتراک دوسل',
          message: 'برای استفاده از امکانات کامل اپلیکیشن، اشتراک تهیه کنید',
          time: 'الان',
          type: 'subscription',
          read: notificationStates['subscription'] || false
        },
        ...baseNotifications
      ];

  // Mark notification as read
  const markNotificationAsRead = (notificationId: string) => {
    const newStates = { ...notificationStates, [notificationId]: true };
    setNotificationStates(newStates);
    localStorage.setItem('doosell_notification_read_states', JSON.stringify(newStates));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'achievement':
        return <Trophy className="w-4 h-4 text-yellow-600" />;
      case 'reminder':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'league':
        return <Award className="w-4 h-4 text-purple-600" />;
      case 'promotion':
        return <Gift className="w-4 h-4 text-green-600" />;
      case 'subscription':
        return <Zap className="w-4 h-4 text-orange-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    // Mark notification as read when clicked
    markNotificationAsRead(notification.id);
    
    // Handle specific notification actions
    if (notification.type === 'subscription') {
      navigate('subscription');
      setNotificationOpen(false);
    }
  };

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
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 border-b hover:bg-gray-50 cursor-pointer ${
                        !notification.read ? 'bg-blue-50/50' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-start mb-1">
                            <h4 className="text-sm text-gray-800 truncate">
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 leading-relaxed mb-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400">
                            {notification.time}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-3 text-center border-t">
                  <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700">
                    مشاهده همه اعلان‌ها
                  </Button>
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
                {formatPersianNumber(1000 - pointsInCurrentLevel)} امتیاز تا سطح بعدی
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

        {/* Weekly Challenge - Only for subscribers */}
        {state.hasActiveSubscription ? (
          <Card className="rounded-2xl shadow-sm border-0 bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg text-blue-800">چالش هفتگی</h3>
                  <p className="text-sm text-blue-600">تمرین {toPersianDigits('5')} روز هفته</p>
                </div>
                <div className="text-left">
                  <p className="text-2xl text-blue-800">{toPersianDigits(weeklyProgress.toString())}/{toPersianDigits(weeklyGoal.toString())}</p>
                  <p className="text-xs text-blue-600">این هفته {toPersianDigits('5')} روز تمرین کنید</p>
                </div>
              </div>
              
              <Progress value={weeklyPercentage} className="h-3 mb-3" />
              
              <Button
                onClick={() => navigate('challenges')}
                variant="outline"
                className="w-full rounded-xl border-blue-300 text-blue-700 hover:bg-blue-50"
              >
                مشاهده همه چالش‌ها
              </Button>
            </CardContent>
          </Card>
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