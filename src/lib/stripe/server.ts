import Stripe from 'stripe';

import {requireEnv} from '@/lib/env';

export function getStripeClient() {
  return new Stripe(requireEnv('STRIPE_SECRET_KEY'));
}

export function getCheckoutPriceId(mode: 'payment' | 'subscription') {
  return mode === 'payment'
    ? requireEnv('STRIPE_ONE_TIME_PRICE_ID')
    : requireEnv('STRIPE_SUBSCRIPTION_PRICE_ID');
}
