import { supabase, makeServerRequest } from './supabase/client';

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  instrument: string;
  skillLevel: string;
  registeredAt: string;
}

export interface PracticeLog {
  id: string;
  date: string;
  minutes: number;
  notes?: string;
  points: number;
}

export interface UserStats {
  totalPoints: number;
  streak: number;
  level: number;
  hasActiveSubscription: boolean;
  subscriptionExpiryDate: string | null;
}

// Auth functions
export const registerUser = async (userData: {
  firstName: string;
  lastName: string;
  phone: string;
  instrument: string;
  skillLevel: string;
}): Promise<{ user: User; authUser: any; session?: any; stats?: UserStats; practiceLogs?: PracticeLog[]; userExists?: boolean }> => {
  try {
    console.log('Starting registration via Edge Function');

    // دریافت session فعلی - supabase خودش session را مدیریت می‌کند
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session?.user) {
      console.error('No active session found');
      throw new Error('نشست کاربری یافت نشد. لطفاً دوباره وارد شوید');
    }

    // فراخوانی Edge Function - Authorization header خودکار توسط supabase اضافه می‌شود
    const { data, error } = await supabase.functions.invoke('register-user', {
      body: { 
        first_name: userData.firstName,
        last_name: userData.lastName || '',
        instrument: userData.instrument,
        level: userData.skillLevel,
        tz: 'Asia/Tehran',
      }
    });

    if (error) {
      console.error('Edge Function error:', error);
      throw new Error('خطا در ثبت‌نام: ' + error.message);
    }

    // دریافت profile به‌روز شده از دیتابیس
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching updated profile:', profileError);
      throw new Error('خطا در دریافت پروفایل');
    }

    // دریافت xp_counter
    const { data: xpCounter } = await supabase
      .from('xp_counters')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();

    const user: User = {
      id: session.user.id,
      firstName: profile.first_name || userData.firstName,
      lastName: profile.last_name || userData.lastName,
      phone: userData.phone,
      instrument: profile.instrument || userData.instrument,
      skillLevel: profile.level || userData.skillLevel,
      registeredAt: profile.created_at || new Date().toISOString(),
    };

    const stats: UserStats = {
      totalPoints: xpCounter?.total_xp || 0,
      streak: xpCounter?.streak || 0,
      level: Math.floor((xpCounter?.total_xp || 0) / 100) + 1,
      hasActiveSubscription: profile.is_premium || false,
      subscriptionExpiryDate: null,
    };

    return {
      user, 
      authUser: session.user, 
      session, 
      stats, 
      practiceLogs: [], 
      userExists: false 
    };
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

export const loginUser = async (phone: string): Promise<{
  user: User;
  stats: UserStats;
  practiceLogs: PracticeLog[];
  authUser: any;
  session: any;
}> => {
  try {
    const response = await makeServerRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    throw new Error(`Login failed: ${error.message}`);
  }
};

export const logoutUser = async (): Promise<void> => {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error('Logout error:', error);
    throw new Error(`Logout failed: ${error.message}`);
  }
};

// Get current session
export const getCurrentSession = async () => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Session error:', error);
      return null;
    }
    
    return session;
  } catch (error) {
    console.error('Get session error:', error);
    return null;
  }
};

// Data functions
export const getUserData = async (userId: string): Promise<{
  user: User;
  stats: UserStats;
  practiceLogs: PracticeLog[];
}> => {
  try {
    const response = await makeServerRequest(`/user/${userId}`);
    return response;
  } catch (error) {
    console.error('Get user data error:', error);
    throw new Error(`Failed to get user data: ${error.message}`);
  }
};

// New backend API functions
export const logPractice = async (practiceData: {
  minutes: number;
  note?: string;
  idempotency_key: string;
}): Promise<{
  ok: boolean;
  xpGained: number;
  xpToday: number;
  streak: { current: number; best: number };
  challenge: { daysDone: number; isCompleted: boolean } | null;
  league: { id: string; xpWeek: number; rank: number | null } | null;
}> => {
  try {
    const { data, error } = await supabase.functions.invoke('log-practice', {
      body: practiceData
    });

    if (error) {
      console.error('Log practice error:', error);
      throw new Error(error.message || 'خطا در ثبت تمرین');
    }

    if (!data || !data.ok) {
      throw new Error(data?.error || 'خطا در ثبت تمرین');
    }
    
    return data;
  } catch (error) {
    console.error('Log practice error:', error);
    throw error;
  }
};

