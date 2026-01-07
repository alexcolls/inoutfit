import {NextResponse} from 'next/server';

import {requireEnv} from '@/lib/env';
import {withRequestLogging} from '@/lib/http/logger';
import {getRequestIp, rateLimitOrThrow} from '@/lib/http/rate-limit';
import {fail} from '@/lib/http/response';
import {createRouteSupabaseClient} from '@/lib/supabase/route';

export const runtime = 'nodejs';

const postHandler = async (request: Request) => {
  const ip = getRequestIp(request);
  rateLimitOrThrow({key: `auth:oauth:google:${ip}`, limit: 30, windowMs: 60_000});

  const siteUrl = requireEnv('NEXT_PUBLIC_SITE_URL');

  const supabase = await createRouteSupabaseClient();
  const {data, error} = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteUrl}/api/auth/callback`
    }
  });

  if (error) {
    return fail(400, error.message);
  }

  return NextResponse.redirect(data.url);
};

export const POST = withRequestLogging('auth.oauth.google.post', postHandler);
export const GET = withRequestLogging('auth.oauth.google.get', postHandler);
