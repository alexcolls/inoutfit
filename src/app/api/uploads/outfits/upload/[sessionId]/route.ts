import {z} from 'zod';

import {withRequestLogging} from '@/lib/http/logger';
import {getRequestIp, rateLimitOrThrow} from '@/lib/http/rate-limit';
import {fail, ok} from '@/lib/http/response';
import {createRouteSupabaseClient} from '@/lib/supabase/route';

export const runtime = 'nodejs';

const paramsSchema = z.object({
  sessionId: z.string().uuid()
});

const putHandler = async (request: Request, context: {params: Promise<{sessionId: string}>}) => {
  const ip = getRequestIp(request);
  rateLimitOrThrow({key: `uploads:outfits:upload:${ip}`, limit: 120, windowMs: 60_000});

  const params = await context.params;
  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
    return fail(400, 'Invalid upload session id');
  }

  const supabase = await createRouteSupabaseClient();
  const {data: userData, error: userError} = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return fail(401, 'Unauthorized');
  }

  const {data: session, error: sessionError} = await supabase
    .from('upload_sessions')
    .select('id, owner_id, bucket_id, object_path, content_type, expires_at, used_at')
    .eq('id', parsedParams.data.sessionId)
    .eq('owner_id', userData.user.id)
    .single();

  if (sessionError) {
    return fail(404, sessionError.message);
  }

  if (session.used_at) {
    return fail(409, 'Upload session already used');
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    return fail(410, 'Upload session expired');
  }

  const contentType =
    request.headers.get('content-type') ??
    session.content_type ??
    'application/octet-stream';
  const body = Buffer.from(await request.arrayBuffer());

  const {error: uploadError} = await supabase.storage
    .from(session.bucket_id)
    .upload(session.object_path, body, {
      contentType,
      upsert: false
    });

  if (uploadError) {
    return fail(400, uploadError.message);
  }

  const {error: markError} = await supabase
    .from('upload_sessions')
    .update({used_at: new Date().toISOString()})
    .eq('id', session.id)
    .eq('owner_id', userData.user.id);

  if (markError) {
    return fail(400, markError.message);
  }

  return ok({path: session.object_path});
};

export const PUT = withRequestLogging('uploads.outfits.upload.put', putHandler);
export const POST = withRequestLogging('uploads.outfits.upload.post', putHandler);
