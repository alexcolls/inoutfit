import {StripeSync} from '@supabase/stripe-sync-engine';

import {requireEnv} from '@/lib/env';

let stripeSyncSingleton: StripeSync | null = null;


export function getStripeSync() {
  if (stripeSyncSingleton) return stripeSyncSingleton;

  stripeSyncSingleton = new StripeSync({
    poolConfig: {
      connectionString: requireEnv('SUPABASE_DATABASE_URL'),
      max: 5,
      ssl: {rejectUnauthorized: false}
    },
    stripeSecretKey: requireEnv('STRIPE_SECRET_KEY'),
    stripeWebhookSecret: requireEnv('STRIPE_WEBHOOK_SECRET'),
    backfillRelatedEntities: false,
    autoExpandLists: true,
    maxPostgresConnections: 5
  });

  return stripeSyncSingleton;
}
