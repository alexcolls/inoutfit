import {NextResponse} from 'next/server';

import {routing} from '@/i18n/routing';
import {withRequestLogging} from '@/lib/http/logger';
import {createRouteSupabaseClient} from '@/lib/supabase/route';

export const runtime = 'nodejs';

export const GET = withRequestLogging('auth.callback.get', async (request: Request) => {
  const {searchParams} = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL(`/${routing.defaultLocale}`, request.url));
  }

  const supabase = await createRouteSupabaseClient();
  const {error} = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/${routing.defaultLocale}?error=oauth`, request.url)
    );
  }

  return NextResponse.redirect(new URL(`/${routing.defaultLocale}`, request.url));
});
