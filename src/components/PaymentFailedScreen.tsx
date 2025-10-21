import React from 'react';
import { Button } from './ui/button';
import { useApp } from '../App';
import { XCircle, AlertTriangle, RefreshCw, CreditCard } from 'lucide-react';

const PaymentFailedScreen = () => {
  const { navigate } = useApp();

  const handleRetryPayment = () => {
    navigate('subscription');
  };

  const handleReturnToDashboard = () => {
    navigate('dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 p-6 flex items-center justify-center">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-3xl shadow-2xl p-8 text-center relative overflow-hidden">
          {/* Background decoration */}
          <div className="absolute top-0 left-0 w-full h-full opacity-5">
            <div className="absolute top-4 right-4 text-red-400">
              <AlertTriangle size={24} />
            </div>
            <div className="absolute top-16 left-8 text-orange-300">
              <AlertTriangle size={16} />
            </div>
            <div className="absolute bottom-8 right-12 text-red-400">
              <AlertTriangle size={20} />
            </div>
            <div className="absolute bottom-16 left-4 text-orange-300">
              <AlertTriangle size={14} />
            </div>
          </div>

          {/* Failed Icon */}
          <div className="relative mb-6">
            <div className="w-24 h-24 mx-auto bg-gradient-to-br from-red-400 to-orange-500 rounded-full flex items-center justify-center shadow-lg transform rotate-3">
              <XCircle size={48} className="text-white" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full flex items-center justify-center shadow-md transform -rotate-12">
              <AlertTriangle size={16} className="text-white" />
            </div>
          </div>

          {/* Failed Message */}
          <div className="mb-8">
            <h1 className="text-2xl mb-4 text-gray-800 leading-relaxed">
              پرداخت ناموفق بود ❌
            </h1>
            <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-4">
              <p className="text-orange-800 leading-relaxed">
                در صورتی که مبلغی از حساب شما کسر شد، تا ۷۲ ساعت آینده بازگشت داده می‌شود.
              </p>
            </div>
            <p className="text-gray-600 text-sm leading-relaxed">
              لطفاً دوباره تلاش کنید یا با پشتیبانی تماس بگیرید
            </p>
          </div>

          {/* Common Issues */}
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-2xl p-4 mb-8">
            <div className="flex items-center justify-center mb-3">
              <CreditCard size={20} className="text-orange-600 ml-2" />
              <span className="text-orange-700 font-medium">دلایل احتمالی</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex items-center text-orange-700">
                <AlertTriangle size={14} className="ml-2 text-orange-500" />
                <span>موجودی کافی نیست</span>
              </div>
              <div className="flex items-center text-orange-700">
                <AlertTriangle size={14} className="ml-2 text-orange-500" />
                <span>اتصال اینترنت ناپایدار</span>
              </div>
              <div className="flex items-center text-orange-700">
                <AlertTriangle size={14} className="ml-2 text-orange-500" />
                <span>مشکل موقت بانک</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button 
              onClick={handleRetryPayment}
              className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-2xl h-14 text-lg shadow-lg transform transition-transform hover:scale-[1.02]"
            >
              <RefreshCw size={20} className="ml-2" />
              تلاش مجدد
            </Button>
            
            <Button 
              onClick={handleReturnToDashboard}
              variant="outline"
              className="w-full border-2 border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-800 rounded-2xl h-12 bg-white hover:bg-gray-50"
            >
              بازگشت به صفحه اصلی
            </Button>
          </div>

          {/* Support Text */}
          <p className="text-xs text-gray-500 mt-4 leading-relaxed">
            نیاز به کمک دارید؟ با پشتیبانی در تماس باشید
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentFailedScreen;