import React from 'react';
import { useApp } from '../App';
import { Home, Target, Trophy, MessageCircle, ShoppingBag, Lock } from 'lucide-react';
import { toast } from 'sonner';

const BottomNavigation = () => {
  const { state, navigate } = useApp();

  const tabs = [
    {
      id: 'dashboard',
      label: 'خانه',
      icon: Home,
      requiresSubscription: false,
    },
    {
      id: 'challenges',
      label: 'چالش‌ها',
      icon: Target,
      requiresSubscription: true,
    },
    {
      id: 'achievements',
      label: 'دستاوردها',
      icon: Trophy,
      requiresSubscription: true,
    },
    {
      id: 'assistant',
      label: 'پرسش',
      icon: MessageCircle,
      requiresSubscription: true,
    },
    {
      id: 'storefront',
      label: 'دوره‌ها',
      icon: ShoppingBag,
      requiresSubscription: false,
    }
  ];

  const handleTabClick = (tab: typeof tabs[0]) => {
    // Always allow navigation, but show locked state in UI
    navigate(tab.id);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto z-[60]">
      <div className="bg-white border-t border-gray-200 shadow-lg rounded-t-2xl px-2 py-2">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => {
            const isActive = state.currentPage === tab.id;
            const Icon = tab.icon;
            const isLocked = tab.requiresSubscription && !state.hasActiveSubscription;
            
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`relative flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-colors ${
                  isActive 
                    ? 'bg-gradient-to-br from-orange-100 to-amber-100 text-orange-600' 
                    : isLocked
                    ? 'text-gray-400'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <div className={`transition-transform ${isActive ? 'scale-110' : ''} relative`}>
                  <Icon className="w-5 h-5" />
                  {isLocked && (
                    <div className="absolute -top-1 -right-1">
                      <Lock className="w-3 h-3 text-red-500" />
                    </div>
                  )}
                </div>
                <span className={`text-xs ${isActive ? 'font-medium' : ''}`}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BottomNavigation;