import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

const supabaseUrl = `https://${projectId}.supabase.co`;

export const supabase = createClient(supabaseUrl, publicAnonKey);

// Helper function for making API calls to our server
export const makeServerRequest = async (path: string, options: RequestInit = {}) => {
  const url = `${supabaseUrl}/functions/v1/make-server-80493cf3${path}`;
  
  const defaultHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Server request failed: ${response.status} ${response.statusText}`, errorText);
    throw new Error(`Server request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
};