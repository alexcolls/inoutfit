import {z} from 'zod';

import {withRequestLogging} from '@/lib/http/logger';
import {getRequestIp, rateLimitOrThrow} from '@/lib/http/rate-limit';
import {fail, ok} from '@/lib/http/response';
import {makeUserObjectPath, USER_ASSET_PREFIXES, USERS_BUCKET} from '@/lib/storage/buckets';
import {createRouteSupabaseClient} from '@/lib/supabase/route';

export const runtime = 'nodejs';

const schema = z.object({
  filename: z.string().min(1).max(300),
  contentType: z.string().min(1).max(200).optional(),
  expiresInSeconds: z.number().int().positive().max(60 * 60).optional()
});

function safeExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  if (idx === -1) return 'bin';
  const ext = filename.slice(idx + 1).toLowerCase();
  if (!/^[a-z0-9]{1,10}$/.test(ext)) return 'bin';
  return ext;
}

export const POST = withRequestLogging('uploads.outfits.sign.post', async (request: Request) => {
  const ip = getRequestIp(request);
  rateLimitOrThrow({key: `uploads:outfits:sign:${ip}`, limit: 60, windowMs: 60_000});

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

  const ext = safeExtension(parsed.data.filename);
  const objectPath = makeUserObjectPath({
    userId: userData.user.id,
    prefix: USER_ASSET_PREFIXES.outfits,
    filename: `${crypto.randomUUID()}.${ext}`
  });
  const expiresInSeconds = parsed.data.expiresInSeconds ?? 600;

  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  const {data: session, error} = await supabase
    .from('upload_sessions')
    .insert({
      owner_id: userData.user.id,
      bucket_id: USERS_BUCKET,
      object_path: objectPath,
      content_type: parsed.data.contentType ?? null,
      expires_at: expiresAt
    })
    .select('id, object_path, expires_at')
    .single();

  if (error) {
    return fail(400, error.message);
  }

  return ok({
    uploadSessionId: session.id,
    path: session.object_path,
    expiresAt: session.expires_at,
    uploadUrl: `/api/uploads/outfits/upload/${session.id}`
  });
});
