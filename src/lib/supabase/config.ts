export function getSupabaseProjectId() {
  const id = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID;
  if (!id) {
    throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_PROJECT_ID');
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
