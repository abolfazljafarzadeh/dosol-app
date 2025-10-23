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

// Check if user exists
export const checkUserExists = async (phone: string): Promise<boolean> => {
  try {
    const response = await makeServerRequest('/check-user', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
    
    return response.exists;
  } catch (error) {
    console.error('Check user error:', error);
    return false;
  }
};

// Send OTP to phone number
export const sendOTP = async (phone: string): Promise<{ success: boolean; message: string }> => {
  // Mock implementation for development
  console.log('📱 Mock OTP sent to:', phone);
  console.log('🔐 Mock OTP Code: 123456');
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    success: true,
    message: "کد تأیید ارسال شد"
  };
};

// Verify OTP
export const verifyOTP = async (phone: string, otp: string): Promise<{ 
  success: boolean; 
  userExists: boolean;
  user?: User;
  stats?: UserStats;
  practiceLogs?: PracticeLog[];
  session?: any;
}> => {
  // Mock implementation for development
  console.log('🔐 Verifying OTP:', otp, 'for phone:', phone);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  // Accept demo OTP: 123456
  if (otp !== '123456') {
    return {
      success: false,
      userExists: false,
      message: "کد تأیید نامعتبر است"
    };
  }
  
  // Check if it's a demo existing user (09123456789)
  const isExistingUser = phone === '09123456789';
  
  if (isExistingUser) {
    // Mock existing user data
    const mockUser: User = {
      id: 'demo-user-123',
      firstName: 'علی',
      lastName: 'موسوی',
      phone: phone,
      instrument: 'piano',
      skillLevel: 'intermediate',
      registeredAt: '2024-01-15T10:30:00Z'
    };
    
    const mockStats: UserStats = {
      totalPoints: 1250,
      streak: 7,
      level: 2,
      hasActiveSubscription: true,
      subscriptionExpiryDate: '2025-02-15T00:00:00Z'
    };
    
    const mockLogs: PracticeLog[] = [
      {
        id: '1',
        date: new Date().toISOString().split('T')[0],
        minutes: 45,
        notes: 'تمرین گام‌ها و آرپژ',
        points: 30
      },
      {
        id: '2',
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        minutes: 60,
        notes: 'کار روی قطعه جدید',
        points: 40
      }
    ];
    
    return {
      success: true,
      userExists: true,
      user: mockUser,
      stats: mockStats,
      practiceLogs: mockLogs,
      session: { user: mockUser, access_token: 'mock-token' }
    };
  } else {
    // New user
    return {
      success: true,
      userExists: false
    };
  }
};

// Auth functions
export const registerUser = async (userData: {
  firstName: string;
  lastName: string;
  phone: string;
  instrument: string;
  skillLevel: string;
}): Promise<{ user: User; authUser: any; session?: any; stats?: UserStats; practiceLogs?: PracticeLog[]; userExists?: boolean }> => {
  // Mock implementation for development
  console.log('📝 Mock registering user:', userData);
  
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  const mockUser: User = {
    id: `demo-user-${Date.now()}`,
    firstName: userData.firstName,
    lastName: userData.lastName,
    phone: userData.phone,
    instrument: userData.instrument,
    skillLevel: userData.skillLevel,
    registeredAt: new Date().toISOString()
  };
  
  const mockStats: UserStats = {
    totalPoints: 0,
    streak: 0,
    level: 1,
    hasActiveSubscription: false,
    subscriptionExpiryDate: null
  };
  
  return {
    user: mockUser,
    authUser: mockUser,
    session: { user: mockUser, access_token: 'mock-token' },
    stats: mockStats,
    practiceLogs: [],
    userExists: false
  };
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