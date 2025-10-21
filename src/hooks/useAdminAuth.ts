import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useAdminAuth(onUnauthorized?: () => void) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    async function checkAdminStatus() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.user) {
          console.log('❌ No session found');
          setHasSession(false);
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }

        setHasSession(true);

        // استفاده از تابع has_role برای چک کردن نقش admin
        const { data, error } = await supabase.rpc('has_role', {
          _user_id: session.user.id,
          _role: 'admin'
        });

        if (error) {
          console.error('❌ Error checking admin role:', error);
          setIsAdmin(false);
          setIsLoading(false);
          if (onUnauthorized) onUnauthorized();
          return;
        }

        if (!data) {
          console.log('❌ User is not admin');
          setIsAdmin(false);
          setIsLoading(false);
          if (onUnauthorized) onUnauthorized();
          return;
        }

        console.log('✅ User is admin, granting access');
        setIsAdmin(true);
        setIsLoading(false);
      } catch (error) {
        console.error('❌ Error in admin auth check:', error);
        setIsAdmin(false);
        setHasSession(false);
        setIsLoading(false);
        if (onUnauthorized) onUnauthorized();
      }
    }

    checkAdminStatus();
  }, [onUnauthorized]);

  return { isAdmin, isLoading, hasSession };
}
