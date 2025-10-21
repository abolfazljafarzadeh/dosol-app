import React, { createContext, useContext, useState, useEffect } from 'react';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
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
  xpToday?: number;
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
import PaymentSuccessScreen from './components/PaymentSuccessScreen';
import PaymentFailedScreen from './components/PaymentFailedScreen';
import PaymentCallbackScreen from './components/PaymentCallbackScreen';
import PaymentCancelScreen from './components/PaymentCancelScreen';
import BottomNavigation from './components/BottomNavigation';
import { AdminDashboardWrapper } from './admin/AdminDashboardWrapper';

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

  // Handle URL hash and path navigation for payment callbacks
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      
      // Handle all hash-based navigation
      if (hash === 'admin') {
        navigate('admin');
      } else if (hash === 'payment-success' || hash === 'payment-failed') {
        navigate(hash);
      } else if (hash === 'phone-input') {
        setState(prev => ({ ...prev, currentPage: 'phone-input', isLoading: false }));
      }
    };

    const handlePathRoute = () => {
      const path = window.location.pathname;
      if (path === '/admin') {
        // Redirect to hash-based routing for better compatibility
        window.location.href = window.location.origin + '/#admin';
        return;
      } else if (path === '/payment/callback') {
        navigate('payment-callback');
      } else if (path === '/payment/cancel') {
        navigate('payment-cancel');
      }
    };

    // Check initial hash and path
    handleHashChange();
    handlePathRoute();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    // Listen for path changes (for SPA navigation)
    window.addEventListener('popstate', handlePathRoute);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handlePathRoute);
    };
  }, []);

  // Set up auth state listener (only once)
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state changed:', event);
      
      if (event === 'SIGNED_OUT') {
        console.log('👋 User signed out, redirecting to login...');
        
        // Clear all local storage
        localStorage.removeItem('doosell_demo_user');
        localStorage.removeItem('doosell_demo_stats');
        localStorage.removeItem('doosell_demo_logs');
        localStorage.removeItem('doosell_demo_practice_logs');
        
        // Force navigate to phone-input immediately
        window.location.hash = 'phone-input';
        
        // Reset state after a small delay to ensure hash change is processed
        setTimeout(() => {
          setState({
            user: null,
            isAuthenticated: false,
            currentPage: 'phone-input',
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
        }, 100);
      }
    });
    
    return () => subscription.unsubscribe();
  }, []); // Run only once on mount

  // Initialize app - simplified for demo mode
  useEffect(() => {
    const initializeApp = async () => {
      // اگر URL فعلی /admin باشد، فوراً به آن برویم
      if (window.location.pathname === '/admin' || window.location.hash === '#admin') {
        setState(prev => ({ ...prev, currentPage: 'admin', isLoading: false }));
        return;
      }
      
      if (state.currentPage !== 'splash') return;
      
      setState(prev => ({ ...prev, isLoading: true }));
      
      try {
        // Check for existing session first
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error('Session error:', sessionError);
          throw sessionError;
        }
        
        // Check for existing user in localStorage (demo mode)
        const savedUser = localStorage.getItem('doosell_demo_user');
        
        if (savedUser && session?.user) {
          const user = JSON.parse(savedUser);
          const practiceLogs = JSON.parse(localStorage.getItem('doosell_demo_practice_logs') || '[]');
          const stats = JSON.parse(localStorage.getItem('doosell_demo_stats') || '{"totalPoints":0,"streak":0,"level":1,"hasActiveSubscription":false,"subscriptionExpiryDate":null}');

          // Fetch latest profile data from database with error handling
          console.log('🔄 Refreshing profile data from database...');
          
          // Use maybeSingle() instead of single() to handle no data gracefully
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          const { data: xpCounter, error: xpError } = await supabase
            .from('xp_counters')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle();

          if (profileError) {
            console.error('Profile fetch error:', profileError);
          }
          if (xpError) {
            console.error('XP counter fetch error:', xpError);
          }

          if (profile) {
            const updatedUser = {
              ...user,
              firstName: profile.first_name || user.firstName || '',
              lastName: profile.last_name || user.lastName || '',
              instrument: profile.instrument || user.instrument || '',
              skillLevel: profile.level || user.skillLevel || '',
            };

            const updatedStats = {
              totalPoints: xpCounter?.total_xp || stats.totalPoints || 0,
              streak: xpCounter?.streak || stats.streak || 0,
              level: Math.floor((xpCounter?.total_xp || 0) / 100) + 1,
              hasActiveSubscription: profile.is_premium || stats.hasActiveSubscription || false,
              subscriptionExpiryDate: stats.subscriptionExpiryDate || null,
            };

            // Update localStorage with fresh data
            localStorage.setItem('doosell_demo_user', JSON.stringify(updatedUser));
            localStorage.setItem('doosell_demo_stats', JSON.stringify(updatedStats));
            
            console.log('✅ Profile data refreshed from database');
            
            setState(prev => ({
              ...prev,
              user: updatedUser,
              isAuthenticated: true,
              currentPage: 'dashboard',
              practicesLogs: practiceLogs,
              totalPoints: updatedStats.totalPoints,
              streak: updatedStats.streak,
              level: updatedStats.level,
              hasActiveSubscription: updatedStats.hasActiveSubscription,
              subscriptionExpiryDate: updatedStats.subscriptionExpiryDate,
              session,
              isLoading: false,
              notificationsEnabled: localStorage.getItem('doosell_notifications') !== 'false',
              practiceFrequency: parseInt(localStorage.getItem('doosell_practice_frequency') || '0'),
              practiceDays: JSON.parse(localStorage.getItem('doosell_practice_days') || '[]'),
              practiceTime: localStorage.getItem('doosell_practice_time') || '20:00',
            }));
          } else {
            // Profile not found, use localStorage data
            console.log('⚠️ Profile not found in database, using localStorage');
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
              notificationsEnabled: localStorage.getItem('doosell_notifications') !== 'false',
              practiceFrequency: parseInt(localStorage.getItem('doosell_practice_frequency') || '0'),
              practiceDays: JSON.parse(localStorage.getItem('doosell_practice_days') || '[]'),
              practiceTime: localStorage.getItem('doosell_practice_time') || '20:00',
            }));
          }
        } else {
          // No valid session or saved user - redirect to login
          console.log('⚠️ No valid session found, redirecting to login');
          localStorage.removeItem('doosell_demo_user');
          localStorage.removeItem('doosell_demo_stats');
          localStorage.removeItem('doosell_demo_logs');
          setState(prev => ({
            ...prev,
            currentPage: 'phone-input',
            isAuthenticated: false,
            session: null,
            isLoading: false,
          }));
        }
      } catch (error) {
        console.error('Error initializing app:', error);
        // On error, redirect to login
        localStorage.removeItem('doosell_demo_user');
        localStorage.removeItem('doosell_demo_stats');
        localStorage.removeItem('doosell_demo_logs');
        setState(prev => ({ 
          ...prev, 
          currentPage: 'phone-input',
          isAuthenticated: false,
          session: null,
          isLoading: false 
        }));
      }
      
      // Add delay for splash screen effect
      setTimeout(() => {
        setState(prev => ({ ...prev, isLoading: false }));
      }, 2000);
    };

    initializeApp();
  }, []); // Run only once on mount

  const renderCurrentPage = () => {
    // Handle admin route
    if (state.currentPage === 'admin') {
      return <AdminDashboardWrapper />;
    }

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
      case 'payment-success':
        return <PaymentSuccessScreen />;
      case 'payment-failed':
        return <PaymentFailedScreen />;
      case 'payment-callback':
        return <PaymentCallbackScreen />;
      case 'payment-cancel':
        return <PaymentCancelScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  const showBottomNav = state.isAuthenticated && !['splash', 'registration', 'phone-input', 'otp-verification', 'user-details', 'subscription', 'settings', 'weekly-league', 'global-ranking', 'practice-history', 'practice-days', 'practice-time', 'payment-success', 'payment-failed', 'payment-callback', 'payment-cancel', 'admin'].includes(state.currentPage);

  return (
    <AppContext.Provider value={{ state, setState, navigate }}>
      {/* Admin layout - full width */}
      {state.currentPage === 'admin' ? (
        <div className="w-full min-h-screen bg-background">
          <AdminDashboardWrapper />
          <Toaster position="top-center" />
        </div>
      ) : (
        /* Mobile app layout - max width container */
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-yellow-50" dir="rtl">
          <div className="max-w-md mx-auto min-h-screen bg-white shadow-lg relative">
            {renderCurrentPage()}
            {showBottomNav && <BottomNavigation />}
          </div>
          <Toaster position="top-center" />
        </div>
      )}
    </AppContext.Provider>
  );
}

export default App;