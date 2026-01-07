import {PostgresClient} from '@supabase/stripe-sync-engine';

import {requireEnv} from '@/lib/env';

let postgresClientSingleton: PostgresClient | null = null;


export function getStripePostgresClient() {
  if (postgresClientSingleton) return postgresClientSingleton;

  postgresClientSingleton = new PostgresClient({
    schema: 'stripe',
    poolConfig: {
      connectionString: requireEnv('SUPABASE_DATABASE_URL'),
      max: 5,
      ssl: {rejectUnauthorized: false}
    }
  });

  return postgresClientSingleton;
}
