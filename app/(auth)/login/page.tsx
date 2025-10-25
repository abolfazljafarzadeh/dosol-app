'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const sendOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.functions.invoke('send-otp', {
        body: { phone_number: phone }
      })

      console.log('Send OTP response:', data, error)

      if (error) throw error
      
      if (data?.success) {
        setStep('otp')
        alert('کد تایید به شماره ' + phone + ' ارسال شد')
      } else {
        throw new Error(data?.error || 'خطا در ارسال کد')
      }
    } catch (err: any) {
      console.error('Send OTP error:', err)
      setError(err.message || 'خطا در ارسال کد')
    } finally {
      setLoading(false)
    }
  }

  const verifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: { 
          phone_number: phone, 
          otp_code: otp 
        }
      })

      console.log('Verify OTP response:', data, error)

      if (error) throw error
      
      if (data?.success) {
        localStorage.setItem('user_phone', phone)
        alert(data.message || 'ورود موفق!')
        router.push('/dashboard')
      } else {
        throw new Error(data?.error || 'کد نامعتبر است')
      }
    } catch (err: any) {
      console.error('Verify OTP error:', err)
      setError(err.message || 'کد نامعتبر است')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-50">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-purple-600 mb-2">🎵 دوسل</h1>
          <p className="text-gray-600">همراه تمرین موسیقی شما</p>
        </div>
        
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={sendOTP}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              شماره موبایل
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="09123456789"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
              required
              pattern="09[0-9]{9}"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mb-4">
              شماره باید با 09 شروع شود و 11 رقم باشد
            </p>
            
            <button
              type="submit"
              disabled={loading || phone.length !== 11}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition font-medium"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
                  در حال ارسال...
                </span>
              ) : (
                'ارسال کد تایید'
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyOTP}>
            <p className="text-center mb-6 text-gray-600">
              کد تایید به شماره <span className="font-bold">{phone}</span> ارسال شد
            </p>
            
            <label className="block text-sm font-medium text-gray-700 mb-2">
              کد تایید 6 رقمی
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 text-center text-2xl tracking-widest focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono"
              maxLength={6}
              required
              disabled={loading}
              autoFocus
            />
            
            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition font-medium"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <span className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></span>
                  در حال بررسی...
                </span>
              ) : (
                'تایید و ورود'
              )}
            </button>
            
            <button
              type="button"
              onClick={() => {
                setStep('phone')
                setOtp('')
                setError('')
              }}
              className="w-full mt-3 text-purple-600 py-2 hover:text-purple-700 text-sm"
              disabled={loading}
            >
              تغییر شماره
            </button>
          </form>
        )}
      </div>
    </div>
  )
}