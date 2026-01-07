import {z} from 'zod';

import {requireEnv} from '@/lib/env';
import {getStripePostgresClient} from '@/lib/stripe/postgres';

export type BillingEntitlements = {
  isPremium: boolean;
  promoDiscountPercent: number;
};

const discountSchema = z.coerce.number().min(0).max(100);

export function getPromoDiscountPercent(): number {
  return discountSchema.parse(process.env.STRIPE_PREMIUM_DISCOUNT_PERCENT ?? '30');
}

export async function getBillingEntitlementsForUser(
  supabaseUserId: string
): Promise<BillingEntitlements> {
  const client = getStripePostgresClient();

  // Preferred: use the DB view if it exists (created after Stripe Sync Engine migrations).
  try {
    const res = await client.pool.query<{is_premium: boolean}>(
      'select is_premium from public.user_entitlements where user_id = $1 limit 1',
      [supabaseUserId]
    );

    const isPremium = res.rows[0]?.is_premium ?? false;

    return {
      isPremium,
      promoDiscountPercent: getPromoDiscountPercent()
    };
  } catch {
    // Fallback: if the view doesn't exist yet, consider the user non-premium.
    return {
      isPremium: false,
      promoDiscountPercent: getPromoDiscountPercent()
    };
  }
}

export function getPromoCurrency(): string {
  return requireEnv('STRIPE_PROMO_CURRENCY');
}

export function getPromoUnitAmount(): number {
  return z.coerce
    .number()
    .int()
    .positive()
    .parse(requireEnv('STRIPE_PROMO_UNIT_AMOUNT'));
}
