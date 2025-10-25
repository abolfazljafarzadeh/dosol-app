import React from 'react';
import doosellLogo from 'figma:asset/b58b06cddb1628092c6db84c1360a4a9e7aca31b.png';

const SplashScreen = () => {
  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-orange-400 via-amber-400 to-yellow-400">
      <div className="text-center">
        <div className="mb-8">
          <div className="w-32 h-32 mx-auto bg-white rounded-3xl shadow-2xl flex items-center justify-center mb-6 p-4">
            <img 
              src={doosellLogo} 
              alt="دوسل" 
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-white text-4xl mb-3">دوسل</h1>
          <p className="text-white/95 text-xl mb-2">هم‌ریتم موزیسین‌ها</p>
          <p className="text-white/80 text-base">همراه تمرین موسیقی</p>
        </div>
        
        <div className="flex justify-center">
          <div className="w-8 h-8 rounded-full bg-white/30 animate-pulse"></div>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;