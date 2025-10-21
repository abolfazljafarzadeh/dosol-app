import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { useApp } from '../App';
import { ShoppingBag, Star, Clock, Users, PlayCircle, Loader2 } from 'lucide-react';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface Course {
  id: number;
  title: string;
  instructor: string;
  description: string;
  price: number;
  discountPrice: number | null;
  discountPercent: number | null;
  discountEndDate: string | null;
  rating: number;
  studentsCount: number;
  duration: string | null;
  level: string;
  image: string;
  category: string;
  videoUrl: string;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const StorefrontScreen = () => {
  const { state, navigate } = useApp();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<Record<number, TimeRemaining>>({});
  const [purchasingCourseId, setPurchasingCourseId] = useState<number | null>(null);

  // Map instructor names based on course title
  const getInstructorName = (courseTitle: string): string => {
    const title = courseTitle.toLowerCase();
    
    if (title.includes('استادیار')) return 'جمعی از اساتید';
    if (title.includes('تئوری موسیقی')) return 'آقای علیرضا مهندس';
    if (title.includes('کمالگرایی') || title.includes('استرس') || title.includes('تنبلی') || title.includes('اعتماد به نفس')) {
      return 'دکتر آرش جواهری';
    }
    if (title.includes('نت خوانی')) return 'خانم گلبن زارع';
    if (title.includes('مترونوم')) return 'خانم غزل مخمور';
    if (title.includes('ریتم خوانی') && !title.includes('چالش')) return 'آقای سورنا صفاتی';
    
    return 'مدرس دوسل';
  };

  // Map level based on course title
  const getCourseLevel = (courseTitle: string): string => {
    const title = courseTitle.toLowerCase();
    
    if (title.includes('نت خوانی') || title.includes('تئوری')) {
      return 'مبتدی/متوسط';
    }
    
    return 'مبتدی/متوسط/پیشرفته';
  };

  // Fetch courses from WooCommerce
  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('get-woocommerce-courses');
      
      if (error) throw error;
      
      if (data?.ok && data?.courses) {
        // Filter out unwanted courses and map instructors/levels/ratings
        const filteredCourses = data.courses
          .filter((course: Course) => {
            const title = course.title.toLowerCase();
            // Filter out rhythm challenge (check for both keywords) and AI assistant courses
            const isRhythmChallenge = title.includes('چالش') && title.includes('ریتم');
            const isAIAssistant = title.includes('دستیار هوشمند') || title.includes('دستیار');
            return !isRhythmChallenge && !isAIAssistant;
          })
          .map((course: Course) => {
            // Calculate discount percentage dynamically
            const discountPercent = course.discountPrice && course.price
              ? Math.round(((course.price - course.discountPrice) / course.price) * 100)
              : null;

            return {
              ...course,
              instructor: getInstructorName(course.title),
              level: getCourseLevel(course.title),
              rating: +(4.6 + Math.random() * 0.3).toFixed(1), // Random rating between 4.6-4.9
              discountPercent
            };
          });
        
        setCourses(filteredCourses);
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
      toast.error('خطا در بارگذاری دوره‌ها');
    } finally {
      setLoading(false);
    }
  };

  // Countdown timer for discounted courses
  useEffect(() => {
    const updateTimers = () => {
      const newTimeRemaining: Record<number, TimeRemaining> = {};
      
      courses.forEach(course => {
        if (course.discountPrice && course.discountEndDate) {
          const now = new Date().getTime();
          const endDate = new Date(course.discountEndDate).getTime();
          const difference = endDate - now;

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
  }, [courses]);

  const formatTime = (num: number) => {
    return new Intl.NumberFormat('fa-IR').format(num).padStart(2, '۰');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('fa-IR').format(price) + ' تومان';
  };

  const handleCourseClick = (course: Course) => {
    setSelectedCourse(course);
  };

  const handleBuyClick = async (course: Course) => {
    if (!state.user) {
      toast.error('لطفاً ابتدا وارد شوید');
      navigate('phone-input');
      return;
    }

    try {
      setPurchasingCourseId(course.id);
      const finalPrice = course.discountPrice || course.price;

      console.log('🛒 Starting course checkout:', { courseId: course.id, amount: finalPrice });

      // Create purchase record
      const { data, error } = await supabase.functions.invoke('start-checkout-course', {
        body: { 
          course_id: course.id,
          amount: finalPrice
        }
      });

      if (error) throw error;

      if (data?.ok && data?.payment_url) {
        console.log('✅ Payment URL received, redirecting...');
        // Redirect to payment gateway
        window.location.href = data.payment_url;
      } else {
        throw new Error('خطا در ایجاد لینک پرداخت');
      }
    } catch (error: any) {
      console.error('Error starting checkout:', error);
      toast.error(error.message || 'خطا در شروع پرداخت');
    } finally {
      setPurchasingCourseId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-2" />
          <p className="text-gray-600">در حال بارگذاری دوره‌ها...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-l from-orange-400 to-amber-400 text-white p-6 rounded-b-3xl">
        <h1 className="text-2xl mb-2 flex items-center gap-2">
          <ShoppingBag className="w-7 h-7" />
          ویترین دوره‌ها
        </h1>
        <p className="text-white/90">دوره‌های آموزشی با کیفیت از دوسل</p>
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
                {course.title.includes('استادیار') && (
                  <Badge className="absolute top-2 right-2 bg-red-500 text-white">
                    محبوب
                  </Badge>
                )}
                {course.duration && (
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded-lg flex items-center gap-1">
                    <PlayCircle className="w-3 h-3" />
                    {course.duration}
                  </div>
                )}
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
                    <span>{course.rating.toLocaleString('fa-IR')}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    سطح: {course.level}
                  </Badge>
                </div>

                {/* Discount Countdown Timer */}
                {course.discountPrice && timeRemaining[course.id] && (
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
                    {course.discountPrice && (
                      <>
                        <span className="text-sm text-gray-500 line-through">
                          {formatPrice(course.price)}
                        </span>
                        <span className="text-lg text-orange-600">
                          {formatPrice(course.discountPrice)}
                        </span>
                        {course.discountPercent && (
                          <Badge variant="destructive" className="text-xs">
                            {course.discountPercent.toLocaleString('fa-IR')}% تخفیف
                          </Badge>
                        )}
                      </>
                    )}
                    {!course.discountPrice && (
                      <span className="text-lg text-orange-600">
                        {formatPrice(course.price)}
                      </span>
                    )}
                  </div>
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleBuyClick(course);
                    }}
                    size="sm"
                    disabled={purchasingCourseId === course.id}
                    className="bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-lg"
                  >
                    {purchasingCourseId === course.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'خرید'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {courses.length === 0 && !loading && (
          <Card className="rounded-2xl shadow-sm mt-6">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 mx-auto bg-gradient-to-br from-gray-200 to-gray-300 rounded-xl flex items-center justify-center mb-3">
                <ShoppingBag className="w-6 h-6 text-gray-500" />
              </div>
              <h3 className="text-base mb-2">هنوز دوره‌ای موجود نیست</h3>
              <p className="text-sm text-gray-600">
                به زودی دوره‌های جدید اضافه می‌شوند
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Course Video Modal */}
      <Dialog open={!!selectedCourse} onOpenChange={(open) => !open && setSelectedCourse(null)}>
        <DialogContent className="mx-4 max-h-[80vh] overflow-y-auto">
          {selectedCourse && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg">{selectedCourse.title}</DialogTitle>
                <DialogDescription>{selectedCourse.instructor}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Video Player */}
                {selectedCourse.videoUrl ? (
                  <div className="w-full aspect-video bg-black rounded-xl overflow-hidden">
                    <video 
                      src={selectedCourse.videoUrl} 
                      controls 
                      className="w-full h-full"
                      poster={selectedCourse.image}
                    >
                      مرورگر شما از نمایش ویدیو پشتیبانی نمی‌کند.
                    </video>
                  </div>
                ) : (
                  <ImageWithFallback
                    src={selectedCourse.image}
                    alt={selectedCourse.title}
                    className="w-full h-40 object-cover rounded-xl"
                  />
                )}
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {selectedCourse.duration && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-500" />
                      <span>{selectedCourse.duration}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-orange-500" />
                    <span>{selectedCourse.rating.toLocaleString('fa-IR')} امتیاز</span>
                  </div>
                  <Badge variant="outline" className="w-fit">
                    سطح: {selectedCourse.level}
                  </Badge>
                </div>

                <p className="text-sm text-gray-700">{selectedCourse.description}</p>

                <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl p-4 border border-amber-200">
                  <div className="flex items-center justify-between">
                    <div>
                      {selectedCourse.discountPrice && (
                        <span className="text-sm text-gray-500 line-through block">
                          {formatPrice(selectedCourse.price)}
                        </span>
                      )}
                      <span className="text-xl text-orange-600">
                        {formatPrice(selectedCourse.discountPrice || selectedCourse.price)}
                      </span>
                    </div>
                    <Button
                      onClick={() => handleBuyClick(selectedCourse)}
                      disabled={purchasingCourseId === selectedCourse.id}
                      className="bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl"
                    >
                      {purchasingCourseId === selectedCourse.id ? <Loader2 className="w-4 h-4 animate-spin" /> : 'خرید دوره'}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StorefrontScreen;
