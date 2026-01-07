import {z} from 'zod';

import {getBillingEntitlementsForUser, getPromoCurrency, getPromoDiscountPercent, getPromoUnitAmount} from '@/lib/billing/entitlements';
import {requireEnv} from '@/lib/env';
import {withRequestLogging} from '@/lib/http/logger';
import {getRequestIp, rateLimitOrThrow} from '@/lib/http/rate-limit';
import {fail, ok} from '@/lib/http/response';
import {getStripePostgresClient} from '@/lib/stripe/postgres';
import {getStripeClient} from '@/lib/stripe/server';
import {createRouteSupabaseClient} from '@/lib/supabase/route';
import {routing} from '@/i18n/routing';

export const runtime = 'nodejs';

const schema = z.object({
  mode: z.enum(['payment', 'subscription'])
});

async function getOrCreateStripeCustomerId(params: {
  supabaseUserId: string;
  email?: string | null;
}) {
  const client = getStripePostgresClient();

  const existing = await client.pool.query<{id: string}>(
    "select id from stripe.customers where metadata->>'supabase_user_id' = $1 order by created desc nulls last limit 1",
    [params.supabaseUserId]
  );

  const existingId = existing.rows[0]?.id;
  if (existingId) return existingId;

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: params.email ?? undefined,
    metadata: {
      supabase_user_id: params.supabaseUserId
    }
  });

  return customer.id;
}

export const POST = withRequestLogging('stripe.checkout.post', async (request: Request) => {
  const ip = getRequestIp(request);
  rateLimitOrThrow({key: `stripe:checkout:${ip}`, limit: 60, windowMs: 60_000});

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    return fail(400, 'Invalid request body');
  }

  const supabase = await createRouteSupabaseClient();
  const {data: userData, error: userError} = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return fail(401, 'Unauthorized');
  }

  const siteUrl = requireEnv('NEXT_PUBLIC_SITE_URL');
  const stripe = getStripeClient();

  const mode = parsed.data.mode;

  const successUrl =
    process.env.STRIPE_SUCCESS_URL ??
    `${siteUrl}/${routing.defaultLocale}/billing/success?session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl =
    process.env.STRIPE_CANCEL_URL ??
    `${siteUrl}/${routing.defaultLocale}/billing/cancel`;

  const customer = await getOrCreateStripeCustomerId({
    supabaseUserId: userData.user.id,
    email: userData.user.email
  });

  if (mode === 'subscription') {
    const session = await stripe.checkout.sessions.create({
      mode,
      customer,
      line_items: [{price: requireEnv('STRIPE_SUBSCRIPTION_PRICE_ID'), quantity: 1}],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        supabase_user_id: userData.user.id
      }
    });

    return ok({url: session.url});
  }

  // mode === 'payment' (promo generation)
  const entitlements = await getBillingEntitlementsForUser(userData.user.id);

  // Prefer dynamic pricing so we can apply % discounts without managing Stripe coupons.
  // If STRIPE_PROMO_UNIT_AMOUNT is not set, fall back to STRIPE_ONE_TIME_PRICE_ID.
  const currency = process.env.STRIPE_PROMO_CURRENCY;
  const unitAmountRaw = process.env.STRIPE_PROMO_UNIT_AMOUNT;

  if (!currency || !unitAmountRaw) {
    const session = await stripe.checkout.sessions.create({
      mode,
      customer,
      line_items: [{price: requireEnv('STRIPE_ONE_TIME_PRICE_ID'), quantity: 1}],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        supabase_user_id: userData.user.id
      }
    });

    return ok({url: session.url});
  }

  const baseAmount = getPromoUnitAmount();
  const discountPercent = entitlements.isPremium ? getPromoDiscountPercent() : 0;
  const discountedAmount = Math.max(
    0,
    Math.round((baseAmount * (100 - discountPercent)) / 100)
  );

  const session = await stripe.checkout.sessions.create({
    mode,
    customer,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: getPromoCurrency(),
          unit_amount: discountedAmount,
          product_data: {
            name: 'Outfit promo generation'
          }
        }
      }
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      supabase_user_id: userData.user.id,
      promo_base_unit_amount: String(baseAmount),
      promo_final_unit_amount: String(discountedAmount),
      premium_discount_percent: String(discountPercent)
    }
  });

  return ok({url: session.url});
});
