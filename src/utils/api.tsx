import { supabase } from './supabase/client';
import { projectId } from './supabase/info';

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

const SUPABASE_URL = `https://${projectId}.supabase.co`;

// =============================================
// OTP Functions (استفاده از کاوه‌نگار)
// =============================================

/**
 * ارسال کد OTP به شماره موبایل
 */
export const sendOTP = async (phone: string): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('📱 Sending OTP to:', phone);
    
    // فراخوانی Edge Function برای ارسال OTP
    const { data, error } = await supabase.functions.invoke('send-otp', {
      body: { phone }
    });

    if (error) {
      console.error('❌ Send OTP error:', error);
      return {
        success: false,
        message: error.message || 'خطا در ارسال کد تأیید'
      };
    }

    if (data?.error) {
      console.error('❌ Send OTP failed:', data.error);
      return {
        success: false,
        message: data.error
      };
    }

    console.log('✅ OTP sent successfully');
    return {
      success: true,
      message: 'کد تأیید ارسال شد'
    };
  } catch (error: any) {
    console.error('❌ Send OTP exception:', error);
    return {
      success: false,
      message: error.message || 'خطا در ارسال کد تأیید'
    };
  }
};

/**
 * تأیید کد OTP
 */
export const verifyOTP = async (phone: string, otp: string): Promise<{ 
  success: boolean; 
  userExists: boolean;
  user?: User;
  stats?: UserStats;
  practiceLogs?: PracticeLog[];
  session?: any;
  message?: string;
}> => {
  try {
    console.log('🔐 Verifying OTP for phone:', phone);
    
    // فراخوانی Edge Function برای تأیید OTP
    const { data, error } = await supabase.functions.invoke('verify-otp', {
      body: { phone, code: otp }
    });

    if (error) {
      console.error('❌ Verify OTP error:', error);
      return {
        success: false,
        userExists: false,
        message: error.message || 'خطا در تأیید کد'
      };
    }

    if (data?.error) {
      console.error('❌ Verify OTP failed:', data.error);
      return {
        success: false,
        userExists: false,
        message: data.error
      };
    }

    if (!data?.success) {
      return {
        success: false,
        userExists: false,
        message: 'کد تأیید نامعتبر است'
      };
    }

    console.log('✅ OTP verified successfully');

    // بررسی وجود کاربر در دیتابیس
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*, user_stats(*)')
      .eq('phone', phone)
      .single();

    if (userError && userError.code !== 'PGRST116') {
      // PGRST116 means no rows returned
      console.error('❌ User lookup error:', userError);
      throw userError;
    }

    if (!userData) {
      // کاربر جدید است
      console.log('👤 New user detected');
      return {
        success: true,
        userExists: false
      };
    }

    // کاربر موجود است - بارگذاری اطلاعات کامل
    console.log('👤 Existing user found');

    // دریافت لاگ‌های تمرین
    const { data: practiceLogsData, error: logsError } = await supabase
      .from('practice_logs')
      .select('*')
      .eq('user_id', userData.id)
      .order('date', { ascending: false })
      .limit(30);

    if (logsError) {
      console.error('⚠️ Practice logs error:', logsError);
    }

    const user: User = {
      id: userData.id,
      firstName: userData.first_name,
      lastName: userData.last_name,
      phone: userData.phone,
      instrument: userData.instrument,
      skillLevel: userData.skill_level,
      registeredAt: userData.created_at
    };

    const stats: UserStats = {
      totalPoints: userData.user_stats?.total_points || 0,
      streak: userData.user_stats?.streak || 0,
      level: userData.user_stats?.level || 1,
      hasActiveSubscription: userData.user_stats?.has_active_subscription || false,
      subscriptionExpiryDate: userData.user_stats?.subscription_expiry_date || null
    };

    const practiceLogs: PracticeLog[] = (practiceLogsData || []).map(log => ({
      id: log.id,
      date: log.date,
      minutes: log.minutes,
      notes: log.notes,
      points: log.points
    }));

    // ایجاد session برای کاربر
    const session = {
      user: { id: userData.id },
      access_token: 'authenticated'
    };

    return {
      success: true,
      userExists: true,
      user,
      stats,
      practiceLogs,
      session
    };
  } catch (error: any) {
    console.error('❌ Verify OTP exception:', error);
    return {
      success: false,
      userExists: false,
      message: error.message || 'خطا در تأیید کد'
    };
  }
};

