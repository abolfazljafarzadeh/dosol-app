import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { useApp } from '../App';
import { ArrowRight, User, Crown, Bell, LogOut, Edit, Calendar, Phone, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const SettingsScreen = () => {
  const { state, setState, navigate } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [editedUser, setEditedUser] = useState({
    firstName: state.user?.firstName || '',
    lastName: state.user?.lastName || '',
    skillLevel: state.user?.skillLevel || '',
  });
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Load user profile from database when component mounts
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!state.user?.id) return;
      
      console.log('🔄 Loading profile for user:', state.user.id);
      setIsLoadingProfile(true);
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', state.user.id)
          .single();

        if (error) {
          console.error('❌ Error loading profile:', error);
          return;
        }

        console.log('📋 Profile data from DB:', profile);

        if (profile) {
          const { data: xpCounter } = await supabase
            .from('xp_counters')
            .select('*')
            .eq('user_id', state.user.id)
            .single();

          console.log('📊 XP Counter data:', xpCounter);

          const updatedUser = {
            ...state.user,
            firstName: profile.first_name || '',
            lastName: profile.last_name || '',
            instrument: profile.instrument || '',
            skillLevel: profile.level || '',
          };

          console.log('👤 Updated user object:', updatedUser);

          const updatedStats = {
            totalPoints: xpCounter?.total_xp || 0,
            streak: xpCounter?.streak || 0,
            level: Math.floor((xpCounter?.total_xp || 0) / 100) + 1,
            hasActiveSubscription: profile.is_premium || false,
            subscriptionExpiryDate: profile.subscription_expires_at || null,
            notificationsEnabled: profile.notifications_enabled !== false, // Default to true
          };

          // Update state
          setState(prev => ({
            ...prev,
            user: updatedUser,
            totalPoints: updatedStats.totalPoints,
            streak: updatedStats.streak,
            level: updatedStats.level,
            hasActiveSubscription: updatedStats.hasActiveSubscription,
            subscriptionExpiryDate: updatedStats.subscriptionExpiryDate,
            notificationsEnabled: updatedStats.notificationsEnabled,
          }));

          // Update localStorage
          localStorage.setItem('doosell_demo_user', JSON.stringify(updatedUser));
          localStorage.setItem('doosell_demo_stats', JSON.stringify(updatedStats));

          // Update editedUser state
          setEditedUser({
            firstName: updatedUser.firstName,
            lastName: updatedUser.lastName,
            skillLevel: updatedUser.skillLevel,
          });

          console.log('✅ Profile loaded and state updated');
        }
      } catch (error) {
        console.error('❌ Error loading user profile:', error);
      } finally {
        setIsLoadingProfile(false);
      }
    };

    loadUserProfile();
  }, [state.user?.id]);

  const skillLevels = [
    { value: 'beginner', label: 'تازه‌کار' },
    { value: 'intermediate', label: 'متوسط' },
    { value: 'advanced', label: 'پیشرفته' },
    { value: 'professional', label: 'حرفه‌ای' },
  ];

  const instruments = [
    { value: 'piano', label: 'پیانو' },
    { value: 'violin', label: 'ویولن' },
    { value: 'santur', label: 'سنتور' },
    { value: 'guitar', label: 'گیتار' },
    { value: 'tar', label: 'تار' },
    { value: 'setar', label: 'سه‌تار' },
    { value: 'oud', label: 'عود' },
    { value: 'kamanche', label: 'کمانچه' },
  ];

  const getInstrumentLabel = (value: string) => {
    return instruments.find(i => i.value === value)?.label || value;
  };

  const getSkillLevelLabel = (value: string) => {
    return skillLevels.find(s => s.value === value)?.label || value;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysUntilExpiry = () => {
    if (!state.subscriptionExpiryDate) return 0;
    const expiryDate = new Date(state.subscriptionExpiryDate);
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const handleSaveProfile = async () => {
    if (!editedUser.firstName.trim() || !editedUser.lastName.trim()) {
      toast.error('نام و نام خانوادگی الزامی است');
      return;
    }

    if (!state.user?.id) {
      toast.error('خطا در دریافت اطلاعات کاربر');
      return;
    }

    setIsLoadingProfile(true);

    try {
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error('لطفاً مجدداً وارد شوید');
        return;
      }

      console.log('💾 Saving profile to database...');

      // Update profile in database using register-user edge function
      const { data, error } = await supabase.functions.invoke('register-user', {
        body: { 
          first_name: editedUser.firstName.trim(),
          last_name: editedUser.lastName.trim(),
          instrument: state.user.instrument,
          level: editedUser.skillLevel,
          tz: 'Asia/Tehran',
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        }
      });

      if (error) {
        console.error('❌ Profile update error:', error);
        toast.error('خطا در ذخیره اطلاعات');
        return;
      }

      console.log('✅ Profile saved to database');

      const updatedUser = {
        ...state.user,
        firstName: editedUser.firstName.trim(),
        lastName: editedUser.lastName.trim(),
        skillLevel: editedUser.skillLevel,
      };

      // Update localStorage
      localStorage.setItem('doosell_demo_user', JSON.stringify(updatedUser));
      localStorage.setItem('doosell_demo_stats', JSON.stringify({
        totalPoints: state.totalPoints,
        streak: state.streak,
        level: state.level,
        hasActiveSubscription: state.hasActiveSubscription,
        subscriptionExpiryDate: state.subscriptionExpiryDate,
      }));

      // Update state
      setState(prev => ({
        ...prev,
        user: updatedUser,
      }));

      setIsEditing(false);
      toast.success('اطلاعات شما با موفقیت به‌روزرسانی شد');
    } catch (error) {
      console.error('❌ Error saving profile:', error);
      toast.error('خطا در ذخیره اطلاعات');
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedUser({
      firstName: state.user?.firstName || '',
      lastName: state.user?.lastName || '',
      skillLevel: state.user?.skillLevel || '',
    });
    setIsEditing(false);
  };

  const handleNotificationToggle = async (enabled: boolean) => {
    if (!state.user?.id) {
      toast.error('خطا در دریافت اطلاعات کاربر');
      return;
    }

    try {
      // Update in database
      const { error } = await supabase
        .from('profiles')
        .update({ notifications_enabled: enabled })
        .eq('id', state.user.id);

      if (error) {
        console.error('❌ Error updating notification settings:', error);
        toast.error('خطا در ذخیره تنظیمات');
        return;
      }

      // Update local storage and state
      localStorage.setItem('doosell_notifications', enabled.toString());
      setState(prev => ({
        ...prev,
        notificationsEnabled: enabled,
      }));
      
      toast.success(enabled ? 'اعلان‌ها فعال شد' : 'اعلان‌ها غیرفعال شد');
    } catch (error) {
      console.error('❌ Error updating notification settings:', error);
      toast.error('خطا در ذخیره تنظیمات');
    }
  };

  const handleLogout = async () => {
    // Sign out from Supabase
    await supabase.auth.signOut();
    
    // Clear all localStorage data
    localStorage.removeItem('doosell_demo_user');
    localStorage.removeItem('doosell_demo_stats');
    localStorage.removeItem('doosell_demo_practice_logs');
    localStorage.removeItem('doosell_user');
    localStorage.removeItem('doosell_points');
    localStorage.removeItem('doosell_streak');
    localStorage.removeItem('doosell_level');
    localStorage.removeItem('doosell_subscription');
    localStorage.removeItem('doosell_notifications');
    localStorage.removeItem('doosell_practice_frequency');
    localStorage.removeItem('doosell_practice_days');
    localStorage.removeItem('doosell_practice_time');

    // Reset state and navigate to splash
    setState({
      user: null,
      isAuthenticated: false,
      currentPage: 'splash',
      practicesLogs: [],
      totalPoints: 0,
      streak: 0,
      level: 1,
      hasActiveSubscription: false,
      subscriptionExpiryDate: null,
      notificationsEnabled: true,
      practiceFrequency: 0,
      practiceDays: [],
      practiceTime: '20:00',
      session: null,
      tempPhone: undefined,
    });

    setShowLogoutConfirm(false);
    toast.success('با موفقیت از حساب خارج شدید');
  };

  const daysUntilExpiry = getDaysUntilExpiry();

  const weekDays = [
    { value: 'saturday', label: 'شنبه' },
    { value: 'sunday', label: 'یکشنبه' },
    { value: 'monday', label: 'دوشنبه' },
    { value: 'tuesday', label: 'سه‌شنبه' },
    { value: 'wednesday', label: 'چهارشنبه' },
    { value: 'thursday', label: 'پنج‌شنبه' },
    { value: 'friday', label: 'جمعه' },
  ];

  const getPracticeDaysLabel = () => {
    if (state.practiceDays.length === 0) return 'انتخاب نشده';
    if (state.practiceDays.length === 7) return 'همه روزهای هفته';
    return state.practiceDays.map(dayValue => 
      weekDays.find(d => d.value === dayValue)?.label
    ).join('، ');
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
              <User className="w-7 h-7" />
              پروفایل و تنظیمات
            </h1>
            <p className="text-white/90">مدیریت حساب کاربری</p>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Profile Section */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-orange-500" />
                مشخصات کاربر
              </CardTitle>
              {!isEditing && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  ویرایش
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">نام</Label>
                    <Input
                      id="firstName"
                      value={editedUser.firstName}
                      onChange={(e) => setEditedUser(prev => ({ ...prev, firstName: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">نام خانوادگی</Label>
                    <Input
                      id="lastName"
                      value={editedUser.lastName}
                      onChange={(e) => setEditedUser(prev => ({ ...prev, lastName: e.target.value }))}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="skillLevel">سطح مهارت</Label>
                  <Select 
                    value={editedUser.skillLevel} 
                    onValueChange={(value) => setEditedUser(prev => ({ ...prev, skillLevel: value }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="سطح مهارت خود را انتخاب کنید" />
                    </SelectTrigger>
                    <SelectContent>
                      {skillLevels.map((level) => (
                        <SelectItem key={level.value} value={level.value}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handleSaveProfile}
                    className="flex-1 bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white"
                  >
                    ذخیره تغییرات
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancelEdit}
                    className="flex-1"
                  >
                    انصراف
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-600">نام</Label>
                    <p className="text-base mt-1">{state.user?.firstName}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">نام خانوادگی</Label>
                    <p className="text-base mt-1">{state.user?.lastName}</p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm text-gray-600 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    شماره موبایل
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-base" dir="ltr">{state.user?.phone}</p>
                    <Badge variant="secondary" className="text-xs">غیرقابل ویرایش</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-600">ساز</Label>
                    <p className="text-base mt-1">{getInstrumentLabel(state.user?.instrument || '')}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-600">سطح مهارت</Label>
                    <p className="text-base mt-1">{getSkillLevelLabel(state.user?.skillLevel || '')}</p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Subscription Section */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="w-5 h-5 text-orange-500" />
              وضعیت اشتراک
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">وضعیت فعلی</span>
              <Badge 
                variant={state.hasActiveSubscription ? "default" : "destructive"}
                className={state.hasActiveSubscription ? "bg-green-500" : ""}
              >
                {state.hasActiveSubscription ? 'فعال' : 'غیرفعال'}
              </Badge>
            </div>

            {state.hasActiveSubscription ? (
              <>
                {state.subscriptionExpiryDate && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        تاریخ انقضا
                      </span>
                      <span className="text-sm">{formatDate(state.subscriptionExpiryDate)}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">روزهای باقی‌مانده</span>
                      <Badge 
                        variant={daysUntilExpiry > 7 ? "secondary" : "destructive"}
                        className={daysUntilExpiry > 7 ? "bg-blue-100 text-blue-700" : ""}
                      >
                        {daysUntilExpiry} روز
                      </Badge>
                    </div>
                  </>
                )}
              </>
            ) : null}

            <Button
              onClick={() => navigate('subscription')}
              className="w-full bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl"
            >
              {state.hasActiveSubscription ? 'تمدید اشتراک' : 'خرید اشتراک'}
            </Button>
          </CardContent>
        </Card>

        {/* Practice Reminder Section */}
        <Card className="rounded-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-500" />
              یادآوری تمرین
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Notification Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
              <div>
                <p className="text-sm">دریافت اعلان‌ها</p>
                <p className="text-xs text-gray-600 mt-1">
                  یادآوری تمرین و اطلاع‌رسانی‌های مهم
                </p>
              </div>
              <Switch
                checked={state.notificationsEnabled}
                onCheckedChange={handleNotificationToggle}
              />
            </div>

            {state.notificationsEnabled && (
              <>
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm text-gray-600">روزهای تمرین</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('practice-days')}
                        className="text-xs h-8"
                      >
                        تغییر
                      </Button>
                    </div>
                    <p className="text-sm text-gray-800">
                      {getPracticeDaysLabel()}
                    </p>
                    {state.practiceDays.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {state.practiceDays.length} روز در هفته
                      </p>
                    )}
                  </div>

                  <div className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm text-gray-600 flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        ساعت یادآوری
                      </Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('practice-time')}
                        className="text-xs h-8"
                      >
                        تغییر
                      </Button>
                    </div>
                    <p className="text-sm text-gray-800" dir="ltr">
                      {state.practiceTime}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      یادآوری در این ساعت ارسال می‌شود
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 text-center">
                  <p className="text-xs text-gray-500">
                    💡 یادآوری‌ها فقط در روزهای انتخاب شده ارسال می‌شوند
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-4">
            <div className="text-center text-sm text-gray-600">
              <p>عضو دوسل از: {formatDate(state.user?.registeredAt || '')}</p>
              <p className="mt-1">شناسه کاربری: {state.user?.id}</p>
            </div>
          </CardContent>
        </Card>

        {/* Logout Section */}
        <Card className="rounded-2xl shadow-sm border-red-200">
          <CardContent className="p-4">
            <Button
              onClick={() => setShowLogoutConfirm(true)}
              variant="destructive"
              className="w-full flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              خروج از حساب
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="mx-4">
          <DialogHeader>
            <DialogTitle>خروج از حساب</DialogTitle>
            <DialogDescription>
              آیا مطمئن هستید که می‌خواهید از حساب کاربری خود خارج شوید؟
              <br />
              باید مجدداً وارد شوید تا بتوانید از برنامه استفاده کنید.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowLogoutConfirm(false)}
              className="flex-1"
            >
              انصراف
            </Button>
            <Button
              variant="destructive"
              onClick={handleLogout}
              className="flex-1"
            >
              خروج از حساب
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsScreen;