import {z} from 'zod';

import {withRequestLogging} from '@/lib/http/logger';
import {fail, ok} from '@/lib/http/response';
import {USERS_BUCKET} from '@/lib/storage/buckets';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {createRouteSupabaseClient} from '@/lib/supabase/route';

export const runtime = 'nodejs';

const schema = z.object({
  path: z.string().min(1),
  expiresIn: z.number().int().positive().max(60 * 60 * 24).optional()
});

export const POST = withRequestLogging('uploads.outfits.signed-url.post', async (request: Request) => {
  const supabase = await createRouteSupabaseClient();
  const {data: userData, error: userError} = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return fail(401, 'Unauthorized');
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    return fail(400, 'Invalid request body');
  }

  // Basic path guard: user can only request URLs for their own objects.
  if (!parsed.data.path.startsWith(`${userData.user.id}/`)) {
    return fail(403, 'Forbidden');
  }

  const admin = createSupabaseAdminClient();

  const {data, error} = await admin.storage
    .from(USERS_BUCKET)
    .createSignedUrl(parsed.data.path, parsed.data.expiresIn ?? 60 * 10);

  if (error) {
    return fail(400, error.message);
  }

  return ok({signedUrl: data.signedUrl});
});