// =============================================
// User Management
// =============================================

/**
 * ثبت‌نام کاربر جدید
 */
export const registerUser = async (userData: {
  firstName: string;
  lastName: string;
  phone: string;
  instrument: string;
  skillLevel: string;
}): Promise<{ 
  user: User; 
  authUser: any; 
  session?: any; 
  stats?: UserStats; 
  practiceLogs?: PracticeLog[]; 
  userExists?: boolean 
}> => {
  try {
    console.log('📝 Registering new user:', userData.phone);

    // ایجاد کاربر جدید
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert({
        phone: userData.phone,
        first_name: userData.firstName,
        last_name: userData.lastName,
        instrument: userData.instrument,
        skill_level: userData.skillLevel
      })
      .select()
      .single();

    if (userError) {
      console.error('❌ User registration error:', userError);
      throw new Error(`ثبت‌نام ناموفق: ${userError.message}`);
    }

    console.log('✅ User created:', newUser.id);

    // ایجاد آمار اولیه برای کاربر
    const { data: newStats, error: statsError } = await supabase
      .from('user_stats')
      .insert({
        user_id: newUser.id,
        total_points: 0,
        streak: 0,
        level: 1,
        has_active_subscription: false,
        subscription_expiry_date: null
      })
      .select()
      .single();

    if (statsError) {
      console.error('❌ Stats creation error:', statsError);
      // Don't throw, just log
    }

    const user: User = {
      id: newUser.id,
      firstName: newUser.first_name,
      lastName: newUser.last_name,
      phone: newUser.phone,
      instrument: newUser.instrument,
      skillLevel: newUser.skill_level,
      registeredAt: newUser.created_at
    };

    const stats: UserStats = {
      totalPoints: 0,
      streak: 0,
      level: 1,
      hasActiveSubscription: false,
      subscriptionExpiryDate: null
    };

    const session = {
      user: { id: newUser.id },
      access_token: 'authenticated'
    };

    return {
      user,
      authUser: user,
      session,
      stats,
      practiceLogs: [],
      userExists: false
    };
  } catch (error: any) {
    console.error('❌ Registration exception:', error);
    throw new Error(`خطا در ثبت‌نام: ${error.message}`);
  }
};

/**
 * خروج کاربر
 */
export const logoutUser = async (): Promise<void> => {
  try {
    await supabase.auth.signOut();
  } catch (error: any) {
    console.error('Logout error:', error);
    throw new Error(`خطا در خروج: ${error.message}`);
  }
};

/**
 * دریافت اطلاعات کاربر
 */
export const getUserData = async (userId: string): Promise<{
  user: User;
  stats: UserStats;
  practiceLogs: PracticeLog[];
}> => {
  try {
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*, user_stats(*)')
      .eq('id', userId)
      .single();

    if (userError) {
      throw userError;
    }

    const { data: practiceLogsData, error: logsError } = await supabase
      .from('practice_logs')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(30);

    if (logsError) {
      console.error('Practice logs error:', logsError);
    }

    const user: User = {
      id: userData.id,
      firstName: userData.first_name,
      lastName: userData.last_name,
      phone: userData.phone,
      instrument: userData.instrument,
      skillLevel: userData.skill_level,
      registeredAt: userData.created_at
    };

    const stats: UserStats = {
      totalPoints: userData.user_stats?.total_points || 0,
      streak: userData.user_stats?.streak || 0,
      level: userData.user_stats?.level || 1,
      hasActiveSubscription: userData.user_stats?.has_active_subscription || false,
      subscriptionExpiryDate: userData.user_stats?.subscription_expiry_date || null
    };

    const practiceLogs: PracticeLog[] = (practiceLogsData || []).map(log => ({
      id: log.id,
      date: log.date,
      minutes: log.minutes,
      notes: log.notes,
      points: log.points
    }));

    return {
      user,
      stats,
      practiceLogs
    };
  } catch (error: any) {
    console.error('Get user data error:', error);
    throw new Error(`خطا در دریافت اطلاعات: ${error.message}`);
  }
};

