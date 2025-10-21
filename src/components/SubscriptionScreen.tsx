import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { useApp } from '../App';
import { ArrowRight, Check, Crown, Users, Target, TrendingUp, Brain, Flame, BarChart } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface SubscriptionPlan {
  id: string;
  duration: string;
  originalPrice: number;
  discountPrice: number;
  validityDays: number;
  label: string;
  isPopular?: boolean;
  emoji?: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const SubscriptionScreen = () => {
  const { state, setState, navigate } = useApp();
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<TimeRemaining>({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [retryAfter, setRetryAfter] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Set discount end time (2 days from now as example)
  const discountEndTime = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

  // Countdown timer effect
  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const difference = discountEndTime.getTime() - now;

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

  // Countdown for retry after rate limit
  useEffect(() => {
    if (retryAfter && retryAfter > 0) {
      const timer = setInterval(() => {
        setRetryAfter(prev => {
          if (prev && prev > 1) return prev - 1;
          return null;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [retryAfter]);

  const formatTime = (num: number) => {
    return new Intl.NumberFormat('fa-IR').format(num).padStart(2, '۰');
  };

  const benefits = [
    {
      id: 1,
      title: 'شرکت در لیگ هفتگی',
      description: 'رقابت با سایر موزیسین‌ها و کسب رتبه',
      icon: Users,
      color: 'blue'
    },
    {
      id: 2,
      title: 'دسترسی به چالش‌های تمرینی',
      description: 'چالش‌های هفتگی و ماهانه برای پیشرفت',
      icon: Target,
      color: 'green'
    },
    {
      id: 3,
      title: 'ثبت استمرار نامحدود',
      description: 'پیگیری روزهای تمرین بدون محدودیت',
      icon: Flame,
      color: 'red'
    },
    {
      id: 4,
      title: 'دریافت گزارش‌های عملکرد',
      description: 'تحلیل دقیق پیشرفت و نقاط قوت شما',
      icon: BarChart,
      color: 'purple'
    },
    {
      id: 5,
      title: 'استفاده از دستیار هوشمند',
      description: 'پاسخ به سوالات موسیقی و رفع مشکلات',
      icon: Brain,
      color: 'indigo'
    },
    {
      id: 6,
      title: 'نمایش رتبه در جدول کلی',
      description: 'مشاهده جایگاه شما در میان تمام کاربران',
      icon: TrendingUp,
      color: 'orange'
    }
  ];

  const plans: SubscriptionPlan[] = [
    {
      id: '1month',
      duration: '۱ ماهه',
      originalPrice: 49000,
      discountPrice: 29000,
      validityDays: 30,
      label: 'شروع تمرین حرفه‌ای',
      emoji: '🚀'
    },
    {
      id: '6months',
      duration: '۶ ماهه',
      originalPrice: 139000,
      discountPrice: 69000,
      validityDays: 180,
      label: 'محبوب‌ترین',
      isPopular: true,
      emoji: '⭐'
    },
    {
      id: '1year',
      duration: '۱ ساله',
      originalPrice: 219000,
      discountPrice: 119000,
      validityDays: 365,
      label: 'اقتصادی و بلندمدت',
      emoji: '💰'
    }
  ];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fa-IR').format(price) + ' تومان';
  };

  const getColorClasses = (color: string) => {
    const colorMap = {
      blue: 'bg-blue-100 text-blue-700',
      green: 'bg-green-100 text-green-700',
      red: 'bg-red-100 text-red-700',
      purple: 'bg-purple-100 text-purple-700',
      indigo: 'bg-indigo-100 text-indigo-700',
      orange: 'bg-orange-100 text-orange-700'
    };
    return colorMap[color as keyof typeof colorMap] || 'bg-gray-100 text-gray-700';
  };

  const handlePlanSelect = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setShowConfirmation(true);
  };

  const handleSubscribe = async () => {
    if (!selectedPlan || isProcessing || retryAfter) return;

    try {
      setIsProcessing(true);
      setErrorMessage(null);
      setShowConfirmation(false);
      toast.loading('در حال فعال‌سازی اشتراک...');

      const { data: session } = await supabase.auth.getSession();
      if (!session?.session?.user) {
        toast.dismiss();
        toast.error('لطفاً ابتدا وارد حساب کاربری خود شوید');
        setIsProcessing(false);
        return;
      }

      // TEST MODE: Activate premium directly without payment gateway
      const { data, error } = await supabase.functions.invoke('activate-premium-test', {
        body: {
          plan_id: selectedPlan.id,
          validity_days: selectedPlan.validityDays,
        }
      });

      toast.dismiss();

      if (error) {
        console.error('❌ Premium activation error:', error);
        setErrorMessage('خطا در فعال‌سازی اشتراک');
        toast.error('خطا در فعال‌سازی اشتراک');
        setIsProcessing(false);
        return;
      }

      if (data?.ok && data?.is_premium) {
        // Update local state with subscription info
        setState(prev => ({
          ...prev,
          user: prev.user ? { ...prev.user, is_premium: true } : prev.user,
          hasActiveSubscription: true,
          subscriptionExpiryDate: data.subscription_expires_at || null
        }));

        // Update localStorage
        if (state.user) {
          const updatedStats = {
            totalPoints: state.totalPoints,
            streak: state.streak,
            level: state.level,
            hasActiveSubscription: true,
            subscriptionExpiryDate: data.subscription_expires_at || null,
          };
          localStorage.setItem('doosell_demo_stats', JSON.stringify(updatedStats));
        }

        toast.success('🎉 اشتراک شما با موفقیت فعال شد!');
        
        // Redirect to dashboard after short delay
        setTimeout(() => {
          navigate('dashboard');
        }, 1500);
      } else {
        toast.error('خطا در فعال‌سازی اشتراک');
        setIsProcessing(false);
      }
      
    } catch (error) {
      console.error('❌ Subscribe error:', error);
      toast.dismiss();
      setErrorMessage('مشکلی در فرآیند فعال‌سازی رخ داده است');
      toast.error('خطایی رخ داد. لطفاً دوباره تلاش کنید');
      setIsProcessing(false);
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
            onClick={() => navigate('dashboard')}
            className="text-white hover:bg-white/20 p-2 rounded-xl"
          >
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl mb-1 flex items-center gap-2">
              <Crown className="w-7 h-7" />
              اشتراک ویژه
            </h1>
            <p className="text-white/90">برای پیشرفت واقعی</p>
          </div>
        </div>

        {/* Live Countdown Timer */}
        <div className="bg-white/20 backdrop-blur-sm rounded-xl p-4">
          <div className="text-center">
            <p className="text-sm mb-3">🔥 تخفیف ویژه</p>
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
        {/* Benefits Section */}
        <div>
          <h2 className="text-lg mb-4 text-center">با خرید اشتراک چی‌ها به دست میارید؟</h2>
          <div className="grid grid-cols-1 gap-3">
            {benefits.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <Card key={benefit.id} className="rounded-2xl shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${getColorClasses(benefit.color)}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-base mb-1">{benefit.title}</h3>
                        <p className="text-sm text-gray-600">{benefit.description}</p>
                      </div>
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-1" />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Plans Section */}
        <div>
          <h2 className="text-lg mb-4 text-center">پلن‌های اشتراک</h2>
          <div className="space-y-4">
            {plans.map((plan) => (
              <Card 
                key={plan.id} 
                className={`rounded-2xl shadow-sm border-2 transition-all ${
                  plan.isPopular 
                    ? 'border-orange-300 bg-gradient-to-br from-orange-50 to-amber-50' 
                    : 'border-gray-200 hover:border-orange-200'
                }`}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{plan.emoji}</span>
                      <div>
                        <h3 className="text-lg">{plan.duration}</h3>
                        <p className="text-sm text-gray-600">{plan.validityDays} روز اعتبار</p>
                      </div>
                    </div>
                    {plan.isPopular && (
                      <Badge className="bg-orange-500 text-white">
                        {plan.label}
                      </Badge>
                    )}
                    {!plan.isPopular && (
                      <Badge variant="outline" className="text-xs">
                        {plan.label}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm text-gray-500 line-through">
                          {formatPrice(plan.originalPrice)}
                        </span>
                        <Badge variant="destructive" className="text-xs">
                          {Math.round(((plan.originalPrice - plan.discountPrice) / plan.originalPrice) * 100)}% تخفیف
                        </Badge>
                      </div>
                      <span className="text-2xl text-orange-600">
                        {formatPrice(plan.discountPrice)}
                      </span>
                    </div>
                    <Button
                      onClick={() => handlePlanSelect(plan)}
                      disabled={isProcessing || !!retryAfter}
                      className={`${
                        plan.isPopular 
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600' 
                          : 'bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500'
                      } text-white rounded-xl px-6 disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isProcessing ? 'در حال پردازش...' : retryAfter ? `صبر (${retryAfter}s)` : 'انتخاب پلن'}
                    </Button>
                  </div>

                  {/* Monthly cost calculation */}
                  <div className="text-center pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      معادل {Math.round(plan.discountPrice / (plan.validityDays / 30)).toLocaleString('fa-IR')} تومان در ماه
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Discount Notice */}
        <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-4">
            <div className="text-center">
              <h4 className="text-blue-800 mb-2">💡 نکته مهم</h4>
              <p className="text-blue-700 text-sm">
                تخفیف‌ها در زمان‌های خاص یا با کد دعوت فعال می‌شوند.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* CTA Buttons */}
        <div className="text-center space-y-3">
          <Button
            onClick={() => handlePlanSelect(plans[1])} // Default to 6-month plan
            className="w-full bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-2xl h-12 text-lg"
          >
            همین حالا فعال کن
          </Button>
          <Button
            onClick={() => handlePlanSelect(plans[2])} // 1-year plan
            variant="outline"
            className="w-full rounded-2xl h-12"
          >
            می‌خوام حرفه‌ای تمرین کنم
          </Button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="mx-4">
          <DialogHeader>
            <DialogTitle>تأیید خرید اشتراک</DialogTitle>
            <DialogDescription>
              آیا از خرید اشتراک {selectedPlan?.duration} مطمئن هستید؟
            </DialogDescription>
          </DialogHeader>
          
          {selectedPlan && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-2">
                    <span className="text-xl">{selectedPlan.emoji}</span>
                    <span>اشتراک {selectedPlan.duration}</span>
                  </span>
                  <Badge variant="outline">{selectedPlan.label}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">قیمت نهایی:</span>
                  <span className="text-lg text-orange-600">
                    {formatPrice(selectedPlan.discountPrice)}
                  </span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
                <p className="text-blue-700 text-sm text-center">
                  💳 در نسخه آزمایشی پرداخت واقعی وجود ندارد
                </p>
              </div>

              {errorMessage && retryAfter && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
                  <p className="text-orange-800 text-sm mb-2">{errorMessage}</p>
                  <p className="text-orange-600 text-lg font-bold">
                    {Math.floor(retryAfter / 60)}:{String(retryAfter % 60).padStart(2, '0')}
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1"
                  disabled={isProcessing}
                >
                  انصراف
                </Button>
                <Button
                  onClick={handleSubscribe}
                  disabled={isProcessing || !!retryAfter}
                  className="flex-1 bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'در حال پردازش...' : retryAfter ? `صبر (${retryAfter}s)` : 'تأیید خرید'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SubscriptionScreen;