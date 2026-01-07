-- Base extensions
create extension if not exists "pgcrypto";

-- Helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Admin check (based on JWT app_metadata.role)
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- Premium entitlements (conditional: only created if Stripe Sync Engine schema exists)
do $$
begin
  if exists(
    select 1
    from information_schema.tables
    where table_schema = 'stripe' and table_name = 'customers'
  )
  and exists(
    select 1
    from information_schema.tables
    where table_schema = 'stripe' and table_name = 'subscriptions'
  ) then
    execute $v$
      create or replace view public.user_entitlements as
      select
        (c.metadata->>'supabase_user_id')::uuid as user_id,
        bool_or(s.status in ('active','trialing')) as is_premium,
        max(s.current_period_end) as premium_current_period_end
      from stripe.customers c
      left join stripe.subscriptions s on s.customer = c.id
      where c.metadata ? 'supabase_user_id'
      group by 1
    $v$;
  end if;
end;
$$;

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

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Outfits
create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text,
  status text not null default 'draft' check (status in ('draft','ready','processing','completed','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists outfits_set_updated_at on public.outfits;
create trigger outfits_set_updated_at
before update on public.outfits
for each row execute function public.set_updated_at();

alter table public.outfits enable row level security;

drop policy if exists "outfits_select_own" on public.outfits;
create policy "outfits_select_own"
on public.outfits
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "outfits_insert_own" on public.outfits;
create policy "outfits_insert_own"
on public.outfits
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "outfits_update_own" on public.outfits;
create policy "outfits_update_own"
on public.outfits
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "outfits_delete_own" on public.outfits;
create policy "outfits_delete_own"
on public.outfits
for delete
to authenticated
using (auth.uid() = owner_id);

-- Outfit assets
create table if not exists public.outfit_assets (
  id uuid primary key default gen_random_uuid(),
  outfit_id uuid not null references public.outfits(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  storage_bucket text not null default 'users',
  storage_path text not null,
  kind text not null default 'image' check (kind in ('image','video','other')),
  content_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.outfit_assets enable row level security;

drop policy if exists "outfit_assets_select_own" on public.outfit_assets;
create policy "outfit_assets_select_own"
on public.outfit_assets
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "outfit_assets_insert_own" on public.outfit_assets;
create policy "outfit_assets_insert_own"
on public.outfit_assets
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "outfit_assets_update_own" on public.outfit_assets;
create policy "outfit_assets_update_own"
on public.outfit_assets
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "outfit_assets_delete_own" on public.outfit_assets;
create policy "outfit_assets_delete_own"
on public.outfit_assets
for delete
to authenticated
using (auth.uid() = owner_id);

-- AI jobs
create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  outfit_id uuid references public.outfits(id) on delete set null,
  provider text not null default 'fal',
  model text,
  status text not null default 'queued' check (status in ('queued','running','succeeded','failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists ai_jobs_set_updated_at on public.ai_jobs;
create trigger ai_jobs_set_updated_at
before update on public.ai_jobs
for each row execute function public.set_updated_at();

alter table public.ai_jobs enable row level security;

drop policy if exists "ai_jobs_select_own" on public.ai_jobs;
create policy "ai_jobs_select_own"
on public.ai_jobs
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "ai_jobs_insert_own" on public.ai_jobs;
create policy "ai_jobs_insert_own"
on public.ai_jobs
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "ai_jobs_update_own" on public.ai_jobs;
create policy "ai_jobs_update_own"
on public.ai_jobs
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "ai_jobs_delete_own" on public.ai_jobs;
create policy "ai_jobs_delete_own"
on public.ai_jobs
for delete
to authenticated
using (auth.uid() = owner_id);

-- Upload sessions (API-first upload signing)
create table if not exists public.upload_sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  bucket_id text not null,
  object_path text not null,
  content_type text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.upload_sessions enable row level security;

drop policy if exists "upload_sessions_select_own" on public.upload_sessions;
create policy "upload_sessions_select_own"
on public.upload_sessions
for select
to authenticated
using (auth.uid() = owner_id);

drop policy if exists "upload_sessions_insert_own" on public.upload_sessions;
create policy "upload_sessions_insert_own"
on public.upload_sessions
for insert
to authenticated
with check (auth.uid() = owner_id);

drop policy if exists "upload_sessions_update_own" on public.upload_sessions;
create policy "upload_sessions_update_own"
on public.upload_sessions
for update
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "upload_sessions_delete_own" on public.upload_sessions;
create policy "upload_sessions_delete_own"
on public.upload_sessions
for delete
to authenticated
using (auth.uid() = owner_id);

-- Storage policies
-- Buckets:
--   - users: user-owned assets under <uid>/<category>/...
--   - gallery: app-managed assets

-- users bucket: authenticated users can manage only their own folder (<uid>/...)
drop policy if exists "users_select_own" on storage.objects;
create policy "users_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'users'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- INSERT: allow normal uploads, but restrict custom avatar uploads to premium users
-- Avatar path convention: <uid>/avatars/...
drop policy if exists "users_insert_own" on storage.objects;
create policy "users_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'users'
  and (storage.foldername(name))[1] = auth.uid()::text
  and (
    (storage.foldername(name))[2] is distinct from 'avatars'
    or public.is_premium(auth.uid())
  )
);

-- UPDATE/DELETE: allow users to manage their own objects
drop policy if exists "users_update_own" on storage.objects;
create policy "users_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'users'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'users'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users_delete_own" on storage.objects;
create policy "users_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'users'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- gallery bucket: admin-managed uploads
-- SELECT: allow authenticated users to read gallery assets
drop policy if exists "gallery_select_authenticated" on storage.objects;
create policy "gallery_select_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'gallery');

-- WRITE: admin only
drop policy if exists "gallery_insert_admin" on storage.objects;
create policy "gallery_insert_admin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'gallery'
  and public.is_admin()
);

drop policy if exists "gallery_update_admin" on storage.objects;
create policy "gallery_update_admin"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'gallery'
  and public.is_admin()
)
with check (
  bucket_id = 'gallery'
  and public.is_admin()
);

drop policy if exists "gallery_delete_admin" on storage.objects;
create policy "gallery_delete_admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'gallery'
  and public.is_admin()
);
