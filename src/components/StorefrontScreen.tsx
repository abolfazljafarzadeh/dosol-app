import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { useApp } from '../App';
import { ShoppingBag, Star, Clock, Users, PlayCircle } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { toast } from 'sonner@2.0.3';

interface Course {
  id: string;
  title: string;
  instructor: string;
  description: string;
  price: number;
  originalPrice?: number;
  rating: number;
  students: number;
  duration: string;
  level: string;
  image: string;
  category: string;
  isPopular?: boolean;
  hasDiscount?: boolean;
  discountEndTime?: Date;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const StorefrontScreen = () => {
  const { state } = useApp();
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<Record<string, TimeRemaining>>({});

  const courses: Course[] = [
    {
      id: '1',
      title: 'پیانو از صفر تا صد',
      instructor: 'استاد احمدی',
      description: 'آموزش کامل پیانو برای تازه‌کارها با تمرینات عملی',
      price: 290000,
      originalPrice: 350000,
      rating: 4.8,
      students: 1250,
      duration: '8 ساعت',
      level: 'تازه‌کار',
      image: 'https://images.unsplash.com/photo-1571974599782-87624638275c?w=400&h=250&fit=crop',
      category: 'پیانو',
      isPopular: true,
      hasDiscount: true,
      discountEndTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
    },
    {
      id: '2',
      title: 'تکنیک‌های پیشرفته گیتار',
      instructor: 'استاد رضایی',
      description: 'فراتر از مبانی: تکنیک‌های حرفه‌ای گیتار',
      price: 320000,
      rating: 4.9,
      students: 890,
      duration: '12 ساعت',
      level: 'پیشرفته',
      image: 'https://images.unsplash.com/photo-1519320859666-7df74052ee72?w=400&h=250&fit=crop',
      category: 'گیتار'
    },
    {
      id: '3',
      title: 'موسیقی سنتی ایرانی',
      instructor: 'استاد فرهادی',
      description: 'آشنایی با دستگاه‌های موسیقی سنتی ایران',
      price: 250000,
      rating: 4.7,
      students: 650,
      duration: '10 ساعت',
      level: 'متوسط',
      image: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=250&fit=crop',
      category: 'سنتی'
    },
    {
      id: '4',
      title: 'ویولن برای کودکان',
      instructor: 'استاد میرزایی',
      description: 'آموزش شاد و جذاب ویولن ویژه کودکان ۶ تا ۱۲ سال',
      price: 180000,
      originalPrice: 220000,
      rating: 4.6,
      students: 430,
      duration: '6 ساعت',
      level: 'تازه‌کار',
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=250&fit=crop',
      category: 'ویولن',
      hasDiscount: true,
      discountEndTime: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000) // 1 day from now
    },
    {
      id: '5',
      title: 'آهنگسازی مدرن',
      instructor: 'استاد نوری',
      description: 'خلق موسیقی با نرم‌افزارهای مدرن و تکنیک‌های نوین',
      price: 450000,
      rating: 4.9,
      students: 320,
      duration: '15 ساعت',
      level: 'حرفه‌ای',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=250&fit=crop',
      category: 'آهنگسازی',
      isPopular: true
    },
    {
      id: '6',
      title: 'سنتور کلاسیک',
      instructor: 'استاد حسینی',
      description: 'تسلط بر نوازندگی سنتور با قطعات کلاسیک',
      price: 210000,
      rating: 4.5,
      students: 280,
      duration: '8 ساعت',
      level: 'متوسط',
      image: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=250&fit=crop',
      category: 'سنتور'
    }
  ];

