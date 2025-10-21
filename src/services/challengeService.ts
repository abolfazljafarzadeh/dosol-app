import { supabase } from "@/integrations/supabase/client";
import { GetChallengesViewResponse, ClaimChallengeRewardResponse } from "@/types/backend";

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
 */
async function callEdge<T>(fnName: string, body?: any): Promise<T> {
  // Get current session for authorization
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session?.access_token) {
    console.error('❌ No valid session for edge function call');
    throw new Error('AUTH_REQUIRED');
  }

  const invoke = async () => {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${fnName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: body ? JSON.stringify(body) : undefined,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Edge function error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  };
  
  let data, error;
  
  try {
    data = await invoke();
  } catch (err: any) {
    error = err;
  }

  // Detect 401
  const is401 = error?.message?.includes('401') || /unauthorized/i.test(error?.message || '');

  if (is401) {
    console.log('🔄 401 detected, attempting refresh...');
    const { error: refreshErr } = await supabase.auth.refreshSession();
    
    if (!refreshErr) {
      console.log('✅ Session refreshed, retrying request...');
      
      // Get new session after refresh
      const { data: { session: newSession } } = await supabase.auth.getSession();
      
      if (newSession?.access_token) {
        try {
          data = await invoke();
          error = null;
        } catch (retryErr: any) {
          error = retryErr;
        }
      }
    } else {
      console.error('❌ Refresh failed:', refreshErr);
      await supabase.auth.signOut();
      throw new Error('SESSION_EXPIRED');
    }
  }

  if (error) {
    throw error;
  }

  return data as T;
}

/**
 * Fetch all challenges for the current user
 * Returns active, claimable, and upcoming challenges
 */
export const getChallengesView = async (): Promise<GetChallengesViewResponse> => {
  try {
    const data = await callEdge<GetChallengesViewResponse>('get-challenges-view');

    if (!data || data.ok === false) {
      console.warn('getChallengesView returned error:', data);
      return {
        ok: false,
        currentWeek: { start: '', end: '' },
        active: [],
        claimable: [],
        upcoming: [],
        error: data?.error || 'خطا در دریافت چالش‌ها',
        ...(data as any) // preserve error code if exists
      };
    }

    return data;
  } catch (error: any) {
    console.error('Exception in getChallengesView:', error);
    
    // Re-throw auth errors for UI handling
    if (error.message === 'AUTH_REQUIRED' || error.message === 'SESSION_EXPIRED') {
      throw error;
    }

    return {
      ok: false,
      currentWeek: { start: '', end: '' },
      active: [],
      claimable: [],
      upcoming: [],
      error: error.message || 'خطای غیرمنتظره'
    };
  }
};

/**
 * Claim reward for a completed challenge
 * @param instanceId - The challenge instance ID to claim
 */
export const claimChallengeReward = async (
  instanceId: string
): Promise<ClaimChallengeRewardResponse> => {
  try {
    const data = await callEdge<ClaimChallengeRewardResponse>('claim-challenge-reward', {
      instanceId
    });

    if (!data || data.ok === false) {
      return {
        ok: false,
        error: data?.error || 'خطا در دریافت پاداش'
      };
    }

    return data;
  } catch (error: any) {
    console.error('Exception in claimChallengeReward:', error);
    
    // Re-throw auth errors
    if (error.message === 'AUTH_REQUIRED' || error.message === 'SESSION_EXPIRED') {
      throw error;
    }

    return {
      ok: false,
      error: error.message || 'خطای غیرمنتظره'
    };
  }
};
