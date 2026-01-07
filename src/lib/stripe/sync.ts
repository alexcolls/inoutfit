import {StripeSync} from '@supabase/stripe-sync-engine';

import {requireEnv} from '@/lib/env';

let stripeSyncSingleton: StripeSync | null = null;

function getDatabaseSslConfig(): Record<string, unknown> | undefined {
  const ca = process.env.SUPABASE_DATABASE_SSL_CA;

  if (ca && ca.trim().length > 0) {
    return {
      ca
    };
  }

  // Supabase requires SSL; for convenience we allow connecting without verifying the CA
  // when a CA isn't provided (use CA in production).
  return {
    rejectUnauthorized: false
  };
}

export function getStripeSync() {
  if (stripeSyncSingleton) return stripeSyncSingleton;

  stripeSyncSingleton = new StripeSync({
    poolConfig: {
      connectionString: requireEnv('SUPABASE_DATABASE_URL'),
      max: 5,
      ssl: getDatabaseSslConfig()
    },
    stripeSecretKey: requireEnv('STRIPE_SECRET_KEY'),
    stripeWebhookSecret: requireEnv('STRIPE_WEBHOOK_SECRET'),
    backfillRelatedEntities: false,
    autoExpandLists: true,
    maxPostgresConnections: 5
  });

  return stripeSyncSingleton;
}
