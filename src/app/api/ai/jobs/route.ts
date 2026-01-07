import {z} from 'zod';

import {withRequestLogging} from '@/lib/http/logger';
import {getRequestIp, rateLimitOrThrow} from '@/lib/http/rate-limit';
import {fail, ok} from '@/lib/http/response';
import {createRouteSupabaseClient} from '@/lib/supabase/route';

export const runtime = 'nodejs';

const schema = z.object({
  outfitId: z.string().uuid().optional(),
  model: z.string().min(1).optional(),
  input: z.record(z.string(), z.unknown()).optional()
});

export const POST = withRequestLogging('ai.jobs.create', async (request: Request) => {
  const ip = getRequestIp(request);
  rateLimitOrThrow({key: `ai:jobs:create:${ip}`, limit: 30, windowMs: 60_000});

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

  const {data, error} = await supabase
    .from('ai_jobs')
    .insert({
      owner_id: userData.user.id,
      outfit_id: parsed.data.outfitId ?? null,
      provider: 'fal',
      model: parsed.data.model ?? null,
      status: 'queued',
      input: parsed.data.input ?? {}
    })
    .select('*')
    .single();

  if (error) {
    return fail(400, error.message);
  }

  return ok({job: data});
});
