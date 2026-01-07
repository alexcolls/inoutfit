type Bucket = {
  count: number;
  resetAt: number;
};

const globalKey = '__inoutfit_rate_limit__';

function getStore(): Map<string, Bucket> {
  const g = globalThis as unknown as Record<string, unknown>;
  if (!g[globalKey]) {
    g[globalKey] = new Map<string, Bucket>();
  }
  return g[globalKey] as Map<string, Bucket>;
}

export function getRequestIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export function rateLimitOrThrow(params: {
  key: string;
  limit: number;
  windowMs: number;
}): {remaining: number; resetAt: number} {
  const store = getStore();
  const now = Date.now();

  const bucket = store.get(params.key);
  if (!bucket || now >= bucket.resetAt) {
    const next: Bucket = {count: 1, resetAt: now + params.windowMs};
    store.set(params.key, next);
    return {remaining: params.limit - 1, resetAt: next.resetAt};
  }

  if (bucket.count >= params.limit) {
    throw new Response(
      JSON.stringify({ok: false, error: 'Too many requests'}),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil((bucket.resetAt - now) / 1000))
        }
      }
    );
  }

  bucket.count += 1;
  store.set(params.key, bucket);

  return {remaining: params.limit - bucket.count, resetAt: bucket.resetAt};
}
