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

// Types
interface User {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  instrument: string;
  skillLevel: string;
  registeredAt: string;
}

interface PracticeLog {
  id: string;
  date: string;
  minutes: number;
  notes?: string;
  points: number;
}

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
  },
  setState: () => {},
  navigate: () => {},
});

// Components
import SplashScreen from './components/SplashScreen';
import RegistrationScreen from './components/RegistrationScreen';
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

  // Supabase session check and authentication
  useEffect(() => {
    const initializeAuth = async () => {
      if (state.currentPage === 'splash') {
        setState(prev => ({ ...prev, isLoading: true }));
        
        try {
          // Check for existing Supabase session
          const session = await getCurrentSession();
          
          if (session?.user) {
            console.log('Found active session:', session.user.id);
            
            // Get user data from server
            const { user, stats, practiceLogs } = await getUserData(session.user.id);
            
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
              session,
              isLoading: false,
              // Load other settings from localStorage (these are local preferences)
              notificationsEnabled: localStorage.getItem('doosell_notifications') !== 'false',
              practiceFrequency: parseInt(localStorage.getItem('doosell_practice_frequency') || '0'),
              practiceDays: JSON.parse(localStorage.getItem('doosell_practice_days') || '[]'),
              practiceTime: localStorage.getItem('doosell_practice_time') || '20:00',
            }));
            
            // Check if we need to migrate localStorage data
            const hasLocalData = localStorage.getItem('doosell_practice_logs') ||
                               localStorage.getItem('doosell_subscription');
            
            if (hasLocalData && session.access_token) {
              try {
                console.log('Migrating localStorage data to Supabase...');
                await migrateLocalStorageData(session.access_token);
                toast.success('داده‌های محلی با موفقیت منتقل شدند');
                
                // Refresh user data after migration
                const { user: updatedUser, stats: updatedStats, practiceLogs: updatedLogs } = await getUserData(session.user.id);
                setState(prev => ({
                  ...prev,
                  user: updatedUser,
                  practicesLogs: updatedLogs,
                  totalPoints: updatedStats.totalPoints,
                  streak: updatedStats.streak,
                  level: updatedStats.level,
                  hasActiveSubscription: updatedStats.hasActiveSubscription,
                  subscriptionExpiryDate: updatedStats.subscriptionExpiryDate,
                }));
              } catch (migrationError) {
                console.error('Migration failed:', migrationError);
                toast.error('خطا در انتقال داده‌ها');
              }
            }
          } else {
            // No session, check localStorage for backwards compatibility
            const savedUser = localStorage.getItem('doosell_user');
            if (savedUser) {
              console.log('Found localStorage user, redirecting to registration to migrate');
              setState(prev => ({ 
                ...prev, 
                currentPage: 'registration',
                isLoading: false 
              }));
            } else {
              setState(prev => ({ 
                ...prev, 
                currentPage: 'registration',
                isLoading: false 
              }));
            }
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          setState(prev => ({ 
            ...prev, 
            currentPage: 'registration',
            isLoading: false 
          }));
        }
        
        // Add delay for splash screen effect
        setTimeout(() => {
          setState(prev => ({ ...prev, isLoading: false }));
        }, 2000);
      }
    };

    initializeAuth();
  }, [state.currentPage]);

  const renderCurrentPage = () => {
    switch (state.currentPage) {
      case 'splash':
        return <SplashScreen />;
      case 'registration':
        return <RegistrationScreen />;
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

  const showBottomNav = state.isAuthenticated && !['splash', 'registration', 'subscription', 'settings', 'weekly-league', 'global-ranking', 'practice-history', 'practice-days', 'practice-time'].includes(state.currentPage);

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