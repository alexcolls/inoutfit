export function getSupabaseProjectId() {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;
  if (!raw) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_PROJECT_ID');
  }

  const id = raw.trim();

  // Supabase project ref is the subdomain in https://<ref>.supabase.co
  // Fail fast on common copy/paste mistakes.
  if (!id || /\s/.test(id) || id.includes('.') || id.includes('/')) {
    throw new Error(
      'Invalid NEXT_PUBLIC_SUPABASE_PROJECT_ID (expected the project ref only, e.g. "abcdefghijklmnopqrst")'
    );
  }

  return id;
}

export function getSupabaseUrl() {
  const projectId = getSupabaseProjectId();
  return `https://${projectId}.supabase.co`;
}

export function requireSupabasePublishableKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  }
  return key;
}

export function requireSupabaseSecretKey() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error('Missing environment variable: SUPABASE_SECRET_KEY');
  }
  return key;
}
