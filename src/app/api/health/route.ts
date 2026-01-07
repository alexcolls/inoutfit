import {withRequestLogging} from '@/lib/http/logger';
import {ok} from '@/lib/http/response';

export const GET = withRequestLogging('health.get', async () => {
  return ok({status: 'ok'});
});
