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
    const response = await makeServerRequest('/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    
    return response;
  } catch (error) {
    console.error('Registration error:', error);
    
    // Check if it's a conflict (user exists) error
    if (error.message?.includes('409') || error.message?.includes('Conflict')) {
      throw new Error('User already exists');
    }
    
    throw new Error(`Registration failed: ${error.message}`);
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

export const addPracticeLog = async (
  accessToken: string,
  practiceData: {
    date: string;
    minutes: number;
    notes?: string;
  }
): Promise<{ practiceLog: PracticeLog; stats: UserStats }> => {
  try {
    const response = await makeServerRequest('/practice-log', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(practiceData),
    });
    
    return response;
  } catch (error) {
    console.error('Add practice log error:', error);
    throw new Error(`Failed to add practice log: ${error.message}`);
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
export const migrateLocalStorageData = async (accessToken: string) => {
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
        await addPracticeLog(accessToken, {
          date: log.date,
          minutes: log.minutes,
          notes: log.notes
        });
      } catch (error) {
        console.error('Failed to migrate practice log:', log, error);
      }
    }

    // Migrate subscription status
    if (hasActiveSubscription) {
      try {
        await updateSubscription(accessToken, {
          hasActiveSubscription,
          subscriptionExpiryDate
        });
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