import {getBillingEntitlementsForUser} from '@/lib/billing/entitlements';
import {withRequestLogging} from '@/lib/http/logger';
import {fail, ok} from '@/lib/http/response';
import {createRouteSupabaseClient} from '@/lib/supabase/route';

export const runtime = 'nodejs';

export const GET = withRequestLogging('billing.entitlements.get', async () => {
  const supabase = await createRouteSupabaseClient();
  const {data: userData, error: userError} = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return fail(401, 'Unauthorized');
  }

  const entitlements = await getBillingEntitlementsForUser(userData.user.id);

  return ok(entitlements);
});
