import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vaotmawzmlbzngsnogup.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZhb3RtYXd6bWxiem5nc25vZ3VwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgxMzE0MTMsImV4cCI6MjA5MzcwNzQxM30.AFKeXPtX_IlDA_5cqtSroM7Qt65RZdRJIErpUH9syVA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'moment-in-calendar-auth',
    flowType: 'pkce'
  },
  global: {
    headers: {
      'X-Client-Info': 'moment-in-calendar@1.0'
    }
  }
});
