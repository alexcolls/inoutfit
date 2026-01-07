import {withRequestLogging} from '@/lib/http/logger';
import {fail, ok} from '@/lib/http/response';
import {createRouteSupabaseClient} from '@/lib/supabase/route';

export const runtime = 'nodejs';

export const POST = withRequestLogging('auth.sign-out.post', async () => {
  const supabase = await createRouteSupabaseClient();
  const {error} = await supabase.auth.signOut();

  if (error) {
    return fail(400, error.message);
  }

  return ok({signedOut: true});
});
