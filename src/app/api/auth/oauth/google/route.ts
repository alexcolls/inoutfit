import {NextResponse} from 'next/server';

import {routing} from '@/i18n/routing';
import {getEnv} from '@/lib/env';
import {safeNextPath} from '@/lib/http/redirect';
import {withRequestLogging} from '@/lib/http/logger';
import {getRequestIp, rateLimitOrThrow} from '@/lib/http/rate-limit';
import {fail} from '@/lib/http/response';
import {createRouteSupabaseClient} from '@/lib/supabase/route';

export const runtime = 'nodejs';

const handler = async (request: Request) => {
  const ip = getRequestIp(request);
  rateLimitOrThrow({key: `auth:oauth:google:${ip}`, limit: 30, windowMs: 60_000});

  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get('next'), `/${routing.defaultLocale}`);

  const envSiteUrl = getEnv('NEXT_PUBLIC_SITE_URL');
  const siteUrl = (envSiteUrl ?? url.origin).replace(/\/$/, '');

  const supabase = await createRouteSupabaseClient();
  const {data, error} = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteUrl}/api/auth/callback?next=${encodeURIComponent(next)}`
    }
  });

  if (error) {
    return fail(400, error.message);
  }

  return NextResponse.redirect(data.url);
};

export const POST = withRequestLogging('auth.oauth.google.post', handler);
export const GET = withRequestLogging('auth.oauth.google.get', handler);
