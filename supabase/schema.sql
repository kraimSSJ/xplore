-- ============================================================================
-- Xplore Gestion - Supabase schema (run once in Supabase SQL Editor)
-- Replaces the old NestJS backend entirely. Frontend talks to Supabase directly.
-- ============================================================================

-- 1. PROFILES (extends Supabase Auth users with fullName/role)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text not null default '',
  role text not null default 'member' check (role in ('admin', 'member')),
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'member')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. PRODUCTS
-- ----------------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  photo_url text,
  price_rmb float not null,
  reference text,
  category text not null default 'Uncategorized',
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. APP SETTINGS (singleton row holding the RMB -> MAD exchange rate)
-- ----------------------------------------------------------------------------
create table if not exists public.app_settings (
  id int primary key default 1,
  rmb_to_mad_rate float not null default 1.35,
  updated_at timestamptz not null default now()
);
insert into public.app_settings (id, rmb_to_mad_rate)
  values (1, 1.35) on conflict (id) do nothing;

-- 4. ORDERS + ORDER ITEMS
-- ----------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  shipping_cost float not null default 0,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'finalized')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null,
  product_name text not null,
  product_photo_url text,
  unit_price_rmb float,
  unit_price float not null,
  quantity int not null
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.app_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- helper: is the current user an active admin?
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and disabled = false
  );
$$ language sql security definer stable;

-- helper: is the current user's own profile active (not disabled)?
create or replace function public.is_active()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and disabled = false
  );
$$ language sql security definer stable;

-- PROFILES policies
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles_insert_admin_only" on public.profiles
  for insert with check (public.is_admin());
create policy "profiles_update_admin_only" on public.profiles
  for update using (public.is_admin());
create policy "profiles_delete_admin_only" on public.profiles
  for delete using (public.is_admin());

-- PRODUCTS policies (any active logged-in user can read, only admin writes)
create policy "products_select_active_users" on public.products
  for select using (public.is_active());
create policy "products_write_admin_only" on public.products
  for insert with check (public.is_admin());
create policy "products_update_admin_only" on public.products
  for update using (public.is_admin());
create policy "products_delete_admin_only" on public.products
  for delete using (public.is_admin());

-- APP_SETTINGS policies (any active user can read, only admin writes)
create policy "settings_select_active_users" on public.app_settings
  for select using (public.is_active());
create policy "settings_update_admin_only" on public.app_settings
  for update using (public.is_admin());

-- ORDERS policies (member sees own orders, admin sees/edits all)
create policy "orders_select_own_or_admin" on public.orders
  for select using (user_id = auth.uid() or public.is_admin());
create policy "orders_insert_own" on public.orders
  for insert with check (user_id = auth.uid() and public.is_active());
create policy "orders_update_admin_only" on public.orders
  for update using (public.is_admin());
create policy "orders_delete_admin_only" on public.orders
  for delete using (public.is_admin());

-- ORDER_ITEMS policies (inherit access through parent order)
create policy "order_items_select_via_order" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.user_id = auth.uid() or public.is_admin())
    )
  );
create policy "order_items_insert_own_order" on public.order_items
  for insert with check (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id and o.user_id = auth.uid()
    )
  );
create policy "order_items_update_admin_only" on public.order_items
  for update using (public.is_admin());
create policy "order_items_delete_admin_only" on public.order_items
  for delete using (public.is_admin());

-- ============================================================================
-- STORAGE (product photos)
-- ============================================================================
insert into storage.buckets (id, name, public)
  values ('product-photos', 'product-photos', true)
  on conflict (id) do nothing;

create policy "product_photos_public_read" on storage.objects
  for select using (bucket_id = 'product-photos');
create policy "product_photos_admin_write" on storage.objects
  for insert with check (bucket_id = 'product-photos' and public.is_admin());
create policy "product_photos_admin_update" on storage.objects
  for update using (bucket_id = 'product-photos' and public.is_admin());
create policy "product_photos_admin_delete" on storage.objects
  for delete using (bucket_id = 'product-photos' and public.is_admin());

-- ============================================================================
-- SEED: promote the first user you sign up to admin. Run this manually
-- after creating your first account through the app's login/signup, e.g.:
--   update public.profiles set role = 'admin' where email = 'admin@xplore.local';
-- ============================================================================