export const getDashboard = async (): Promise<{
  ok: boolean;
  today: { minutes: number; count: number };
  totalXp: number;
  currentStreak: number;
  challenge: any;
  league: any;
  motivationalMessage: string;
}> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-dashboard', {});

    if (error) {
      console.error('Get dashboard error:', error);
      throw new Error(error.message || 'خطا در دریافت داشبورد');
    }

    return data;
  } catch (error) {
    console.error('Get dashboard error:', error);
    throw error;
  }
};

export const getAchievements = async (): Promise<{
  ok: boolean;
  level: { current: number; xpForNextLevel: number; progressPercent: number };
  badges: any[];
  league: any;
}> => {
  try {
    const { data, error } = await supabase.functions.invoke('get-achievements', {});

    if (error) {
      console.error('Get achievements error:', error);
      throw new Error(error.message || 'خطا در دریافت دستاوردها');
    }

    return data;
  } catch (error) {
    console.error('Get achievements error:', error);
    throw error;
  }
};

export const saveTrainingPlan = async (planData: {
  days: number[];
  times: Record<string, boolean>;
  tz?: string;
}): Promise<{ ok: boolean }> => {
  try {
    const { data, error } = await supabase.functions.invoke('save-training-plan', {
      body: planData
    });

    if (error) {
      console.error('Save training plan error:', error);
      throw new Error(error.message || 'خطا در ذخیره برنامه');
    }

    return data;
  } catch (error) {
    console.error('Save training plan error:', error);
    throw error;
  }
};

export const joinWeeklyLeague = async (): Promise<{
  ok: boolean;
  leagueId: string;
  message: string;
}> => {
  try {
    const { data, error } = await supabase.functions.invoke('join-weekly-league', {});

    if (error) {
      console.error('Join league error:', error);
      throw new Error(error.message || 'خطا در پیوستن به لیگ');
    }

    return data;
  } catch (error) {
    console.error('Join league error:', error);
    throw error;
  }
};

// Legacy function - kept for backwards compatibility
export const addPracticeLog = async (
  practiceData: {
    date: string;
    minutes: number;
    notes?: string;
  }
): Promise<{ practiceLog: PracticeLog; stats: UserStats }> => {
  try {
    // فراخوانی Edge Function - Authorization header خودکار توسط supabase اضافه می‌شود
    const { data, error } = await supabase.functions.invoke('submit-practice', {
      body: practiceData
    });

    if (error) {
      console.error('Submit practice error:', error);
      throw new Error(error.message || 'خطا در ثبت تمرین');
    }

    if (!data || !data.ok) {
      throw new Error(data?.error || 'خطا در ثبت تمرین');
    }
    
    return {
      practiceLog: data.practice_log,
      stats: data.stats,
    };
  } catch (error) {
    console.error('Add practice log error:', error);
    throw error;
  }
};

export const updateSubscription = async (
  accessToken: string,
  subscriptionData: {
    hasActiveSubscription: boolean;
    subscriptionExpiryDate?: string | null;
  }
): Promise<{ stats: UserStats }> => {
  try {
    const response = await makeServerRequest('/subscription', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(subscriptionData),
    });
    
    return response;
  } catch (error) {
    console.error('Update subscription error:', error);
    throw new Error(`Failed to update subscription: ${error.message}`);
  }
};

// Migration helper: migrate data from localStorage to Supabase
export const migrateLocalStorageData = async () => {
  try {
    // Get localStorage data
    const savedPracticeLogs = localStorage.getItem('doosell_practice_logs');
    const practiceLogs: PracticeLog[] = savedPracticeLogs ? JSON.parse(savedPracticeLogs) : [];
    
    const hasActiveSubscription = localStorage.getItem('doosell_subscription') === 'active';
    const subscriptionExpiryDate = hasActiveSubscription 
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null;

    // Migrate practice logs
    for (const log of practiceLogs) {
      try {
        await addPracticeLog({
          date: log.date,
          minutes: log.minutes,
          notes: log.notes
        });
      } catch (error) {
        console.error('Failed to migrate practice log:', error);
      }
    }

    // Migrate subscription status
    if (hasActiveSubscription) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          await updateSubscription(session.access_token, {
            hasActiveSubscription,
            subscriptionExpiryDate
          });
        }
      } catch (error) {
        console.error('Failed to migrate subscription:', error);
      }
    }

    // Clear localStorage after successful migration
    localStorage.removeItem('doosell_practice_logs');
    localStorage.removeItem('doosell_subscription');
    localStorage.removeItem('doosell_points');
    localStorage.removeItem('doosell_streak');
    localStorage.removeItem('doosell_level');
    
    console.log('Data migration completed successfully');
  } catch (error) {
    console.error('Data migration failed:', error);
    throw error;
  }
};