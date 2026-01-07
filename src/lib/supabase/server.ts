import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';

import {getSupabaseAnonKey, getSupabaseUrl} from './config';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      // Server Components are read-only. Session refresh should happen in middleware.
      setAll() {}
    }
  });
}
