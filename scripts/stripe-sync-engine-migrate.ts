import {PostgresClient, runMigrations} from '@supabase/stripe-sync-engine';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function getDatabaseSslConfig(): Record<string, unknown> {
  const ca = process.env.SUPABASE_DATABASE_SSL_CA;
  if (ca && ca.trim().length > 0) return {ca};
  return {rejectUnauthorized: false};
}

async function main() {
  const databaseUrl = requireEnv('SUPABASE_DATABASE_URL');

  await runMigrations({
    databaseUrl,
    schema: 'stripe'
  });

  // Create/update app-level view for premium entitlements.
  const client = new PostgresClient({
    schema: 'stripe',
    poolConfig: {
      connectionString: databaseUrl,
      max: 3,
      ssl: getDatabaseSslConfig()
    }
  });

  await client.pool.query(`
    create or replace view public.user_entitlements as
    select
      (c.metadata->>'supabase_user_id')::uuid as user_id,
      bool_or(s.status in ('active','trialing')) as is_premium,
      max(s.current_period_end) as premium_current_period_end
    from stripe.customers c
    left join stripe.subscriptions s on s.customer = c.id
    where c.metadata ? 'supabase_user_id'
    group by 1;
  `);

  await client.pool.query(`
    create or replace function public.is_premium(p_user_id uuid)
    returns boolean
    language plpgsql
    stable
    as $$
    begin
      if to_regclass('public.user_entitlements') is null then
        return false;
      end if;

      return coalesce(
        (select ue.is_premium from public.user_entitlements ue where ue.user_id = p_user_id),
        false
      );
    end;
    $$;
  `);

  console.log('✅ Stripe Sync Engine migrations applied (schema: stripe)');
  console.log('✅ public.user_entitlements view updated');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
