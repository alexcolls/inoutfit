import {createBrowserClient} from '@supabase/ssr';

import {getSupabaseAnonKey, getSupabaseUrl} from './config';

export function createBrowserSupabaseClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}
