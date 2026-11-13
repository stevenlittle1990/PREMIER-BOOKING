-- Premier Booking core schema: areas, bay systems, listings (stays + trips), availability, bookings, partners.
-- Roles: admin (Jason, full control), partner (invited guide or house owner, manages own listings), guest (books).

create extension if not exists btree_gist;

-- People ------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  email text,
  role text not null default 'guest' check (role in ('admin', 'partner', 'guest')),
  business_name text,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.is_host() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role in ('admin', 'partner'));
$$;

-- New sign-ups get a guest profile.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Stop anyone but an admin from changing their own role.
create or replace function public.guard_profile_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    raise exception 'Only an admin can change roles';
  end if;
  return new;
end $$;

create trigger profiles_guard_role before update on public.profiles
  for each row execute function public.guard_profile_role();

-- Places ------------------------------------------------------------------
create table public.areas (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  region text not null default '',
  description text not null default '',
  sort int not null default 0,
  published boolean not null default true
);

create table public.bay_systems (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references public.areas(id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null default '',
  unique (area_id, slug)
);

-- Listings: a stay (house) or a trip (fishing, cruise, tour) -------------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  kind text not null check (kind in ('stay', 'trip')),
  category text not null check (category in
    ('house', 'fishing', 'sunset_cruise', 'beach_cruise', 'island_tour', 'bird_watching', 'hunting', 'other')),
  title text not null,
  summary text not null default '',
  description text not null default '',
  area_id uuid not null references public.areas(id),
  bay_system_id uuid references public.bay_systems(id),
  owner_id uuid references public.profiles(id),
  photos text[] not null default '{}',
  price_cents int not null default 0,
  price_unit text not null default 'night' check (price_unit in ('night', 'trip', 'person')),
  max_guests int not null default 1,
  bedrooms int,
  bathrooms numeric(3,1),
  beds int,
  min_nights int not null default 1,
  duration_hours numeric(4,1),
  start_times text[] not null default '{}',
  amenities text[] not null default '{}',
  species text[] not null default '{}',
  address text,
  meeting_point text,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index listings_area_idx on public.listings (area_id, kind);

-- Days a host blocks off (maintenance, personal use, weather).
create table public.blocked_dates (
  listing_id uuid not null references public.listings(id) on delete cascade,
  day date not null,
  reason text,
  primary key (listing_id, day)
);

-- Bookings -----------------------------------------------------------------
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id),
  guest_id uuid references public.profiles(id),
  guest_name text not null,
  guest_email text not null,
  guest_phone text,
  start_date date not null,
  end_date date not null, -- stays: checkout day (exclusive); trips: same as start_date
  start_time text,
  guests int not null default 1,
  total_cents int not null default 0,
  status text not null default 'requested' check (status in ('requested', 'accepted', 'declined', 'cancelled')),
  notes text,
  host_note text,
  decided_by uuid references public.profiles(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index bookings_listing_idx on public.bookings (listing_id, start_date);

-- Two accepted stays can't overlap on the same house.
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist (listing_id with =, daterange(start_date, greatest(end_date, start_date + 1)) with &&)
  where (status = 'accepted');

-- Partner invites ------------------------------------------------------------
create table public.invites (
  code text primary key default encode(extensions.gen_random_bytes(9), 'hex'),
  label text not null default '',
  email text,
  role text not null default 'partner' check (role in ('partner', 'admin')),
  created_by uuid references public.profiles(id),
  used_by uuid references public.profiles(id),
  used_at timestamptz,
  expires_at timestamptz not null default now() + interval '14 days',
  created_at timestamptz not null default now()
);

create or replace function public.redeem_invite(invite_code text) returns text
language plpgsql security definer set search_path = public as $$
declare inv invites;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into inv from invites where code = invite_code for update;
  if not found then raise exception 'That invite link is not valid'; end if;
  if inv.used_at is not null then raise exception 'That invite was already used'; end if;
  if inv.expires_at < now() then raise exception 'That invite has expired'; end if;
  update invites set used_by = auth.uid(), used_at = now() where code = invite_code;
  update profiles set role = inv.role where id = auth.uid() and role <> 'admin';
  return inv.role;
end $$;

-- Busy days for a listing, without any guest details (public).
create or replace function public.listing_busy_days(p_listing uuid, p_from date, p_to date)
returns table (day date, kind text)
language sql stable security definer set search_path = public as $$
  select d::date, 'blocked' from blocked_dates b, generate_series(p_from, p_to, '1 day') d
   where b.listing_id = p_listing and b.day = d::date
  union
  select d::date, 'booked' from bookings k, generate_series(p_from, p_to, '1 day') d
   where k.listing_id = p_listing and k.status = 'accepted'
     and d::date >= k.start_date and d::date < greatest(k.end_date, k.start_date + 1);
$$;

-- Row level security ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.areas enable row level security;
alter table public.bay_systems enable row level security;
alter table public.listings enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.bookings enable row level security;
alter table public.invites enable row level security;

create policy "own profile" on public.profiles for select using (id = auth.uid() or is_admin());
create policy "hosts are public" on public.profiles for select using (role in ('admin', 'partner'));
create policy "edit own profile" on public.profiles for update using (id = auth.uid() or is_admin());

create policy "read areas" on public.areas for select using (published or is_admin());
create policy "admin areas" on public.areas for all using (is_admin()) with check (is_admin());
create policy "read bays" on public.bay_systems for select using (true);
create policy "admin bays" on public.bay_systems for all using (is_admin()) with check (is_admin());

create policy "read listings" on public.listings for select
  using (published or owner_id = auth.uid() or is_admin());
create policy "hosts add listings" on public.listings for insert
  with check (is_admin() or (is_host() and owner_id = auth.uid()));
create policy "hosts edit own listings" on public.listings for update
  using (is_admin() or owner_id = auth.uid()) with check (is_admin() or owner_id = auth.uid());
create policy "admin deletes listings" on public.listings for delete using (is_admin());

create policy "read blocks" on public.blocked_dates for select using (true);
create policy "hosts block own days" on public.blocked_dates for all
  using (is_admin() or exists (select 1 from listings l where l.id = listing_id and l.owner_id = auth.uid()))
  with check (is_admin() or exists (select 1 from listings l where l.id = listing_id and l.owner_id = auth.uid()));

create policy "see own or hosted bookings" on public.bookings for select using (
  guest_id = auth.uid() or is_admin()
  or exists (select 1 from listings l where l.id = listing_id and l.owner_id = auth.uid()));
create policy "guests request" on public.bookings for insert with check (
  guest_id = auth.uid() and status = 'requested');
create policy "hosts decide" on public.bookings for update using (
  is_admin() or exists (select 1 from listings l where l.id = listing_id and l.owner_id = auth.uid()));
create policy "guests cancel own" on public.bookings for update using (guest_id = auth.uid())
  with check (guest_id = auth.uid() and status = 'cancelled');

create policy "admin invites" on public.invites for all using (is_admin()) with check (is_admin());

-- Seed: Port O'Connor and its bays ----------------------------------------------
insert into public.areas (slug, name, region, description, sort) values
  ('port-oconnor', 'Port O''Connor', 'Texas Gulf Coast',
   'A quiet fishing town on the Texas coast between Matagorda Bay and Espiritu Santo Bay, with the jetties, Matagorda Island and miles of shallow flats close by.', 1);

insert into public.bay_systems (area_id, slug, name, description)
select a.id, b.slug, b.name, b.description from public.areas a,
  (values
    ('matagorda-bay', 'Matagorda Bay', 'Big open bay with reefs, shell and deep shorelines.'),
    ('espiritu-santo-bay', 'Espiritu Santo Bay', 'Grass flats and back lakes known for sight-casting redfish.'),
    ('san-antonio-bay', 'San Antonio Bay', 'Shell reefs and marsh drains to the south.'),
    ('jetties-gulf', 'Jetties and Gulf', 'The Matagorda ship channel jetties and nearshore Gulf.')
  ) as b(slug, name, description)
where a.slug = 'port-oconnor';
