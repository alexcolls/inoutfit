import {getEnv} from '@/lib/env';
import {withRequestLogging} from '@/lib/http/logger';
import {ok} from '@/lib/http/response';
import {getSupabaseUrl, requireSupabasePublishableKey} from '@/lib/supabase/config';

export const GET = withRequestLogging('health.get', async () => {
  const envSiteUrl = getEnv('NEXT_PUBLIC_SITE_URL') ?? null;

  const supabase: {
    url: string | null;
    authHealthOk: boolean | null;
    authHealthStatus: number | null;
    authHealthError: string | null;
  } = {
    url: null,
    authHealthOk: null,
    authHealthStatus: null,
    authHealthError: null
  };

  try {
    const supabaseUrl = getSupabaseUrl();
    supabase.url = supabaseUrl;

    // Try a lightweight request to confirm network/DNS and key validity.
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: {
        apikey: requireSupabasePublishableKey()
      },
      cache: 'no-store'
    });

    supabase.authHealthOk = res.ok;
    supabase.authHealthStatus = res.status;
  } catch (e) {
    supabase.authHealthOk = false;
    supabase.authHealthError = e instanceof Error ? e.message : 'Unknown error';
  }

  return ok({
    status: 'ok',
    env: {
      hasSiteUrl: Boolean(envSiteUrl),
      siteUrl: envSiteUrl,
      hasSupabaseProjectId: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID),
      hasSupabasePublishableKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
    },
    supabase
  });
});
