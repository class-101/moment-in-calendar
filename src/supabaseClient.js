import { createClient } from '@supabase/supabase-js';

// ⚠️ Supabase 새 키 시스템 (publishable key)
// Legacy anon key가 비활성화되어 publishable key로 전환 (2026-05-13)
// publishable key는 클라이언트 노출 안전. RLS 정책으로 데이터 접근 제어.
const supabaseUrl = 'https://vaotmawzmlbzngsnogup.supabase.co';
const supabasePublishableKey = 'sb_publishable_mUSu94wvPL2JA-P6FhOCKA_t2vn0Oaz';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
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
      'X-Client-Info': 'moment-in-calendar@1.1'
    }
  }
});
