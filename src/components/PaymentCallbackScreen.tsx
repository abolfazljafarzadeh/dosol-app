import React, { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { useApp } from '../App';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';

const PaymentCallbackScreen = () => {
  const { navigate, setState } = useApp();
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying');
  const [orderId, setOrderId] = useState<string | null>(null);
  const [refId, setRefId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        console.log('🔍 Starting payment verification...');
        
        // Get URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const authority = urlParams.get('Authority');
        const zpStatus = urlParams.get('Status');
        const orderIdParam = urlParams.get('order_id');
        const state = urlParams.get('state');

        console.log('📋 Callback params:', { authority, zpStatus, orderIdParam, state });

        if (!authority) {
          console.error('❌ No authority in URL');
          setStatus('failed');
          setErrorMessage('اطلاعات پرداخت در لینک یافت نشد');
          return;
        }

        // If user cancelled
        if (zpStatus === 'NOK') {
          console.log('❌ User cancelled payment');
          setStatus('failed');
          setErrorMessage('پرداخت توسط کاربر لغو شد');
          return;
        }

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.error('❌ No authenticated user');
          setStatus('failed');
          setErrorMessage('کاربر احراز هویت نشده است');
          return;
        }

        console.log('✅ User authenticated');

        // If no order_id in URL, try to find it by authority
        let finalOrderId = orderIdParam;
        if (!finalOrderId) {
          const { data: purchase } = await supabase
            .from('purchases')
            .select('id')
            .eq('authority', authority)
            .eq('user_id', user.id)
            .maybeSingle();
          
          if (purchase) {
            finalOrderId = purchase.id;
          }
        }

        if (!finalOrderId) {
          console.error('❌ Order ID not found');
          setStatus('failed');
          setErrorMessage('سفارش یافت نشد');
          return;
        }

        setOrderId(finalOrderId);

        // Call verify-payment edge function
        console.log('📞 Calling verify-payment function...');
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: {
            order_id: finalOrderId,
            authority,
            state,
            status: zpStatus
          }
        });

        console.log('📥 Verify-payment response:', data);

        if (error) {
          console.error('❌ Verify error:', error);
          setStatus('failed');
          setErrorMessage(error.message || 'خطا در تأیید پرداخت');
          return;
        }

        if (data.ok && data.status === 'completed') {
          console.log('✅ Payment verified successfully');
          setStatus('success');
          setRefId(data.order.ref_id);
          setOrderId(data.order.id);

          // Update user profile in state
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (profile) {
            setState(prev => ({ ...prev, user: profile }));
          }

          toast.success("پرداخت موفق - اشتراک شما با موفقیت فعال شد");
        } else {
          console.log('❌ Payment verification failed');
          setStatus('failed');
          setErrorMessage(data.message || 'تأیید پرداخت ناموفق بود');
        }

      } catch (error) {
        console.error('❌ Error verifying payment:', error);
        setStatus('failed');
        setErrorMessage('خطا در بررسی وضعیت پرداخت');
      }
    };

    verifyPayment();
  }, [setState]);

  const handleReturnToDashboard = () => {
    navigate('dashboard');
  };

  const handleRetry = () => {
    navigate('subscription');
  };

  // Show verifying state
  if (status === 'verifying') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50 p-6 flex items-center justify-center">
        <Card className="max-w-md w-full rounded-3xl shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
            <h1 className="text-xl mb-3 text-gray-800">
              در حال تأیید پرداخت...
            </h1>
            <p className="text-gray-600 text-sm mb-4">
              لطفاً صبر کنید، پرداخت شما در حال تأیید است
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show success state
  if (status === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-6 flex items-center justify-center">
        <Card className="max-w-md w-full rounded-3xl shadow-lg">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-xl mb-3 text-gray-800">
              پرداخت موفق بود! 🎉
            </h1>
            <p className="text-gray-600 text-sm leading-relaxed mb-4">
              حساب شما به پریمیوم ارتقا یافت
            </p>
            {refId && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-6">
                <p className="text-xs text-green-700 mb-1">کد پیگیری</p>
                <p className="text-sm text-green-900 font-mono">{refId}</p>
              </div>
            )}
            {orderId && (
              <p className="text-gray-500 text-xs mb-6">
                شناسه سفارش: {orderId.substring(0, 8)}...
              </p>
            )}
            <Button
              onClick={handleReturnToDashboard}
              className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-2xl h-12"
            >
              بازگشت به صفحه اصلی
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show failure state
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-slate-50 to-zinc-50 p-6 flex items-center justify-center">
      <Card className="max-w-md w-full rounded-3xl shadow-lg">
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl mb-3 text-gray-800">
            پرداخت ناموفق بود
          </h1>
          <p className="text-gray-600 text-sm leading-relaxed mb-2">
            {errorMessage || 'متأسفانه پرداخت شما با موفقیت انجام نشد'}
          </p>
          {orderId && (
            <p className="text-gray-500 text-xs mb-6">
              شناسه سفارش: {orderId.substring(0, 8)}...
            </p>
          )}
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

export default PaymentCallbackScreen;
