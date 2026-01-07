import {NextResponse} from 'next/server';

import {routing} from '@/i18n/routing';
import {safeNextPath} from '@/lib/http/redirect';
import {withRequestLogging} from '@/lib/http/logger';
import {createRouteSupabaseClient} from '@/lib/supabase/route';

export const runtime = 'nodejs';

export const GET = withRequestLogging('auth.callback.get', async (request: Request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  const next = safeNextPath(url.searchParams.get('next'), `/${routing.defaultLocale}`);

  if (!code) {
    return NextResponse.redirect(new URL(next, request.url));
  }

  const supabase = await createRouteSupabaseClient();
  const {error} = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const errUrl = new URL(next, request.url);
    errUrl.searchParams.set('error', 'oauth');
    return NextResponse.redirect(errUrl);
  }

  return NextResponse.redirect(new URL(next, request.url));
});
