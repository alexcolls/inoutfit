import {PostgresClient} from '@supabase/stripe-sync-engine';

import {requireEnv} from '@/lib/env';

let postgresClientSingleton: PostgresClient | null = null;

function getDatabaseSslConfig(): Record<string, unknown> | undefined {
  const ca = process.env.SUPABASE_DATABASE_SSL_CA;

  if (ca && ca.trim().length > 0) {
    return {ca};
  }

  return {rejectUnauthorized: false};
}

export function getStripePostgresClient() {
  if (postgresClientSingleton) return postgresClientSingleton;

  postgresClientSingleton = new PostgresClient({
    schema: 'stripe',
    poolConfig: {
      connectionString: requireEnv('SUPABASE_DATABASE_URL'),
      max: 5,
      ssl: getDatabaseSslConfig()
    }
  });

  return postgresClientSingleton;
}
