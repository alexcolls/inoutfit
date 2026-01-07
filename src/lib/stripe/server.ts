import Stripe from 'stripe';

import {requireEnv} from '@/lib/env';

export function getStripeClient() {
  return new Stripe(requireEnv('STRIPE_SECRET_KEY'));
}

