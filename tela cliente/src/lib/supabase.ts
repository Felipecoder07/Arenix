import { createClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://placeholder.supabase.co';
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'placeholder-key';

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
