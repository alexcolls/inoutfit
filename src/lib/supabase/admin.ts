import {createClient} from '@supabase/supabase-js';

import {getSupabaseUrl, requireSupabaseSecretKey} from './config';

export function createSupabaseAdminClient() {
  return createClient(getSupabaseUrl(), requireSupabaseSecretKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
