// Unified Backend API Layer
// All Edge Function calls go through this layer with Auth Guards & 401 Retry

import { supabase } from '@/integrations/supabase/client';
import type {
  LogPracticeResponse,
  DashboardResponse,
  AchievementsResponse,
  SaveTrainingPlanResponse,
} from '@/types/backend';

/**
 * Assert that user has valid session before API calls
 * Throws AUTH_REQUIRED if no valid session
 */
async function assertAuth(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user?.id) {
    throw new Error('AUTH_REQUIRED');
  }
}

/**
 * Unified Edge Function caller with Auth Guard & 401 Retry
 * - Checks auth before invoke
 * - Detects 401 and attempts refresh + retry once
 * - Throws error if retry fails
 */
async function callEdge<T>(fnName: string, body?: any): Promise<T> {
  // Guard: Ensure valid session
  await assertAuth();

  // Helper to invoke function
  const invoke = () => supabase.functions.invoke(fnName, body ? { body } : undefined);

  // First attempt
  let { data, error } = await invoke();

  // Detect 401 (check status and message)
  const status = (error as any)?.status ?? (error as any)?.context?.response?.status;
  const is401 = status === 401 || /unauthorized/i.test(error?.message || '');

  if (is401) {
    console.log('🔄 401 detected, attempting refresh...');
    
    // Attempt to refresh session
    const { error: refreshErr } = await supabase.auth.refreshSession();
    
    if (!refreshErr) {
      // Retry the request with refreshed session
      console.log('✅ Session refreshed, retrying request...');
      const retried = await invoke();
      data = retried.data;
      error = retried.error;
    } else {
      console.error('❌ Refresh failed:', refreshErr);
      // Refresh failed - sign out user
      await supabase.auth.signOut();
      throw new Error('SESSION_EXPIRED');
    }
  }

  // If still error after retry, throw it with detailed debugging info
  if (error) {
    const status = (error as any)?.status ?? (error as any)?.context?.response?.status;
    const body = (error as any)?.context?.response?.body;
    console.error('❌ Edge error:', { fnName, status, rawError: error, body });
    
    // Create enhanced error with status and body
    const enhancedError = Object.assign(
      new Error(body?.error || body?.message || error.message || 'EDGE_ERROR'),
      { status, body }
    );
    throw enhancedError;
  }

  return data as T;
}

/**
 * Log a practice session
 * Calls the log-practice Edge Function which invokes rpc_log_practice
 */
export const logPractice = async (params: {
  minutes: number;
  note?: string;
  idempotencyKey?: string;
}): Promise<LogPracticeResponse> => {
  try {
    const data = await callEdge<LogPracticeResponse>('log-practice', {
      minutes: params.minutes,
      note: params.note || null,
      idempotency_key: params.idempotencyKey || crypto.randomUUID(),
    });

    if (!data || data.ok === false) {
      return {
        ok: false,
        code: data?.code || 'UNKNOWN_ERROR',
        message: data?.message || 'خطای ناشناخته',
      };
    }

    return data;
  } catch (error: any) {
    console.error('logPractice error:', error);
    
    // Re-throw auth errors for UI handling
    if (error.message === 'AUTH_REQUIRED' || error.message === 'SESSION_EXPIRED') {
      throw error;
    }

    return {
      ok: false,
      code: 'EXCEPTION',
      message: error.message || 'خطای غیرمنتظره',
    };
  }
};

/**
 * Get dashboard data
 * Calls the get-dashboard Edge Function which invokes rpc_get_dashboard
 */
export const getDashboard = async (): Promise<DashboardResponse> => {
  try {
    const data = await callEdge<DashboardResponse>('get-dashboard');

    if (!data || data.ok === false) {
      return {
        ok: false,
        error: data?.error || 'خطا در دریافت داشبورد',
      };
    }

    return data;
  } catch (error: any) {
    console.error('getDashboard error:', error);
    
    // Re-throw auth errors
    if (error.message === 'AUTH_REQUIRED' || error.message === 'SESSION_EXPIRED') {
      throw error;
    }

    return {
      ok: false,
      error: error.message || 'خطای غیرمنتظره',
    };
  }
};

/**
 * Get achievements data
 * Calls the get-achievements Edge Function which invokes rpc_get_achievements
 */
export const getAchievements = async (): Promise<AchievementsResponse> => {
  try {
    const data = await callEdge<AchievementsResponse>('get-achievements');

    if (!data || data.ok === false) {
      return {
        ok: false,
        error: data?.error || 'خطا در دریافت دستاوردها',
      };
    }

    return data;
  } catch (error: any) {
    console.error('getAchievements error:', error);
    
    // Re-throw auth errors
    if (error.message === 'AUTH_REQUIRED' || error.message === 'SESSION_EXPIRED') {
      throw error;
    }

    return {
      ok: false,
      error: error.message || 'خطای غیرمنتظره',
    };
  }
};

/**
 * Save training plan (days, times, timezone)
 * Calls the save-training-plan Edge Function which invokes rpc_save_training_plan
 */
export const saveTrainingPlan = async (params: {
  days: number[];
  times?: Record<string, boolean>;
  tz?: string;
}): Promise<SaveTrainingPlanResponse> => {
  try {
    const data = await callEdge<SaveTrainingPlanResponse>('save-training-plan', {
      days: params.days,
      times: params.times || null,
      tz: params.tz || 'Asia/Tehran',
    });

    if (!data || data.ok === false) {
      return {
        ok: false,
        error: data?.error || 'خطا در ذخیره برنامه تمرین',
      };
    }

    return { ok: true };
  } catch (error: any) {
    console.error('saveTrainingPlan error:', error);
    
    // Re-throw auth errors
    if (error.message === 'AUTH_REQUIRED' || error.message === 'SESSION_EXPIRED') {
      throw error;
    }

    return {
      ok: false,
      error: error.message || 'خطای غیرمنتظره',
    };
  }
};

/**
 * Get user notifications (last 7 days, max 20)
 */
export const getNotifications = async (): Promise<any[]> => {
  try {
    await assertAuth();
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(20);
    
    if (error) {
      console.error('getNotifications error:', error);
      return [];
    }
    
    return data || [];
  } catch (error: any) {
    console.error('getNotifications error:', error);
    
    if (error.message === 'AUTH_REQUIRED' || error.message === 'SESSION_EXPIRED') {
      throw error;
    }
    
    return [];
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (notificationId: string): Promise<boolean> => {
  try {
    await assertAuth();
    
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId);
    
    if (error) {
      console.error('markNotificationAsRead error:', error);
      return false;
    }
    
    return true;
  } catch (error: any) {
    console.error('markNotificationAsRead error:', error);
    return false;
  }
};
