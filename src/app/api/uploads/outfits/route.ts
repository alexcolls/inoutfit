import {withRequestLogging} from '@/lib/http/logger';
import {fail, ok} from '@/lib/http/response';
import {makeUserObjectPath, USER_ASSET_PREFIXES, USERS_BUCKET} from '@/lib/storage/buckets';
import {createSupabaseAdminClient} from '@/lib/supabase/admin';
import {createRouteSupabaseClient} from '@/lib/supabase/route';

export const runtime = 'nodejs';

export const POST = withRequestLogging('uploads.outfits.legacy.post', async (request: Request) => {
  const supabase = await createRouteSupabaseClient();
  const {data: userData, error: userError} = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return fail(401, 'Unauthorized');
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!(file instanceof File)) {
    return fail(400, 'Missing file');
  }

  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  const path = makeUserObjectPath({
    userId: userData.user.id,
    prefix: USER_ASSET_PREFIXES.outfits,
    filename: `${crypto.randomUUID()}.${ext}`
  });

  const admin = createSupabaseAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const {data, error} = await admin.storage
    .from(USERS_BUCKET)
    .upload(path, buffer, {contentType: file.type || 'application/octet-stream'});

  if (error) {
    return fail(400, error.message);
  }

  return ok({path: data.path});
});