// =============================================
// Practice Logs
// =============================================

/**
 * ثبت لاگ تمرین
 */
export const addPracticeLog = async (
  userId: string,
  practiceData: {
    date: string;
    minutes: number;
    notes?: string;
  }
): Promise<{ practiceLog: PracticeLog; stats: UserStats }> => {
  try {
    const points = Math.floor(practiceData.minutes / 15) * 10; // هر 15 دقیقه = 10 امتیاز

    const { data: newLog, error: logError } = await supabase
      .from('practice_logs')
      .insert({
        user_id: userId,
        date: practiceData.date,
        minutes: practiceData.minutes,
        notes: practiceData.notes,
        points: points
      })
      .select()
      .single();

    if (logError) {
      throw logError;
    }

    // به‌روزرسانی امتیازات کاربر
    const { data: currentStats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    const newTotalPoints = (currentStats?.total_points || 0) + points;
    const newLevel = Math.floor(newTotalPoints / 500) + 1; // هر 500 امتیاز = 1 سطح

    // محاسبه استمرار
    const { data: recentLogs } = await supabase
      .from('practice_logs')
      .select('date')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(30);

    let newStreak = 1;
    if (recentLogs && recentLogs.length > 1) {
      const dates = recentLogs.map(log => new Date(log.date));
      dates.sort((a, b) => b.getTime() - a.getTime());
      
      for (let i = 0; i < dates.length - 1; i++) {
        const diff = Math.floor((dates[i].getTime() - dates[i + 1].getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
          newStreak++;
        } else {
          break;
        }
      }
    }

    const { data: updatedStats, error: statsError } = await supabase
      .from('user_stats')
      .update({
        total_points: newTotalPoints,
        level: newLevel,
        streak: newStreak
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (statsError) {
      console.error('Stats update error:', statsError);
    }

    const practiceLog: PracticeLog = {
      id: newLog.id,
      date: newLog.date,
      minutes: newLog.minutes,
      notes: newLog.notes,
      points: newLog.points
    };

    const stats: UserStats = {
      totalPoints: updatedStats?.total_points || newTotalPoints,
      streak: updatedStats?.streak || newStreak,
      level: updatedStats?.level || newLevel,
      hasActiveSubscription: updatedStats?.has_active_subscription || false,
      subscriptionExpiryDate: updatedStats?.subscription_expiry_date || null
    };

    return {
      practiceLog,
      stats
    };
  } catch (error: any) {
    console.error('Add practice log error:', error);
    throw new Error(`خطا در ثبت تمرین: ${error.message}`);
  }
};

/**
 * به‌روزرسانی اشتراک
 */
export const updateSubscription = async (
  userId: string,
  subscriptionData: {
    hasActiveSubscription: boolean;
    subscriptionExpiryDate?: string | null;
  }
): Promise<{ stats: UserStats }> => {
  try {
    const { data: updatedStats, error } = await supabase
      .from('user_stats')
      .update({
        has_active_subscription: subscriptionData.hasActiveSubscription,
        subscription_expiry_date: subscriptionData.subscriptionExpiryDate
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    const stats: UserStats = {
      totalPoints: updatedStats.total_points,
      streak: updatedStats.streak,
      level: updatedStats.level,
      hasActiveSubscription: updatedStats.has_active_subscription,
      subscriptionExpiryDate: updatedStats.subscription_expiry_date
    };

    return { stats };
  } catch (error: any) {
    console.error('Update subscription error:', error);
    throw new Error(`خطا در به‌روزرسانی اشتراک: ${error.message}`);
  }
};

// =============================================
// Helper Functions
// =============================================

/**
 * بررسی وجود کاربر
 */
export const checkUserExists = async (phone: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('phone', phone)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Check user error:', error);
      return false;
    }

    return !!data;
  } catch (error) {
    console.error('Check user exception:', error);
    return false;
  }
};

/**
 * دریافت session فعلی
 */
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
