import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Create a placeholder client that will fail gracefully if credentials are missing
let supabaseInstance: SupabaseClient;

if (supabaseUrl && supabaseAnonKey) {
  supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
} else {
  console.warn('Supabase credentials not configured. Some features will not work.');
  // Create a mock client for development - will show errors but won't crash
  supabaseInstance = createClient(
    'https://placeholder.supabase.co',
    'placeholder-key'
  );
}

export const supabase = supabaseInstance;
