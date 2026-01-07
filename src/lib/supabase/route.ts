import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';

import {getSupabaseUrl, requireSupabasePublishableKey} from './config';

export async function createRouteSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), requireSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({name, value, options}) => {
          cookieStore.set(name, value, options);
        });
      }
    }
  });
}
