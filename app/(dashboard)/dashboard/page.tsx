'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function DashboardPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')

  useEffect(() => {
    const userPhone = localStorage.getItem('user_phone')
    if (!userPhone) {
      router.push('/login')
    } else {
      setPhone(userPhone)
    }
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 text-white mb-6">
          <h1 className="text-2xl font-bold mb-2">سلام دوست عزیز! 👋</h1>
          <p>شماره شما: {phone}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-xl shadow">
            <h3 className="font-bold mb-2">امتیاز شما</h3>
            <p className="text-3xl font-bold text-purple-600">0</p>
          </div>
          
          <div className="bg-white p-4 rounded-xl shadow">
            <h3 className="font-bold mb-2">تمرین امروز</h3>
            <p className="text-3xl font-bold text-green-600">0 دقیقه</p>
          </div>
        </div>

        <button className="w-full mt-6 bg-purple-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-purple-700">
          ثبت تمرین امروز 🎵
        </button>

        <button 
          onClick={() => {
            localStorage.removeItem('user_phone')
            router.push('/login')
          }}
          className="w-full mt-4 bg-red-500 text-white py-3 rounded-xl hover:bg-red-600"
        >
          خروج
        </button>
      </div>
    </div>
  )
}