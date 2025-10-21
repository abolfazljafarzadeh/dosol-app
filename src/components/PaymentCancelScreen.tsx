import React from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { useApp } from '../App';
import { XCircle } from 'lucide-react';

const PaymentCancelScreen = () => {
  const { navigate } = useApp();

  const handleRetry = () => {
    navigate('subscription');
  };

  const handleReturnToDashboard = () => {
    navigate('dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50 p-6 flex items-center justify-center">
      <Card className="max-w-md w-full rounded-3xl shadow-lg">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
            <XCircle className="w-8 h-8 text-gray-600" />
          </div>
          <h1 className="text-xl mb-3 text-gray-800">
            پرداخت لغو شد
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed mb-6">
            شما فرآیند پرداخت را لغو کردید. در صورت تمایل می‌توانید دوباره تلاش کنید
          </p>
          <div className="space-y-3">
            <Button
              onClick={handleRetry}
              className="w-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white rounded-2xl h-12"
            >
              تلاش مجدد
            </Button>
            <Button
              onClick={handleReturnToDashboard}
              variant="outline"
              className="w-full rounded-2xl h-12"
            >
              بازگشت به صفحه اصلی
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentCancelScreen;
