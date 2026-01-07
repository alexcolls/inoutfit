import {z} from 'zod';

import {withRequestLogging} from '@/lib/http/logger';
import {getRequestIp, rateLimitOrThrow} from '@/lib/http/rate-limit';
import {fail, ok} from '@/lib/http/response';
import {USERS_BUCKET} from '@/lib/storage/buckets';
import {createRouteSupabaseClient} from '@/lib/supabase/route';

export const runtime = 'nodejs';

const schema = z.object({
  outfitId: z.string().uuid(),
  path: z.string().min(1),
  kind: z.enum(['image', 'video', 'other']).default('image'),
  contentType: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const POST = withRequestLogging('uploads.outfits.complete.post', async (request: Request) => {
  const ip = getRequestIp(request);
  rateLimitOrThrow({key: `uploads:outfits:complete:${ip}`, limit: 120, windowMs: 60_000});

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

  if (!parsed.data.path.startsWith(`${userData.user.id}/`)) {
    return fail(403, 'Forbidden');
  }

  // Ensure outfit exists and belongs to the user
  const {data: outfit, error: outfitError} = await supabase
    .from('outfits')
    .select('id')
    .eq('id', parsed.data.outfitId)
    .eq('owner_id', userData.user.id)
    .single();

  if (outfitError || !outfit) {
    return fail(404, 'Outfit not found');
  }

  const {data: asset, error: insertError} = await supabase
    .from('outfit_assets')
    .insert({
      outfit_id: parsed.data.outfitId,
      owner_id: userData.user.id,
      storage_bucket: USERS_BUCKET,
      storage_path: parsed.data.path,
      kind: parsed.data.kind,
      content_type: parsed.data.contentType ?? null,
      metadata: parsed.data.metadata ?? {}
    })
    .select('*')
    .single();

  if (insertError) {
    return fail(400, insertError.message);
  }

  return ok({asset});
});
