import React, { useState } from 'react';
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
import { toast } from 'sonner@2.0.3';

const SettingsScreen = () => {
  const { state, setState, navigate } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [editedUser, setEditedUser] = useState({
    firstName: state.user?.firstName || '',
    lastName: state.user?.lastName || '',
    skillLevel: state.user?.skillLevel || '',
  });

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

  const handleSaveProfile = () => {
    if (!editedUser.firstName.trim() || !editedUser.lastName.trim()) {
      toast.error('نام و نام خانوادگی الزامی است');
      return;
    }

    const updatedUser = {
      ...state.user!,
      firstName: editedUser.firstName.trim(),
      lastName: editedUser.lastName.trim(),
      skillLevel: editedUser.skillLevel,
    };

    // Update localStorage
    localStorage.setItem('doosell_user', JSON.stringify(updatedUser));

    // Update state
    setState(prev => ({
      ...prev,
      user: updatedUser,
    }));

    setIsEditing(false);
    toast.success('اطلاعات شما با موفقیت به‌روزرسانی شد');
  };

  const handleCancelEdit = () => {
    setEditedUser({
      firstName: state.user?.firstName || '',
      lastName: state.user?.lastName || '',
      skillLevel: state.user?.skillLevel || '',
    });
    setIsEditing(false);
  };

  const handleNotificationToggle = (enabled: boolean) => {
    localStorage.setItem('doosell_notifications', enabled.toString());
    setState(prev => ({
      ...prev,
      notificationsEnabled: enabled,
    }));
    toast.success(enabled ? 'اعلان‌ها فعال شد' : 'اعلان‌ها غیرفعال شد');
  };

  const handleLogout = () => {
    // Clear all localStorage data
    localStorage.removeItem('doosell_user');
    localStorage.removeItem('doosell_points');
    localStorage.removeItem('doosell_streak');
    localStorage.removeItem('doosell_level');
    localStorage.removeItem('doosell_subscription');
    localStorage.removeItem('doosell_notifications');
    localStorage.removeItem('doosell_practice_frequency');
    localStorage.removeItem('doosell_practice_days');
    localStorage.removeItem('doosell_practice_time');

    // Reset state
    setState({
      user: null,
      isAuthenticated: false,
      currentPage: 'registration',
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

            {state.hasActiveSubscription && state.subscriptionExpiryDate && (
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