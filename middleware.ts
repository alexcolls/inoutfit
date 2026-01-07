import {createServerClient} from '@supabase/ssr';
import createIntlMiddleware from 'next-intl/middleware';
import type {NextRequest} from 'next/server';

import {routing} from '@/i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  // First apply locale routing (redirects / -> /en, etc.)
  const response = intlMiddleware(request);

  // Then ensure Supabase sessions are refreshed via cookies.
  const projectId = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!projectId) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_PROJECT_ID');
  }
  if (!publishableKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }

  const supabase = createServerClient(
    `https://${projectId}.supabase.co`,
    publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({name, value}) => request.cookies.set(name, value));

          cookiesToSet.forEach(({name, value, options}) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  // Triggers automatic refresh if the session is expired.
  await supabase.auth.getSession();

  return response;
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};
