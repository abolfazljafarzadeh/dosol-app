import React, { createContext, useContext, useState, useEffect } from 'react';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner@2.0.3';
import { 
  getCurrentSession,
  getUserData,
  migrateLocalStorageData,
  User,
  PracticeLog,
  UserStats
} from './utils/api';

// Import Persian font
const fontUrl = 'https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700&display=swap';

// Types (imported from utils/api)

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  currentPage: string;
  practicesLogs: PracticeLog[];
  totalPoints: number;
  streak: number;
  level: number;
  hasActiveSubscription: boolean;
  subscriptionExpiryDate: string | null;
  notificationsEnabled: boolean;
  practiceFrequency: number;
  practiceDays: string[];
  practiceTime: string;
  session: any | null;
  isLoading: boolean;
  tempPhone?: string; // برای ذخیره موقت شماره تلفن در حین ثبت‌نام
}

// Context
const AppContext = createContext<{
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  navigate: (page: string) => void;
}>({
  state: {
    user: null,
    isAuthenticated: false,
    currentPage: 'splash',
    practicesLogs: [],
    totalPoints: 0,
    streak: 0,
    level: 1,
    hasActiveSubscription: false,
    subscriptionExpiryDate: null,
    notificationsEnabled: true,
    practiceFrequency: 0,
    practiceDays: [],
    practiceTime: '20:00',
    session: null,
    isLoading: false,
    tempPhone: undefined,
  },
  setState: () => {},
  navigate: () => {},
});

// Components
import SplashScreen from './components/SplashScreen';
import RegistrationScreen from './components/RegistrationScreen';
import PhoneInputScreen from './components/PhoneInputScreen';
import OtpVerificationScreen from './components/OtpVerificationScreen';
import UserDetailsScreen from './components/UserDetailsScreen';
import DashboardScreen from './components/DashboardScreen';
import PracticeLogScreen from './components/PracticeLogScreen';
import ChallengesScreen from './components/ChallengesScreen';
import AchievementsScreen from './components/AchievementsScreen';
import AssistantScreen from './components/AssistantScreen';
import StorefrontScreen from './components/StorefrontScreen';
import SubscriptionScreen from './components/SubscriptionScreen';
import SettingsScreen from './components/SettingsScreen';
import WeeklyLeagueScreen from './components/WeeklyLeagueScreen';
import GlobalRankingScreen from './components/GlobalRankingScreen';
import PracticeHistoryScreen from './components/PracticeHistoryScreen';
import PracticeDaysScreen from './components/PracticeDaysScreen';
import PracticeTimeScreen from './components/PracticeTimeScreen';
import BottomNavigation from './components/BottomNavigation';

export const useApp = () => useContext(AppContext);

function App() {
  const [state, setState] = useState<AppState>({
    user: null,
    isAuthenticated: false,
    currentPage: 'splash',
    practicesLogs: [],
    totalPoints: 0,
    streak: 0,
    level: 1,
    hasActiveSubscription: false,
    subscriptionExpiryDate: null,
    notificationsEnabled: true,
    practiceFrequency: 0,
    practiceDays: [],
    practiceTime: '20:00',
    session: null,
    isLoading: false,
    tempPhone: undefined,
  });

  const navigate = (page: string) => {
    setState(prev => ({ ...prev, currentPage: page }));
  };

  // Load font
  useEffect(() => {
    const link = document.createElement('link');
    link.href = fontUrl;
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    // Set RTL and font on body
    document.body.dir = 'rtl';
    document.body.style.fontFamily = 'Vazirmatn, system-ui, sans-serif';
    
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  // Initialize app - simplified for demo mode
  useEffect(() => {
    const initializeApp = async () => {
      if (state.currentPage === 'splash') {
        setState(prev => ({ ...prev, isLoading: true }));
        
        // Check for existing user in localStorage (demo mode)
        const savedUser = localStorage.getItem('doosell_demo_user');
        if (savedUser) {
          try {
            const user = JSON.parse(savedUser);
            const practiceLogs = JSON.parse(localStorage.getItem('doosell_demo_practice_logs') || '[]');
            const stats = JSON.parse(localStorage.getItem('doosell_demo_stats') || '{"totalPoints":0,"streak":0,"level":1,"hasActiveSubscription":false,"subscriptionExpiryDate":null}');
            
            setState(prev => ({
              ...prev,
              user,
              isAuthenticated: true,
              currentPage: 'dashboard',
              practicesLogs: practiceLogs,
              totalPoints: stats.totalPoints,
              streak: stats.streak,
              level: stats.level,
              hasActiveSubscription: stats.hasActiveSubscription,
              subscriptionExpiryDate: stats.subscriptionExpiryDate,
              session: { user, access_token: 'demo-token' },
              isLoading: false,
              notificationsEnabled: localStorage.getItem('doosell_notifications') !== 'false',
              practiceFrequency: parseInt(localStorage.getItem('doosell_practice_frequency') || '0'),
              practiceDays: JSON.parse(localStorage.getItem('doosell_practice_days') || '[]'),
              practiceTime: localStorage.getItem('doosell_practice_time') || '20:00',
            }));
          } catch (error) {
            console.error('Error loading demo user:', error);
            setState(prev => ({ 
              ...prev, 
              currentPage: 'phone-input',
              isLoading: false 
            }));
          }
        } else {
          setState(prev => ({ 
            ...prev, 
            currentPage: 'phone-input',
            isLoading: false 
          }));
        }
        
        // Add delay for splash screen effect
        setTimeout(() => {
          setState(prev => ({ ...prev, isLoading: false }));
        }, 2000);
      }
    };

    initializeApp();
  }, [state.currentPage]);

  const renderCurrentPage = () => {
    switch (state.currentPage) {
      case 'splash':
        return <SplashScreen />;
      case 'registration':
        return <RegistrationScreen />;
      case 'phone-input':
        return <PhoneInputScreen />;
      case 'otp-verification':
        return <OtpVerificationScreen />;
      case 'user-details':
        return <UserDetailsScreen />;
      case 'dashboard':
        return <DashboardScreen />;
      case 'practice-log':
        return <PracticeLogScreen />;
      case 'challenges':
        return <ChallengesScreen />;
      case 'achievements':
        return <AchievementsScreen />;
      case 'assistant':
        return <AssistantScreen />;
      case 'storefront':
        return <StorefrontScreen />;
      case 'subscription':
        return <SubscriptionScreen />;
      case 'settings':
        return <SettingsScreen />;
      case 'weekly-league':
        return <WeeklyLeagueScreen />;
      case 'global-ranking':
        return <GlobalRankingScreen />;
      case 'practice-history':
        return <PracticeHistoryScreen />;
      case 'practice-days':
        return <PracticeDaysScreen />;
      case 'practice-time':
        return <PracticeTimeScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  const showBottomNav = state.isAuthenticated && !['splash', 'registration', 'phone-input', 'otp-verification', 'user-details', 'subscription', 'settings', 'weekly-league', 'global-ranking', 'practice-history', 'practice-days', 'practice-time'].includes(state.currentPage);

  return (
    <AppContext.Provider value={{ state, setState, navigate }}>
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50" dir="rtl">
        <div className="max-w-md mx-auto min-h-screen bg-white shadow-lg relative">
          {renderCurrentPage()}
          {showBottomNav && <BottomNavigation />}
        </div>
        <Toaster position="top-center" />
      </div>
    </AppContext.Provider>
  );
}

export default App;