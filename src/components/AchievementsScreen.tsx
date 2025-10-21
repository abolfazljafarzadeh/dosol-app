import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useApp } from '../App';
import { Star, Flame, Trophy, Users, TrendingUp, Lock, ShoppingBag } from 'lucide-react';
import { formatPersianNumber, toPersianDigits } from './utils/persianUtils';

const AchievementsScreen = () => {
  const { state, navigate } = useApp();

  // Level calculation
  const calculateLevelRequirements = () => {
    const levels = [{ level: 1, required: 0 }];
    for (let i = 2; i <= 20; i++) {
      const required = levels[i - 2].required + 100 + (i * 50);
      levels.push({ level: i, required });
    }
    return levels;
  };

  const levels = calculateLevelRequirements();
  const currentLevel = levels.find(l => state.totalPoints < l.required) || levels[levels.length - 1];
  const currentLevelIndex = currentLevel.level - 1;
  const prevLevel = levels[Math.max(0, currentLevelIndex - 1)];
  const nextLevel = levels[Math.min(levels.length - 1, currentLevelIndex)];
  
  const progressInLevel = state.totalPoints - prevLevel.required;
  const pointsNeededForNextLevel = nextLevel.required - state.totalPoints;
  const levelProgress = (progressInLevel / (nextLevel.required - prevLevel.required)) * 100;

  // Mock medals data
  const medalCategories = [
    {
      id: 'points',
      title: 'امتیاز',
      medals: [
        { id: 1, title: 'شروع خوب', requirement: 100, points: 100, earned: state.totalPoints >= 100 },
        { id: 2, title: 'پیشرفت عالی', requirement: 500, points: 500, earned: state.totalPoints >= 500 },
        { id: 3, title: 'حرفه‌ای', requirement: 1000, points: 1000, earned: state.totalPoints >= 1000 },
        { id: 4, title: 'استاد', requirement: 2000, points: 2000, earned: state.totalPoints >= 2000 },
        { id: 5, title: 'افسانه', requirement: 5000, points: 5000, earned: state.totalPoints >= 5000 },
      ]
    },
    {
      id: 'streak',
      title: 'استمرار',
      medals: [
        { id: 11, title: 'شروع استمرار', requirement: 5, points: 5, earned: state.streak >= 5 },
        { id: 12, title: 'هفته کامل', requirement: 7, points: 7, earned: state.streak >= 7 },
        { id: 13, title: 'استمرار قوی', requirement: 14, points: 14, earned: state.streak >= 14 },
        { id: 14, title: 'یک ماه', requirement: 30, points: 30, earned: state.streak >= 30 },
        { id: 15, title: 'بی‌وقفه', requirement: 60, points: 60, earned: state.streak >= 60 },
      ]
    },
    {
      id: 'league',
      title: 'لیگ',
      medals: [
        { id: 31, title: 'مدال طلا', requirement: 'رتبه اول لیگ', earned: false },
        { id: 32, title: 'مدال نقره', requirement: 'رتبه دوم لیگ', earned: false },
        { id: 33, title: 'مدال برنز', requirement: 'رتبه سوم لیگ', earned: false },
      ]
    }
  ];

  const totalMedals = medalCategories.reduce((sum, cat) => sum + cat.medals.length, 0);
  const earnedMedals = medalCategories.reduce((sum, cat) => 
    sum + cat.medals.filter(m => m.earned).length, 0
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50 pb-20">
      {/* Header */}
      <div className="bg-gradient-to-l from-orange-400 to-amber-400 text-white p-6 rounded-b-3xl">
        <h1 className="text-2xl mb-2 flex items-center gap-2">
          <Star className="w-7 h-7" />
          دستاوردها
        </h1>
        <p className="text-white/90">پیشرفت و موفقیت‌های شما</p>
      </div>

      {/* Content with conditional blur */}
      <div className="relative">
        <div className={`p-6 space-y-6 ${!state.hasActiveSubscription ? 'blur-sm pointer-events-none' : ''}`}>
          {/* Level Progress */}
          <Card className="rounded-2xl shadow-lg border-2 border-amber-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-500" />
                سطح فعلی
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-amber-400 to-yellow-400 rounded-full flex items-center justify-center mb-3 shadow-lg">
                  <span className="text-white text-2xl">{toPersianDigits((currentLevel.level - 1).toString())}</span>
                </div>
                <h3 className="text-xl mb-1">سطح {toPersianDigits((currentLevel.level - 1).toString())}</h3>
                <p className="text-sm text-gray-600">
                  {pointsNeededForNextLevel > 0 ? 
                    `${formatPersianNumber(pointsNeededForNextLevel)} امتیاز تا سطح بعد` : 
                    'حداکثر سطح!'
                  }
                </p>
              </div>
              
              {pointsNeededForNextLevel > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">پیشرفت</span>
                    <span className="text-sm text-gray-900">
                      {formatPersianNumber(state.totalPoints)} / {formatPersianNumber(nextLevel.required)} امتیاز
                    </span>
                  </div>
                  <Progress value={levelProgress} className="h-3" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Streak Badge */}
          <Card className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-400 to-orange-400 rounded-xl flex items-center justify-center">
                    <Flame className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base">استمرار</h3>
                    <p className="text-sm text-gray-600">{formatPersianNumber(state.streak)} روز متوالی</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-red-100 text-red-700">
                  {formatPersianNumber(state.streak)} روز
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Quick Access Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <Button
              onClick={() => navigate('weekly-league')}
              className="h-16 bg-gradient-to-br from-blue-400 to-indigo-400 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl flex flex-col items-center gap-1"
            >
              <Users className="w-5 h-5" />
              <span className="text-sm">لیگ هفتگی</span>
            </Button>
            <Button
              onClick={() => navigate('global-ranking')}
              className="h-16 bg-gradient-to-br from-green-400 to-emerald-400 hover:from-green-500 hover:to-emerald-500 text-white rounded-2xl flex flex-col items-center gap-1"
            >
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm">رتبه کلی</span>
            </Button>
          </div>

          {/* Medals Summary */}
          <Card className="rounded-2xl shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  مدال‌ها
                </span>
                <Badge variant="outline">
                  {toPersianDigits(earnedMedals.toString())}/{toPersianDigits(totalMedals.toString())}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {medalCategories.map((category) => (
                  <div key={category.id} className="text-center">
                    <div className="text-2xl mb-1">
                      {category.id === 'points' && <Star className="w-6 h-6 text-amber-500 mx-auto" />}
                      {category.id === 'streak' && <Flame className="w-6 h-6 text-red-500 mx-auto" />}
                      {category.id === 'league' && <Users className="w-6 h-6 text-blue-500 mx-auto" />}
                    </div>
                    <div className="text-xs text-gray-600 mb-1">{category.title}</div>
                    <div className="text-xs">
                      {category.medals.filter(m => m.earned).length}/{category.medals.length}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Challenge Medals Notice */}
          <Card className="rounded-2xl shadow-sm bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-orange-500" />
                <h4 className="text-orange-800">مدال‌های چالش</h4>
              </div>
              <p className="text-orange-700 text-sm mb-3">
                مدال‌های مربوط به چالش‌ها را در بخش چالش‌ها مشاهده کنید
              </p>
              <Button
                onClick={() => navigate('challenges')}
                variant="outline"
                size="sm"
                className="border-orange-300 text-orange-700 hover:bg-orange-100"
              >
                مشاهده چالش‌ها
              </Button>
            </CardContent>
          </Card>

          {/* Medals Grid */}
          <div className="space-y-6">
            {medalCategories.map((category) => (
              <div key={category.id}>
                <h3 className="text-lg mb-3 flex items-center gap-2">
                  <span className="text-xl">
                    {category.id === 'points' && <Star className="w-5 h-5 text-amber-500" />}
                    {category.id === 'streak' && <Flame className="w-5 h-5 text-red-500" />}
                    {category.id === 'league' && <Users className="w-5 h-5 text-blue-500" />}
                  </span>
                  مدال‌های {category.title}
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {category.medals.map((medal) => (
                    <Card 
                      key={medal.id} 
                      className={`rounded-xl shadow-sm transition-all ${
                        medal.earned 
                          ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50' 
                          : 'border-gray-200 bg-gray-50 opacity-60'
                      }`}
                    >
                      <CardContent className="p-3 text-center">
                        <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2 ${
                          medal.earned 
                            ? 'bg-gradient-to-br from-amber-400 to-yellow-400' 
                            : 'bg-gray-300'
                        }`}>
                          {medal.earned ? (
                            <Trophy className="w-6 h-6 text-white" />
                          ) : (
                            <Lock className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                        <h4 className="text-xs mb-1">{medal.title}</h4>
                        <p className="text-xs text-gray-600">
                          {typeof medal.requirement === 'string' 
                            ? medal.requirement 
                            : `${medal.requirement} ${category.id === 'points' ? 'امتیاز' : 'روز'}`
                          }
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Overlay for non-subscribers */}
        {!state.hasActiveSubscription && (
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <Card className="rounded-2xl shadow-lg border-0 bg-gradient-to-br from-orange-50 to-amber-50 max-w-sm mx-4">
              <CardContent className="p-8 text-center">
                <div className="w-20 h-20 mx-auto bg-gradient-to-br from-orange-200 to-amber-200 rounded-2xl flex items-center justify-center mb-6">
                  <Lock className="w-10 h-10 text-orange-600" />
                </div>
                <h3 className="text-xl mb-4 text-gray-800">دسترسی محدود</h3>
                <p className="text-gray-600 mb-6 leading-relaxed">
                  برای مشاهده دستاوردها و مدال‌های ویژه، نیاز به اشتراک دارید.
                </p>
                <Button
                  onClick={() => navigate('subscription')}
                  className="w-full bg-gradient-to-r from-orange-400 to-amber-400 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl h-12 shadow-lg"
                >
                  <ShoppingBag className="w-5 h-5 ml-2" />
                  خرید اشتراک
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default AchievementsScreen;