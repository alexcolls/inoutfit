import {headers} from 'next/headers';

import {withRequestLogging} from '@/lib/http/logger';
import {fail} from '@/lib/http/response';
import {getStripeSync} from '@/lib/stripe/sync';

export const runtime = 'nodejs';

export const POST = withRequestLogging('stripe.webhook.post', async (request: Request) => {
  const signature = (await headers()).get('stripe-signature');

  if (!signature) {
    return fail(400, 'Missing Stripe signature');
  }

  try {
    const stripeSync = getStripeSync();

    // IMPORTANT: use raw request body for signature verification
    const rawBody = Buffer.from(await request.arrayBuffer());

    await stripeSync.processWebhook(rawBody, signature);

    return new Response(null, {status: 202});
  } catch (err) {
    return fail(400, err instanceof Error ? err.message : 'Webhook error');
  }
});
