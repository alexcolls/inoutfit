import {createBrowserClient} from '@supabase/ssr';

import {getSupabaseUrl, requireSupabasePublishableKey} from './config';

export function createBrowserSupabaseClient() {
  return createBrowserClient(getSupabaseUrl(), requireSupabasePublishableKey());
}
