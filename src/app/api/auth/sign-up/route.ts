import {z} from 'zod';

import {withRequestLogging} from '@/lib/http/logger';
import {fail, ok} from '@/lib/http/response';
import {getRequestIp, rateLimitOrThrow} from '@/lib/http/rate-limit';
import {createRouteSupabaseClient} from '@/lib/supabase/route';

export const runtime = 'nodejs';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const POST = withRequestLogging('auth.sign-up.post', async (request: Request) => {
  const ip = getRequestIp(request);
  rateLimitOrThrow({key: `auth:sign-up:${ip}`, limit: 10, windowMs: 60_000});

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    return fail(400, 'Invalid request body');
  }

  const supabase = await createRouteSupabaseClient();

  const {data, error} = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password
  });

  if (error) {
    return fail(400, error.message);
  }

  return ok({user: data.user, session: data.session});
});
