import {z} from 'zod';

import {withRequestLogging} from '@/lib/http/logger';
import {getRequestIp, rateLimitOrThrow} from '@/lib/http/rate-limit';
import {fail, ok} from '@/lib/http/response';
import {createRouteSupabaseClient} from '@/lib/supabase/route';

export const runtime = 'nodejs';

const paramsSchema = z.object({
  id: z.string().uuid()
});

const handler = async (request: Request, context: {params: Promise<{id: string}>}) => {
  const ip = getRequestIp(request);
  rateLimitOrThrow({key: `ai:jobs:run:${ip}`, limit: 30, windowMs: 60_000});

  const params = await context.params;
  const parsedParams = paramsSchema.safeParse(params);

  if (!parsedParams.success) {
    return fail(400, 'Invalid job id');
  }

  const supabase = await createRouteSupabaseClient();
  const {data: userData, error: userError} = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return fail(401, 'Unauthorized');
  }

  const {data: job, error} = await supabase
    .from('ai_jobs')
    .select('*')
    .eq('id', parsedParams.data.id)
    .eq('owner_id', userData.user.id)
    .single();

  if (error) {
    return fail(404, error.message);
  }

  // We'll implement fal.ai calls later.
  return ok(
    {
      error: 'Not implemented yet',
      job
    },
    {status: 501}
  );
};

export const POST = withRequestLogging('ai.jobs.run', handler);