  // Countdown timer for discounted courses
  useEffect(() => {
    const updateTimers = () => {
      const newTimeRemaining: Record<string, TimeRemaining> = {};
      
      courses.forEach(course => {
        if (course.hasDiscount && course.discountEndTime) {
          const now = new Date().getTime();
          const difference = course.discountEndTime.getTime() - now;

          if (difference > 0) {
            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);

            newTimeRemaining[course.id] = { days, hours, minutes, seconds };
          } else {
            newTimeRemaining[course.id] = { days: 0, hours: 0, minutes: 0, seconds: 0 };
          }
        }
      });
      
      setTimeRemaining(newTimeRemaining);
    };

    updateTimers();
    const timer = setInterval(updateTimers, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (num: number) => {
    return new Intl.NumberFormat('fa-IR').format(num).padStart(2, '۰');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fa-IR').format(price) + ' تومان';
  };

  const handleCourseClick = (course: Course) => {
    setSelectedCourse(course);
  };

  const handleBuyClick = (course: Course) => {
    setSelectedCourse(course);
    setShowCheckout(true);
  };

  const handleCheckoutSubmit = () => {
    setShowCheckout(false);
    setSelectedCourse(null);
    toast.success('خرید شما با موفقیت ثبت شد! لینک دوره به زودی ارسال می‌شود.');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-l from-orange-400 to-amber-400 text-white p-6 rounded-b-3xl">
        <h1 className="text-2xl mb-2 flex items-center gap-2">
          <ShoppingBag className="w-7 h-7" />
          ویترین دوره‌ها
        </h1>
        <p className="text-white/90">دوره‌های آموزشی با کیفیت</p>
      </div>

      <div className="p-6">
        {/* Notice */}
        <Card className="rounded-2xl shadow-sm mb-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <p className="text-blue-700 text-sm">
              دوره‌ها مستقل از اشتراک هستند و پس از خرید دائمی در دسترس شما خواهند بود
            </p>
          </CardContent>
        </Card>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 gap-4">
          {courses.map((course) => (
            <Card 
              key={course.id} 
              className="rounded-2xl shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => handleCourseClick(course)}
            >
              <div className="relative">
                <ImageWithFallback
                  src={course.image}
                  alt={course.title}
                  className="w-full h-32 object-cover rounded-t-2xl"
                />
                {course.isPopular && (
                  <Badge className="absolute top-2 right-2 bg-red-500 text-white">
                    محبوب
                  </Badge>
                )}
                <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                  <PlayCircle className="w-3 h-3" />
                  {course.duration}
                </div>
              </div>
              
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-base mb-1">{course.title}</h3>
                    <p className="text-sm text-gray-600 mb-2">{course.instructor}</p>
                    <p className="text-xs text-gray-500 line-clamp-2">{course.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 mb-3 text-xs text-gray-600">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span>{course.rating}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    <span>{course.students.toLocaleString('fa-IR')} دانشجو</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {course.level}
                  </Badge>
                </div>

                {/* Discount Countdown Timer */}
                {course.hasDiscount && timeRemaining[course.id] && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg">
                    <div className="text-center">
                      <p className="text-xs text-red-700 mb-1">پایان تخفیف</p>
                      <div className="grid grid-cols-4 gap-1" dir="ltr">
                        <div className="bg-red-100 rounded px-1 py-0.5">
                          <div className="text-xs text-red-800">{formatTime(timeRemaining[course.id].days)}</div>
                          <div className="text-xs text-red-600">روز</div>
                        </div>
                        <div className="bg-red-100 rounded px-1 py-0.5">
                          <div className="text-xs text-red-800">{formatTime(timeRemaining[course.id].hours)}</div>
                          <div className="text-xs text-red-600">ساعت</div>
                        </div>
                        <div className="bg-red-100 rounded px-1 py-0.5">
                          <div className="text-xs text-red-800">{formatTime(timeRemaining[course.id].minutes)}</div>
                          <div className="text-xs text-red-600">دقیقه</div>
                        </div>
                        <div className="bg-red-100 rounded px-1 py-0.5">
                          <div className="text-xs text-red-800">{formatTime(timeRemaining[course.id].seconds)}</div>
                          <div className="text-xs text-red-600">ثانیه</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {course.originalPrice && (
                      <span className="text-sm text-gray-500 line-through">
                        {formatPrice(course.originalPrice)}
                      </span>
                    )}
                    <span className="text-lg text-orange-600">
                      {formatPrice(course.price)}
                    </span>
                    {course.hasDiscount && course.originalPrice && (
                      <Badge variant="destructive" className="text-xs">
                        {Math.round(((course.originalPrice - course.price) / course.originalPrice) * 100)}% تخفیف
                      </Badge>
                    )}
                  </div>
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuyClick(course);
                    }}
                    size="sm"
                    className="bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-lg"
                  >
                    خرید
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State for More Courses */}
        <Card className="rounded-2xl shadow-sm mt-6">
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 mx-auto bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl flex items-center justify-center mb-3">
              <ShoppingBag className="w-6 h-6 text-gray-500" />
            </div>
            <h3 className="text-base mb-2">دوره‌های بیشتر به زودی...</h3>
            <p className="text-sm text-gray-600">
              ما مدام در حال اضافه کردن دوره‌های جدید هستیم
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Course Detail Modal */}
      <Dialog open={!!selectedCourse && !showCheckout} onOpenChange={() => setSelectedCourse(null)}>
        <DialogContent className="mx-4 max-h-[80vh] overflow-y-auto">
          {selectedCourse && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{selectedCourse.title}</DialogTitle>
                <DialogDescription>{selectedCourse.instructor}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <ImageWithFallback
                  src={selectedCourse.image}
                  alt={selectedCourse.title}
                  className="w-full h-40 object-cover rounded-xl"
                />
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span>{selectedCourse.duration}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-orange-500" />
                    <span>{selectedCourse.students.toLocaleString('fa-IR')} دانشجو</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-orange-500" />
                    <span>{selectedCourse.rating} امتیاز</span>
                  </div>
                  <Badge variant="outline" className="w-fit">
                    {selectedCourse.level}
                  </Badge>
                </div>

                <p className="text-sm text-gray-700">{selectedCourse.description}</p>

                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <div>
                      {selectedCourse.originalPrice && (
                        <span className="text-sm text-gray-500 line-through block">
                          {formatPrice(selectedCourse.originalPrice)}
                        </span>
                      )}
                      <span className="text-xl text-orange-600">
                        {formatPrice(selectedCourse.price)}
                      </span>
                    </div>
                    <Button
                      onClick={() => handleBuyClick(selectedCourse)}
                      className="bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl"
                    >
                      خرید دوره
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Modal */}
      <Dialog open={showCheckout} onOpenChange={setShowCheckout}>
        <DialogContent className="mx-4">
          <DialogHeader>
            <DialogTitle>تکمیل خرید</DialogTitle>
            <DialogDescription>
              آیا از خرید دوره "{selectedCourse?.title}" مطمئن هستید؟
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedCourse && (
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="mb-2">{selectedCourse.title}</h4>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">قیمت:</span>
                  <span className="text-lg text-orange-600">
                    {formatPrice(selectedCourse.price)}
                  </span>
                </div>
              </div>
            )}
            
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-blue-700 text-sm text-center">
                در نسخه آزمایشی پرداخت واقعی وجود ندارد
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setShowCheckout(false)}
                className="flex-1"
              >
                انصراف
              </Button>
              <Button
                onClick={handleCheckoutSubmit}
                className="flex-1 bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white"
              >
                تأیید خرید
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StorefrontScreen;