import React, { useEffect } from 'react';
import { Button } from './ui/button';
import { useApp } from '../App';
import { CheckCircle, Crown, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const PaymentSuccessScreen = () => {
  const { state, setState, navigate } = useApp();

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const { supabase } = await import('../integrations/supabase/client');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_premium')
            .eq('id', user.id)
            .single();
          
          if (profile?.is_premium) {
            setState(prev => ({
              ...prev,
              hasActiveSubscription: true,
              subscriptionExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            }));

            const currentStats = JSON.parse(localStorage.getItem('doosell_demo_stats') || '{}');
            const updatedStats = {
              ...currentStats,
              hasActiveSubscription: true,
              subscriptionExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            };
            localStorage.setItem('doosell_demo_stats', JSON.stringify(updatedStats));
          }
        }
      } catch (error) {
        console.error('Error fetching premium status:', error);
      }
    };

    fetchUserProfile();
  }, [setState]);

  const handleReturnToDashboard = () => {
    toast.success('به حساب پریمیوم خوش آمدید! 🎉');
    navigate('dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-6 flex items-center justify-center">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 left-0 w-full h-full opacity-5">
            <div className="absolute top-4 right-4 text-green-400">
              <Sparkles size={24} />
            </div>
            <div className="absolute top-16 left-8 text-green-300">
              <Sparkles size={16} />
            </div>
            <div className="absolute bottom-8 right-12 text-green-400">
              <Sparkles size={20} />
            </div>
            <div className="absolute bottom-16 left-4 text-green-300">
              <Sparkles size={14} />
            </div>
          </div>

          {/* Success Icon */}
          <div className="relative mb-6">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center shadow-lg transform rotate-3">
              <CheckCircle size={48} className="text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-full flex items-center justify-center shadow-md transform -rotate-12">
              <Crown size={16} className="text-white" />
            </div>
          </div>

          {/* Success Message */}
          <div className="mb-8">
            <h1 className="text-2xl mb-4 text-gray-800 leading-relaxed">
              پرداخت با موفقیت انجام شد 🎉
            </h1>
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-4">
              <p className="text-green-800 leading-relaxed">
                حساب شما به حالت پریمیوم ارتقا یافت.
              </p>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed">
              اکنون به تمام ویژگی‌های ویژه دوسل دسترسی دارید
            </p>
          </div>

          {/* Premium Features List */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-2xl p-4 mb-8">
            <div className="flex items-center justify-center mb-3">
              <Crown size={20} className="text-green-600 ml-2" />
              <span className="text-green-700 font-medium">مزایای پریمیوم</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center text-green-700">
                <CheckCircle size={14} className="ml-2 text-green-500" />
                <span>دسترسی کامل به چالش‌ها</span>
              </div>
              <div className="flex items-center text-green-700">
                <CheckCircle size={14} className="ml-2 text-green-500" />
                <span>تمام دستاوردها و جوایز</span>
              </div>
              <div className="flex items-center text-green-700">
                <CheckCircle size={14} className="ml-2 text-green-500" />
                <span>پشتیبانی اولویت‌دار</span>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <Button 
            onClick={handleReturnToDashboard}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl h-14 text-lg shadow-lg transform transition-transform hover:scale-[1.02]"
          >
            بازگشت به صفحه اصلی
          </Button>

          {/* Support Text */}
          <p className="text-xs text-gray-500 mt-4 leading-relaxed">
            در صورت بروز مشکل، با پشتیبانی تماس بگیرید
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessScreen;